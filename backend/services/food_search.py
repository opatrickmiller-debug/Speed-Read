"""
Advanced Food Search Service with Smart Ranking Algorithm + Redis Caching

This service provides intelligent food search across multiple sources:
- USDA FoodData Central (Foundation, SR Legacy, Survey)
- Open Food Facts (2M+ products)
- User's custom foods

Features:
- Redis caching for search results (24h TTL) and food details (7d TTL)
- RapidFuzz fuzzy matching for relevance scoring
- Deduplication by name + brand
- Popularity and user history boosting

Ranking Priority (v2):
1. Exact phrase match in description (highest)
2. RapidFuzz fuzzy similarity score
3. Tier priority: Tier1 (USDA Foundation/SR Legacy, Custom) > Tier2 (Survey) > Tier3 (OFF)
4. Nutrition density: higher protein foods rank higher for protein-related searches
5. Branded foods penalized unless include_branded=true
"""

import re
import asyncio
import logging
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field
from rapidfuzz import fuzz, process

from core.cache import cache, CacheKeys, CacheTTL

logger = logging.getLogger(__name__)

# Protein-related search terms for nutrition density boosting
PROTEIN_SEARCH_TERMS = {
    "protein", "chicken", "beef", "steak", "fish", "salmon", "tuna", "pork",
    "turkey", "lamb", "shrimp", "egg", "eggs", "meat", "poultry", "seafood",
    "whey", "casein", "tofu", "tempeh", "seitan"
}


@dataclass
class RankingWeights:
    """
    Configurable weights for the ranking algorithm (v2)
    
    Priority order:
    1. EXACT_PHRASE_MATCH - Query appears exactly as phrase in description
    2. FUZZY_SCORE - RapidFuzz similarity (scaled 0-100)
    3. TIER_BONUS - Source quality tiers
    4. NUTRITION_DENSITY - Protein content for protein-related searches
    5. BRANDED_PENALTY - Negative weight for branded items
    """
    # Priority 1: Exact phrase matching
    EXACT_PHRASE_MATCH: int = 200        # Full phrase match
    EXACT_PHRASE_START: int = 180        # Phrase at start of description
    EXACT_PHRASE_CONTAINS: int = 120     # Phrase found anywhere
    
    # Priority 2: Fuzzy similarity (multiplied by score 0-100)
    FUZZY_MULTIPLIER: float = 0.8        # fuzzy_score * 0.8 = max 80 points
    
    # Priority 3: Tier bonuses
    TIER_1_BONUS: int = 50               # USDA Foundation, SR Legacy, Custom
    TIER_2_BONUS: int = 25               # USDA Survey (FNDDS)
    TIER_3_BONUS: int = 0                # Open Food Facts
    
    # Priority 4: Nutrition density (for protein searches)
    PROTEIN_DENSITY_MULTIPLIER: float = 0.5  # protein_per_100g * 0.5 = max ~15-20 points
    
    # Priority 5: Branded penalty
    BRANDED_PENALTY: int = -60           # Penalty for branded foods
    
    # Bonus modifiers
    USER_LOGGED_BONUS: int = 30          # User has logged this before
    POPULARITY_MULTIPLIER: float = 5.0   # popularity_score (0-5) * 5 = max 25 points


