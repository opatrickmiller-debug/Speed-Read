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

Ranking is based on:
- Exact/fuzzy name matching (RapidFuzz)
- User's food logging history
- Popularity scores
- Data source quality (USDA verified vs community)
"""

import re
import asyncio
import logging
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from rapidfuzz import fuzz, process

from core.cache import cache, CacheKeys, CacheTTL

logger = logging.getLogger(__name__)


@dataclass
class RankingWeights:
    """Configurable weights for the ranking algorithm"""
    EXACT_MATCH: int = 100
    USER_LOGGED: int = 40
    POPULARITY_MULTIPLIER: int = 10
    USDA_VERIFIED: int = 20
    FUZZY_MULTIPLIER: float = 0.30  # fuzzy_score * 30


class FoodSearchService:
    """
    Advanced food search with intelligent ranking.
    
    Features:
    - Query normalization
    - Multi-source parallel fetching
    - Deduplication by name + brand
    - Smart ranking with fuzzy matching
    """
    
    def __init__(self):
        self.weights = RankingWeights()
    
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
        
        # Weighted combination (token-based matching is more useful for food names)
        weighted_score = (
            simple_ratio * 0.15 +
            token_sort * 0.35 +
            token_set * 0.30 +
            partial_ratio * 0.20
        )
        
        return weighted_score
    
    # ========================
    # 4. RANKING ALGORITHM
    # ========================
    
    def calculate_ranking_score(
        self,
        food: Dict,
        query: str,
        user_logged_foods: Set[str],
        popularity_scores: Dict[str, float]
    ) -> float:
        """
        Calculate the ranking score for a food item.
        
        Score breakdown:
        - Exact name match:        +100 points
        - User previously logged:  +40 points  
        - Popularity score:        +10 × popularity_value (0-5)
        - USDA verified food:      +20 points
        - Fuzzy similarity:        fuzzy_score × 0.30 (max ~30 points)
        
        Returns: Total ranking score (higher = more relevant)
        """
        score = 0.0
        food_id = str(food.get("fdc_id") or food.get("id", ""))
        description = food.get("description", "")
        
        normalized_query = self.normalize_query(query)
        normalized_desc = self.normalize_query(description)
        
        # 1. EXACT NAME MATCH (+100)
        # Check if query exactly matches the start of description
        if normalized_desc.startswith(normalized_query):
            score += self.weights.EXACT_MATCH
        elif normalized_query in normalized_desc:
            # Partial exact match (query appears somewhere in name)
            score += self.weights.EXACT_MATCH * 0.7
        
        # 2. USER PREVIOUSLY LOGGED (+40)
        if food_id in user_logged_foods:
            score += self.weights.USER_LOGGED
        
        # 3. POPULARITY SCORE (+10 × value)
        popularity_value = popularity_scores.get(food_id, 0)
        score += self.weights.POPULARITY_MULTIPLIER * popularity_value
        
        # 4. USDA VERIFIED FOOD (+20)
        source = food.get("source", "")
        data_type = food.get("data_type", "")
        
        if source == "usda" and data_type in {"Foundation", "SR Legacy", "Survey (FNDDS)"}:
            score += self.weights.USDA_VERIFIED
        elif source == "custom":
            # User's own foods are also "verified" in a sense
            score += self.weights.USDA_VERIFIED
        
        # 5. FUZZY SIMILARITY SCORE (×30)
        fuzzy_score = self.calculate_fuzzy_score(query, description)
        score += fuzzy_score * self.weights.FUZZY_MULTIPLIER
        
        return round(score, 2)
    
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
        limit: int = 20
    ) -> List[Dict]:
        """
        Main search method that combines, deduplicates, and ranks results.
        
        Args:
            query: Search query string
            usda_results: Results from USDA FoodData Central
            off_results: Results from Open Food Facts
            custom_results: Results from user's custom foods
            user_logged_foods: Set of food IDs the user has logged before
            popularity_scores: Dict mapping food_id -> popularity score (0-5)
            limit: Maximum number of results to return (default 20)
        
        Returns:
            List of ranked food items, top `limit` results
        """
        # Step 1: Normalize query
        normalized_query = self.normalize_query(query)
        logger.info(f"Search query normalized: '{query}' -> '{normalized_query}'")
        
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
        
        logger.info(f"Combined results: {len(custom_results)} custom + {len(usda_results)} USDA + {len(off_results)} OFF = {len(all_foods)} total")
        
        # Step 3: Deduplicate by name + brand
        unique_foods = self.deduplicate_foods(all_foods)
        
        # Step 4: Calculate ranking scores
        for food in unique_foods:
            food["_ranking_score"] = self.calculate_ranking_score(
                food=food,
                query=normalized_query,
                user_logged_foods=user_logged_foods,
                popularity_scores=popularity_scores
            )
            
            # Also calculate and store fuzzy score for debugging/display
            food["_fuzzy_score"] = round(
                self.calculate_fuzzy_score(query, food.get("description", "")), 
                1
            )
        
        # Step 5: Sort by ranking score (descending)
        unique_foods.sort(key=lambda x: x.get("_ranking_score", 0), reverse=True)
        
        # Step 6: Take top N results
        top_results = unique_foods[:limit]
        
        # Step 7: Clean up internal fields and add tier labels
        final_results = []
        for rank, food in enumerate(top_results, 1):
            # Remove internal scoring fields
            clean_food = {k: v for k, v in food.items() if not k.startswith("_")}
            
            # Add rank position
            clean_food["rank"] = rank
            
            # Add tier/verification labels
            source = food.get("source", "")
            data_type = food.get("data_type", "")
            
            if source == "custom":
                clean_food["tier"] = 1
                clean_food["is_verified"] = True
                clean_food["tier_label"] = "Your Food"
            elif source == "usda":
                if data_type in {"Foundation", "SR Legacy"}:
                    clean_food["tier"] = 1
                    clean_food["is_verified"] = True
                    clean_food["tier_label"] = "Best Match"
                elif data_type == "Survey (FNDDS)":
                    clean_food["tier"] = 2
                    clean_food["is_verified"] = True
                    clean_food["tier_label"] = "Verified"
                else:
                    clean_food["tier"] = 3
                    clean_food["is_verified"] = False
                    clean_food["tier_label"] = "Branded"
            else:
                clean_food["tier"] = 3
                clean_food["is_verified"] = False
                clean_food["tier_label"] = "Community"
            
            final_results.append(clean_food)
        
        logger.info(f"Returning top {len(final_results)} ranked results")
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
