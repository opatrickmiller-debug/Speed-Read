import httpx
import asyncio
import logging
from typing import Dict, List, Optional
from functools import lru_cache
from core.config import settings
from core.constants import ALL_AMINO_ACIDS, ESSENTIAL_AMINO_ACIDS, ALL_FATTY_ACIDS, ESSENTIAL_FATTY_ACIDS
from core.cache import cache
from models.food import AminoAcid, FattyAcid, FoodDetail, ServingSize

logger = logging.getLogger(__name__)

# Simple in-memory cache for food details (reduces API calls)
# This is a fallback when Redis is not available
_food_cache: Dict[str, Dict] = {}
_cache_max_size = 500

class FDCClient:
    def __init__(self):
        self.base_url = settings.fdc_base_url
        self.api_key = settings.fdc_api_key
        self.semaphore = asyncio.Semaphore(5)
    
    async def search_foods(self, query: str, page_size: int = 25, page: int = 1, data_type: Optional[str] = None) -> Dict:
        async with self.semaphore:
            async with httpx.AsyncClient(timeout=30.0) as client:
                json_body = {
                    "query": query,
                    "pageSize": page_size,
                    "pageNumber": page - 1
                }
                if data_type:
                    json_body["dataType"] = [data_type]
                
                try:
                    response = await client.post(
                        f"{self.base_url}/foods/search",
                        params={"api_key": self.api_key},
                        json=json_body
                    )
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPError as e:
                    logger.error(f"FDC search error: {e}")
                    return {"foods": [], "totalHits": 0}
    
    async def get_food_details(self, fdc_id: str) -> Optional[Dict]:
        """Get food details using the batch endpoint (more reliable) with Redis + in-memory caching."""
        global _food_cache
        
        # Check Redis cache first (7 day TTL)
        cached = await cache.get_food_detail("usda", fdc_id)
        if cached:
            logger.debug(f"Redis cache hit for {fdc_id}")
            return cached
        
        # Fallback to in-memory cache
        if fdc_id in _food_cache:
            logger.debug(f"Memory cache hit for {fdc_id}")
            return _food_cache[fdc_id]
        
        async with self.semaphore:
            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    # First try the single food endpoint
                    response = await client.get(
                        f"{self.base_url}/food/{fdc_id}",
                        params={"api_key": self.api_key}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Cache in Redis (7 day TTL)
                        await cache.set_food_detail("usda", fdc_id, data)
                        
                        # Also cache in memory (fallback)
                        if len(_food_cache) >= _cache_max_size:
                            keys_to_remove = list(_food_cache.keys())[:100]
                            for k in keys_to_remove:
                                del _food_cache[k]
                        _food_cache[fdc_id] = data
                        
                        return data
                    
                    # If single endpoint fails, try batch endpoint
                    logger.info(f"Single endpoint failed for {fdc_id}, trying batch endpoint")
                    response = await client.post(
                        f"{self.base_url}/foods",
                        params={"api_key": self.api_key},
                        json={"fdcIds": [int(fdc_id)], "format": "full"}
                    )
                    response.raise_for_status()
                    data = response.json()
                    
                    # Batch endpoint can return list or empty dict
                    if isinstance(data, list) and len(data) > 0:
                        result = data[0]
                        await cache.set_food_detail("usda", fdc_id, result)
                        _food_cache[fdc_id] = result
                        return result
                    elif isinstance(data, dict) and data:
                        await cache.set_food_detail("usda", fdc_id, data)
                        _food_cache[fdc_id] = data
                        return data
                    
                    # Food ID doesn't exist in USDA database
                    logger.warning(f"Food {fdc_id} not found in USDA database")
                    return None
                except (httpx.HTTPError, ValueError) as e:
                    logger.error(f"FDC details error for {fdc_id}: {e}")
                    return None
    
    def extract_nutrient(self, food_data: Dict, nutrient_id: int) -> float:
        nutrients = food_data.get("foodNutrients", [])
        for nutrient in nutrients:
            n_info = nutrient.get("nutrient", {})
            if n_info.get("id") == nutrient_id:
                return nutrient.get("amount", 0) or 0
        return 0
    
    def extract_amino_acids(self, food_data: Dict) -> List[AminoAcid]:
        amino_acids = []
        nutrients = food_data.get("foodNutrients", [])
        
        for aa_name, aa_info in ALL_AMINO_ACIDS.items():
            aa_id = aa_info.get("id")
            is_essential = aa_name in ESSENTIAL_AMINO_ACIDS
            
            for nutrient in nutrients:
                n_info = nutrient.get("nutrient", {})
                if n_info.get("id") == aa_id:
                    value = nutrient.get("amount", 0) or 0
                    if value > 0:
                        amino_acids.append(AminoAcid(
                            name=aa_name,
                            value=round(value, 3),
                            unit="g",
                            is_essential=is_essential
                        ))
                    break
        
        return amino_acids
    
    def analyze_protein_completeness(self, amino_acids: List[AminoAcid]) -> tuple:
        present_essential = {aa.name for aa in amino_acids if aa.is_essential and aa.value > 0}
        all_essential = set(ESSENTIAL_AMINO_ACIDS.keys())
        missing = list(all_essential - present_essential)
        is_complete = len(missing) == 0
        
        if not present_essential:
            quality_score = 0
        else:
            quality_score = (len(present_essential) / len(all_essential)) * 100
        
        return is_complete, missing, round(quality_score, 1)
    
    def extract_fatty_acids(self, food_data: Dict) -> List[FattyAcid]:
        """Extract fatty acids from food data."""
        fatty_acids = []
        nutrients = food_data.get("foodNutrients", [])
        
        for fa_name, fa_info in ALL_FATTY_ACIDS.items():
            fa_id = fa_info.get("id")
            is_essential = fa_name in ESSENTIAL_FATTY_ACIDS
            omega_type = fa_info.get("omega")
            
            for nutrient in nutrients:
                n_info = nutrient.get("nutrient", {})
                if n_info.get("id") == fa_id:
                    value = nutrient.get("amount", 0) or 0
                    if value > 0:
                        fatty_acids.append(FattyAcid(
                            name=fa_name,
                            value=round(value, 3),
                            unit="g",
                            is_essential=is_essential,
                            omega_type=omega_type
                        ))
                    break
        
        return fatty_acids
    
    def calculate_omega_totals(self, fatty_acids: List[FattyAcid]) -> tuple:
        """Calculate omega-3 and omega-6 totals and ratio."""
        omega3_total = sum(fa.value for fa in fatty_acids if fa.omega_type == 3)
        omega6_total = sum(fa.value for fa in fatty_acids if fa.omega_type == 6)
        
        if omega3_total > 0 and omega6_total > 0:
            # Calculate simplified ratio
            if omega3_total >= omega6_total:
                ratio = f"1:{omega6_total/omega3_total:.1f}"
            else:
                ratio = f"{omega3_total/omega6_total:.1f}:1"
        elif omega3_total > 0:
            ratio = "All Omega-3"
        elif omega6_total > 0:
            ratio = "All Omega-6"
        else:
            ratio = None
        
        return round(omega3_total, 3), round(omega6_total, 3), ratio
    
    def extract_servings(self, food_data: Dict) -> List[ServingSize]:
        """Extract serving size options from USDA foodPortions."""
        servings = []
        portions = food_data.get("foodPortions", [])
        description = food_data.get("description", "").lower()
        
        # Track seen gram weights to avoid duplicates
        seen_grams = set()
        
        for portion in portions:
            gram_weight = portion.get("gramWeight")
            modifier = portion.get("modifier", "")
            amount = portion.get("amount", 1.0)
            
            if not gram_weight or gram_weight <= 0:
                continue
            
            # Round to avoid float precision issues
            gram_weight = round(gram_weight, 1)
            
            # Skip duplicates
            if gram_weight in seen_grams:
                continue
            seen_grams.add(gram_weight)
            
            # Build a human-readable description and unit key
            serving_description = self._build_serving_label(modifier, amount, gram_weight, description)
            unit_key = self._generate_unit_key(modifier, description)
            
            servings.append(ServingSize(
                unit=unit_key,
                description=serving_description,
                grams=gram_weight
            ))
        
        # Sort by gram weight (smallest first, most common sizes)
        servings.sort(key=lambda s: s.grams)
        
        # Add standard portions if not present
        servings = self._add_standard_servings(servings, seen_grams)
        
        return servings
    
    def _generate_unit_key(self, modifier: str, description: str) -> str:
        """Generate a unique unit key from modifier and description."""
        modifier_lower = modifier.lower().strip() if modifier else ""
        
        # Common unit patterns
        if "cup" in modifier_lower:
            return "cup"
        if "tbsp" in modifier_lower or "tablespoon" in modifier_lower:
            return "tbsp"
        if "tsp" in modifier_lower or "teaspoon" in modifier_lower:
            return "tsp"
        if "slice" in modifier_lower:
            return "slice"
        if "piece" in modifier_lower:
            return "piece"
        
        # Size descriptors combined with item name
        size_words = ["small", "medium", "large", "extra_large", "jumbo"]
        for size in size_words:
            if size.replace("_", " ") in modifier_lower or size.replace("_", "-") in modifier_lower:
                item = self._get_item_name(description)
                return f"{size}_{item}".replace(" ", "_")
        
        # Default: use modifier or generate from description
        if modifier_lower:
            return modifier_lower.replace(" ", "_").replace("-", "_")
        
        return f"serving_{self._get_item_name(description)}"
    
    def _build_serving_label(self, modifier: str, amount: float, grams: float, description: str) -> str:
        """Build a human-readable serving label."""
        # Handle common patterns
        modifier_lower = modifier.lower() if modifier else ""
        
        # Cup measurements
        if "cup" in modifier_lower:
            return f"1 cup ({int(grams)}g)"
        
        # Tablespoon/teaspoon
        if "tbsp" in modifier_lower or "tablespoon" in modifier_lower:
            return f"1 tbsp ({int(grams)}g)"
        if "tsp" in modifier_lower or "teaspoon" in modifier_lower:
            return f"1 tsp ({int(grams)}g)"
        
        # Slice
        if "slice" in modifier_lower:
            return f"1 slice ({int(grams)}g)"
        
        # Piece
        if "piece" in modifier_lower:
            return f"1 piece ({int(grams)}g)"
        
        # Size descriptors (small, medium, large, etc.)
        size_words = ["small", "medium", "large", "extra large", "jumbo", "extra-large"]
        for size in size_words:
            if size in modifier_lower:
                # Try to determine item name from description
                item = self._get_item_name(description)
                return f"1 {size} {item} ({int(grams)}g)"
        
        # Numeric amounts with unit
        if amount != 1.0:
            return f"{amount} {modifier} ({int(grams)}g)" if modifier else f"{amount} ({int(grams)}g)"
        
        # Default: use modifier or generic
        if modifier:
            return f"1 {modifier} ({int(grams)}g)"
        
        return f"1 serving ({int(grams)}g)"
    
    def _get_item_name(self, description: str) -> str:
        """Extract a simple item name from description."""
        # Common food items to detect
        items = ["egg", "apple", "banana", "orange", "chicken", "breast", "thigh", 
                 "steak", "patty", "slice", "piece", "fillet", "cup", "can"]
        
        desc_lower = description.lower()
        for item in items:
            if item in desc_lower:
                return item
        
        # Return first word as fallback
        words = description.split(",")[0].split()
        return words[0].lower() if words else "serving"
    
    def _add_standard_servings(self, servings: List[ServingSize], seen_grams: set) -> List[ServingSize]:
        """Add standard serving options if not already present."""
        standard_servings = [
            (28.35, "oz", "1 oz (28g)"),
            (100, "100g", "100g"),
        ]
        
        for grams, unit, description in standard_servings:
            if grams not in seen_grams:
                servings.append(ServingSize(
                    unit=unit,
                    description=description,
                    grams=grams
                ))
        
        # Re-sort after adding
        servings.sort(key=lambda s: s.grams)
        return servings
    
    def parse_food_detail(self, food_data: Dict) -> FoodDetail:
        amino_acids = self.extract_amino_acids(food_data)
        is_complete, missing, quality_score = self.analyze_protein_completeness(amino_acids)
        
        fatty_acids = self.extract_fatty_acids(food_data)
        omega3_total, omega6_total, omega_ratio = self.calculate_omega_totals(fatty_acids)
        
        servings = self.extract_servings(food_data)
        
        return FoodDetail(
            fdc_id=str(food_data.get("fdcId", "")),
            description=food_data.get("description", ""),
            brand_owner=food_data.get("brandOwner"),
            serving_size=100,
            serving_unit="g",
            calories=self.extract_nutrient(food_data, 1008),
            protein=self.extract_nutrient(food_data, 1003),
            fat=self.extract_nutrient(food_data, 1004),
            carbs=self.extract_nutrient(food_data, 1005),
            fiber=self.extract_nutrient(food_data, 1079),
            amino_acids=amino_acids,
            fatty_acids=fatty_acids,
            is_complete_protein=is_complete,
            missing_amino_acids=missing,
            protein_quality_score=quality_score,
            omega3_total=omega3_total,
            omega6_total=omega6_total,
            omega_ratio=omega_ratio,
            servings=servings
        )

fdc_client = FDCClient()