class FoodSearchService:
    """
    Advanced food search with intelligent ranking (v2).
    
    Features:
    - Query normalization
    - Multi-source parallel fetching  
    - Deduplication by name + brand
    - Smart ranking with 5-tier priority system:
      1. Exact phrase match
      2. Fuzzy similarity
      3. Source tier (Foundation > Survey > OFF)
      4. Nutrition density
      5. Branded penalty
    """
    
    def __init__(self):
        self.weights = RankingWeights()
    
    def is_protein_search(self, query: str) -> bool:
        """Check if the search query is related to protein/high-protein foods"""
        query_lower = query.lower()
        query_tokens = set(query_lower.split())
        return bool(query_tokens & PROTEIN_SEARCH_TERMS)
    
    # ========================
    # 1. QUERY NORMALIZATION
    # ========================
    
    def normalize_query(self, query: str) -> str:
        """
        Normalize search query for consistent matching.
        
        - Lowercase
        - Remove punctuation (except hyphens in compound words)
        - Collapse multiple spaces
        - Strip leading/trailing whitespace
        """
        if not query:
            return ""
        
        # Lowercase
        normalized = query.lower()
        
        # Remove punctuation except hyphens (keep "sugar-free", "low-fat")
        # Replace commas and other punctuation with spaces
        normalized = re.sub(r'[^\w\s-]', ' ', normalized)
        
        # Collapse multiple spaces
        normalized = re.sub(r'\s+', ' ', normalized)
        
        return normalized.strip()
    
    def extract_query_tokens(self, normalized_query: str) -> List[str]:
        """Extract meaningful search tokens from normalized query"""
        # Split and filter out very short words (articles, etc.)
        tokens = [
            word for word in normalized_query.split() 
            if len(word) > 1
        ]
        return tokens
    
    # ========================
    # 2. DEDUPLICATION
    # ========================
    
    def create_dedup_key(self, food: Dict) -> str:
        """
        Create a unique key for deduplication based on name + brand.
        
        Example: "chicken breast|tyson" or "eggs|" (no brand)
        """
        name = self.normalize_query(food.get("description", ""))
        brand = self.normalize_query(food.get("brand_owner") or "")
        return f"{name}|{brand}"
    
    def deduplicate_foods(self, foods: List[Dict]) -> List[Dict]:
        """
        Remove duplicate foods based on name + brand combination.
        
        Keeps the first occurrence (which should be from a higher-priority source
        since results are processed in order: Custom -> USDA -> OFF).
        """
        seen_keys: Set[str] = set()
        unique_foods: List[Dict] = []
        
        for food in foods:
            key = self.create_dedup_key(food)
            if key not in seen_keys:
                seen_keys.add(key)
                unique_foods.append(food)
        
        logger.debug(f"Deduplication: {len(foods)} -> {len(unique_foods)} foods")
        return unique_foods
    
    # ========================
    # 3. FUZZY MATCHING
    # ========================
    
    def calculate_fuzzy_score(self, query: str, text: str) -> float:
        """
        Calculate fuzzy similarity score using RapidFuzz.
        
        Uses weighted combination of:
        - ratio: Simple character-level similarity
        - token_sort_ratio: Handles word reordering ("scrambled eggs" vs "eggs scrambled")
        - token_set_ratio: Handles partial matches ("chicken" in "chicken breast raw")
        - partial_ratio: Handles substring matches
        
        Returns: Score from 0-100
        """
        if not query or not text:
            return 0.0
        
        # Normalize both strings
        query_norm = self.normalize_query(query)
        text_norm = self.normalize_query(text)
        
        if not query_norm or not text_norm:
            return 0.0
        
        # Calculate multiple fuzzy metrics
        simple_ratio = fuzz.ratio(query_norm, text_norm)
        token_sort = fuzz.token_sort_ratio(query_norm, text_norm)
        token_set = fuzz.token_set_ratio(query_norm, text_norm)
        partial_ratio = fuzz.partial_ratio(query_norm, text_norm)
        
        # Weighted combination (emphasize token-based for food names)
        weighted_score = (
            simple_ratio * 0.10 +      # Less weight on exact char match
            token_sort * 0.30 +        # Word order flexibility
            token_set * 0.35 +         # Partial word matching (most important)
            partial_ratio * 0.25       # Substring matching
        )
        
        return weighted_score
    
    def check_exact_phrase_match(self, query: str, description: str) -> str:
        """
        Check for exact phrase matching.
        
        Returns:
        - "full" if description equals query exactly
        - "start" if description starts with query
        - "contains" if query appears as complete phrase in description
        - "none" if no exact match
        """
        query_norm = self.normalize_query(query)
        desc_norm = self.normalize_query(description)
        
        if not query_norm or not desc_norm:
            return "none"
        
        # Full match
        if desc_norm == query_norm:
            return "full"
        
        # Starts with query
        if desc_norm.startswith(query_norm + " ") or desc_norm.startswith(query_norm):
            return "start"
        
        # Contains query as a phrase (with word boundaries)
        # Using word boundary check to avoid partial word matches
        query_words = query_norm.split()
        desc_words = desc_norm.split()
        
        # Check if all query words appear consecutively in description
        query_len = len(query_words)
        for i in range(len(desc_words) - query_len + 1):
            if desc_words[i:i + query_len] == query_words:
                return "contains"
        
        return "none"
    
    def get_food_tier(self, food: Dict) -> int:
        """
        Determine the quality tier of a food item.
        
        Tier 1 (Best): USDA Foundation, SR Legacy, Custom foods
        Tier 2 (Good): USDA Survey (FNDDS)
        Tier 3 (Basic): Open Food Facts, USDA Branded
        
        Returns: 1, 2, or 3
        """
        source = food.get("source", "")
        data_type = food.get("data_type", "")
        
        # Tier 1: High-quality verified sources
        if source == "custom":
            return 1
        if source == "usda" and data_type in {"Foundation", "SR Legacy"}:
            return 1
        
        # Tier 2: USDA Survey data
        if source == "usda" and data_type == "Survey (FNDDS)":
            return 2
        
        # Tier 3: Community/branded sources
        return 3
    
    def is_branded_food(self, food: Dict) -> bool:
        """Check if a food item is a branded/packaged product"""
        source = food.get("source", "")
        data_type = food.get("data_type", "")
        brand = food.get("brand_owner", "")
        
        # USDA Branded category
        if source == "usda" and data_type == "Branded":
            return True
        
        # Open Food Facts with brand
        if source == "off" and brand:
            return True
        
        # Has a brand owner regardless of source
        if brand and source != "custom":
            return True
        
        return False
    
    # ========================
    # 4. RANKING ALGORITHM (v2)
    # ========================
    
    def calculate_ranking_score(
        self,
        food: Dict,
        query: str,
        user_logged_foods: Set[str],
        popularity_scores: Dict[str, float],
        include_branded: bool = False
    ) -> Tuple[float, Dict]:
        """
        Calculate the ranking score for a food item (v2 algorithm).
        
        Priority order:
        1. Exact phrase match:      +200 (full), +180 (start), +120 (contains)
        2. Fuzzy similarity:        score × 0.8 (max ~80 points)
        3. Tier bonus:              +50 (T1), +25 (T2), +0 (T3)
        4. Nutrition density:       protein_per_100g × 0.5 (for protein searches)
        5. Branded penalty:         -60 (if branded and not include_branded)
        + User logged bonus:        +30
        + Popularity bonus:         popularity × 5 (max 25)
        
        Returns: (total_score, score_breakdown_dict)
        """
        breakdown = {}
        score = 0.0
        
        food_id = str(food.get("fdc_id") or food.get("id", ""))
        description = food.get("description", "")
        
        # ===== PRIORITY 1: Exact Phrase Match =====
        phrase_match = self.check_exact_phrase_match(query, description)
        if phrase_match == "full":
            score += self.weights.EXACT_PHRASE_MATCH
            breakdown["exact_match"] = self.weights.EXACT_PHRASE_MATCH
        elif phrase_match == "start":
            score += self.weights.EXACT_PHRASE_START
            breakdown["exact_match"] = self.weights.EXACT_PHRASE_START
        elif phrase_match == "contains":
            score += self.weights.EXACT_PHRASE_CONTAINS
            breakdown["exact_match"] = self.weights.EXACT_PHRASE_CONTAINS
        else:
            breakdown["exact_match"] = 0
        
        # ===== PRIORITY 2: Fuzzy Similarity Score =====
        fuzzy_score = self.calculate_fuzzy_score(query, description)
        fuzzy_points = fuzzy_score * self.weights.FUZZY_MULTIPLIER
        score += fuzzy_points
        breakdown["fuzzy"] = round(fuzzy_points, 2)
        breakdown["fuzzy_raw"] = round(fuzzy_score, 1)
        
        # ===== PRIORITY 3: Tier Bonus =====
        tier = self.get_food_tier(food)
        if tier == 1:
            score += self.weights.TIER_1_BONUS
            breakdown["tier_bonus"] = self.weights.TIER_1_BONUS
        elif tier == 2:
            score += self.weights.TIER_2_BONUS
            breakdown["tier_bonus"] = self.weights.TIER_2_BONUS
        else:
            breakdown["tier_bonus"] = 0
        breakdown["tier"] = tier
        
        # ===== PRIORITY 4: Nutrition Density (for protein searches) =====
        is_protein_query = self.is_protein_search(query)
        if is_protein_query:
            protein_per_100g = food.get("protein_per_100g", 0) or 0
            protein_bonus = protein_per_100g * self.weights.PROTEIN_DENSITY_MULTIPLIER
            score += protein_bonus
            breakdown["protein_density"] = round(protein_bonus, 2)
        else:
            breakdown["protein_density"] = 0
        
        # ===== PRIORITY 5: Branded Penalty =====
        is_branded = self.is_branded_food(food)
        if is_branded and not include_branded:
            score += self.weights.BRANDED_PENALTY  # Negative value
            breakdown["branded_penalty"] = self.weights.BRANDED_PENALTY
        else:
            breakdown["branded_penalty"] = 0
        breakdown["is_branded"] = is_branded
        
        # ===== BONUS: User Logged =====
        if food_id in user_logged_foods:
            score += self.weights.USER_LOGGED_BONUS
            breakdown["user_logged"] = self.weights.USER_LOGGED_BONUS
        else:
            breakdown["user_logged"] = 0
        
        # ===== BONUS: Popularity =====
        popularity_value = popularity_scores.get(food_id, 0)
        popularity_bonus = popularity_value * self.weights.POPULARITY_MULTIPLIER
        score += popularity_bonus
        breakdown["popularity"] = round(popularity_bonus, 2)
        
        breakdown["total"] = round(score, 2)
        return round(score, 2), breakdown
    
    # ========================
    # 5. MAIN SEARCH METHOD
    # ========================
    
    async def search_and_rank(
        self,
        query: str,
        usda_results: List[Dict],
        off_results: List[Dict],
        custom_results: List[Dict],
        user_logged_foods: Set[str],
        popularity_scores: Dict[str, float],
        limit: int = 25,
        include_branded: bool = False
    ) -> List[Dict]:
        """
        Main search method that combines, deduplicates, and ranks results (v2).
        
        Args:
            query: Search query string
            usda_results: Results from USDA FoodData Central
            off_results: Results from Open Food Facts
            custom_results: Results from user's custom foods
            user_logged_foods: Set of food IDs the user has logged before
            popularity_scores: Dict mapping food_id -> popularity score (0-5)
            limit: Maximum number of results to return (default 25)
            include_branded: If True, don't penalize branded foods
        
        Ranking Priority:
            1. Exact phrase match in description
            2. RapidFuzz fuzzy similarity score
            3. Tier priority (Foundation/SR/Custom > Survey > OFF)
            4. Nutrition density (protein searches boost high-protein foods)
            5. Branded penalty (unless include_branded=True)
        
        Returns:
            List of ranked food items, top `limit` results (default 25)
        """
        # Step 1: Normalize query
        normalized_query = self.normalize_query(query)
        is_protein_query = self.is_protein_search(query)
        logger.info(f"Search query: '{query}' -> '{normalized_query}' (protein_search={is_protein_query})")
        
        # Step 2: Combine all results (order matters for dedup priority)
        # Custom foods first, then USDA (verified), then OFF (community)
        all_foods = []
        
        # Add custom foods with source tag
        for food in custom_results:
            food["source"] = food.get("source", "custom")
            all_foods.append(food)
        
        # Add USDA foods
        for food in usda_results:
            food["source"] = food.get("source", "usda")
            all_foods.append(food)
        
        # Add Open Food Facts
        for food in off_results:
            food["source"] = food.get("source", "off")
            all_foods.append(food)
        
        logger.info(f"Combined: {len(custom_results)} custom + {len(usda_results)} USDA + {len(off_results)} OFF = {len(all_foods)} total")
        
        # Step 3: Deduplicate by name + brand
        unique_foods = self.deduplicate_foods(all_foods)
        
        # Step 4: Calculate ranking scores with new v2 algorithm
        for food in unique_foods:
            score, breakdown = self.calculate_ranking_score(
                food=food,
                query=normalized_query,
                user_logged_foods=user_logged_foods,
                popularity_scores=popularity_scores,
                include_branded=include_branded
            )
            food["_ranking_score"] = score
            food["_score_breakdown"] = breakdown
            food["_fuzzy_score"] = breakdown.get("fuzzy_raw", 0)
        
        # Step 5: Sort by ranking score (descending)
        unique_foods.sort(key=lambda x: x.get("_ranking_score", 0), reverse=True)
        
        # Step 6: Take top N results (default 25)
        top_results = unique_foods[:limit]
        
        # Step 7: Build optimized summary response (no detailed nutrient profiles)
        # Detailed data (amino_acids, fatty_acids, etc.) only from GET /api/foods/{id}
        SUMMARY_FIELDS = {
            "fdc_id", "description", "brand_owner", "source", "data_type",
            "protein_per_100g", "calories_per_100g", "fat_per_100g", 
            "carbs_per_100g", "fiber_per_100g"
        }
        
        final_results = []
        for rank, food in enumerate(top_results, 1):
            # Build summary-only response
            summary = {
                "fdc_id": food.get("fdc_id") or food.get("id"),
                "description": food.get("description", ""),
                "brand": food.get("brand_owner"),
                "source": food.get("source", ""),
                "protein": round(food.get("protein_per_100g", 0) or 0, 1),
                "calories": round(food.get("calories_per_100g", 0) or 0, 0),
                "fat": round(food.get("fat_per_100g", 0) or 0, 1),
                "carbs": round(food.get("carbs_per_100g", 0) or 0, 1),
                "rank": rank
            }
            
            # Get tier from breakdown or calculate
            tier = food.get("_score_breakdown", {}).get("tier", self.get_food_tier(food))
            source = food.get("source", "")
            data_type = food.get("data_type", "")
            
            summary["tier"] = tier
            
            # Set tier labels and verification status
            if source == "custom":
                summary["tier_label"] = "Your Food"
            elif tier == 1:
                summary["tier_label"] = "Best Match"
            elif tier == 2:
                summary["tier_label"] = "Verified"
            else:
                if source == "off":
                    summary["tier_label"] = "Community"
                elif data_type == "Branded":
                    summary["tier_label"] = "Branded"
                else:
                    summary["tier_label"] = "Other"
            
            final_results.append(summary)
        
        logger.info(f"Returning top {len(final_results)} ranked results (limit={limit})")
        return final_results
    
    # ========================
    # 6. CACHING METHODS
    # ========================
    
    async def get_cached_search_results(self, query: str) -> Optional[List[Dict]]:
        """
        Get cached search results for a query.
        
        Returns cached results if available, None otherwise.
        """
        normalized_query = self.normalize_query(query)
        cached = await cache.get_search_results(normalized_query)
        
        if cached:
            logger.info(f"Cache HIT for search query: '{query}'")
            return cached
        
        logger.debug(f"Cache MISS for search query: '{query}'")
        return None
    
    async def cache_search_results(self, query: str, results: List[Dict]) -> bool:
        """
        Cache search results for a query (24 hour TTL).
        
        Note: We cache the final ranked results, not raw API responses.
        """
        normalized_query = self.normalize_query(query)
        success = await cache.set_search_results(normalized_query, results)
        
        if success:
            logger.debug(f"Cached {len(results)} results for query: '{query}'")
        return success
    
    async def get_cached_food_detail(self, source: str, food_id: str) -> Optional[Dict]:
        """
        Get cached food details.
        
        Returns cached food data if available, None otherwise.
        """
        cached = await cache.get_food_detail(source, food_id)
        
        if cached:
            logger.debug(f"Cache HIT for food: {source}:{food_id}")
            return cached
        
        return None
    
    async def cache_food_detail(self, source: str, food_id: str, food_data: Dict) -> bool:
        """
        Cache food details (7 day TTL).
        """
        success = await cache.set_food_detail(source, food_id, food_data)
        
        if success:
            logger.debug(f"Cached food detail: {source}:{food_id}")
        return success
    
    # ========================
    # 7. UTILITY METHODS (with caching)
    # ========================
    
    async def get_user_logged_foods(self, db, user_id: str) -> Set[str]:
        """
        Get set of food IDs that user has previously logged.
        Uses Redis cache with 1 hour TTL.
        
        This is used to boost frequently-used foods in search results.
        """
        # Check cache first
        cached = await cache.get_user_logged_foods(user_id)
        if cached is not None:
            logger.debug(f"Cache HIT for user logged foods: {user_id}")
            return set(cached)
        
        try:
            # Get distinct fdc_ids from user's logs
            pipeline = [
                {"$match": {"user_id": user_id}},
                {"$group": {"_id": "$fdc_id"}},
                {"$limit": 500}  # Reasonable limit
            ]
            
            cursor = db.food_logs.aggregate(pipeline)
            logged_ids = []
            
            async for doc in cursor:
                if doc.get("_id"):
                    logged_ids.append(str(doc["_id"]))
            
            # Cache the result
            await cache.set_user_logged_foods(user_id, logged_ids)
            logger.debug(f"Cached {len(logged_ids)} logged foods for user: {user_id}")
            
            return set(logged_ids)
        except Exception as e:
            logger.error(f"Error fetching user logged foods: {e}")
            return set()
    
    async def get_popularity_scores(self, db, limit: int = 200) -> Dict[str, float]:
        """
        Get popularity scores for foods based on selection count.
        Uses Redis cache with 30 minute TTL.
        
        Returns dict mapping food_id -> normalized score (0-5 scale)
        """
        # Check cache first
        cached = await cache.get_popularity_scores()
        if cached is not None:
            logger.debug("Cache HIT for popularity scores")
            return cached
        
        try:
            # Get top foods by selection count
            cursor = db.food_popularity.find(
                {},
                {"food_id": 1, "selection_count": 1, "_id": 0}
            ).sort("selection_count", -1).limit(limit)
            
            docs = await cursor.to_list(limit)
            
            if not docs:
                return {}
            
            # Normalize scores to 0-5 scale
            max_count = max(doc.get("selection_count", 1) for doc in docs)
            
            scores = {}
            for doc in docs:
                food_id = doc.get("food_id", "")
                count = doc.get("selection_count", 0)
                # Normalize: (count / max_count) * 5
                normalized = (count / max_count) * 5 if max_count > 0 else 0
                scores[food_id] = round(normalized, 2)
            
            # Cache the result
            await cache.set_popularity_scores(scores)
            logger.debug(f"Cached {len(scores)} popularity scores")
            
            return scores
        except Exception as e:
            logger.error(f"Error fetching popularity scores: {e}")
            return {}
    
    async def invalidate_user_cache(self, user_id: str):
        """Invalidate user's logged foods cache when they log new food"""
        await cache.invalidate_user_logged_foods(user_id)
        logger.debug(f"Invalidated cache for user: {user_id}")


# Singleton instance
food_search_service = FoodSearchService()
