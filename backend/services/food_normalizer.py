"""
Food Normalizer Service

Centralizes food data normalization from multiple sources:
- USDA FoodData Central
- Open Food Facts
- Custom Foods (user-created)
- Stored Foods (local MongoDB)

All food data flows through this normalizer to ensure consistent structure
across the application.

Usage:
    from services.food_normalizer import normalizer
    
    # From USDA raw response
    food = normalizer.from_usda(usda_raw_data)
    
    # From Open Food Facts
    food = normalizer.from_off(off_product_data)
    
    # From custom food document
    food = normalizer.from_custom(custom_food_doc)
    
    # From stored food document
    food = normalizer.from_stored(stored_food_doc)
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from models.food import ServingSize, AminoAcid, FattyAcid

logger = logging.getLogger(__name__)


@dataclass
class NormalizedFood:
    """
    Canonical food structure used throughout the application.
    All food sources are normalized to this format.
    """
    id: str
    name: str
    source: str  # "usda", "off", "custom", "local"
    
    # Core macros (per 100g)
    calories: float = 0.0
    protein: float = 0.0
    fat: float = 0.0
    carbs: float = 0.0
    fiber: float = 0.0
    
    # Detailed nutrition (per 100g)
    amino_acids: Dict[str, float] = field(default_factory=dict)
    fatty_acids: Dict[str, float] = field(default_factory=dict)
    
    # Serving options
    servings: List[Dict] = field(default_factory=list)
    
    # Optional metadata
    brand: Optional[str] = None
    category: Optional[str] = None
    data_type: Optional[str] = None
    barcode: Optional[str] = None
    
    # For NutritionCalculator compatibility
    base_amount: float = 100.0
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "fdc_id": self.id,  # Alias for compatibility
            "name": self.name,
            "description": self.name,  # Alias for compatibility
            "source": self.source,
            "calories": self.calories,
            "protein": self.protein,
            "fat": self.fat,
            "carbs": self.carbs,
            "fiber": self.fiber,
            "amino_acids": self.amino_acids,
            "fatty_acids": self.fatty_acids,
            "servings": self.servings,
            "brand": self.brand,
            "category": self.category,
            "data_type": self.data_type,
            "barcode": self.barcode,
            "base_amount": self.base_amount
        }
    
    def to_calculator_format(self) -> Dict:
        """Convert to NutritionCalculator input format."""
        return {
            "name": self.name,
            "fdc_id": self.id,
            "nutrition": {
                "calories": self.calories,
                "protein": self.protein,
                "fat": self.fat,
                "carbs": self.carbs,
                "fiber": self.fiber
            },
            "amino_acids": self.amino_acids,
            "fatty_acids": self.fatty_acids,
            "base_amount": self.base_amount,
            "servings": self._ensure_gram_serving(self.servings)
        }
    
    def _ensure_gram_serving(self, servings: List[Dict]) -> List[Dict]:
        """Ensure gram serving option exists."""
        has_gram = any(s.get("unit") == "g" for s in servings)
        if not has_gram:
            servings = servings + [{"unit": "g", "description": "1 gram", "grams": 1}]
        return servings


class FoodNormalizer:
    """
    Normalizes food data from various sources into a consistent format.
    """
    
    # USDA nutrient IDs
    NUTRIENT_IDS = {
        "calories": 1008,
        "protein": 1003,
        "fat": 1004,
        "carbs": 1005,
        "fiber": 1079
    }
    
    # Standard serving conversions (in grams)
    STANDARD_SERVINGS = {
        "g": 1,
        "oz": 28.35,
        "lb": 453.6,
        "cup": 240,
        "tbsp": 15,
        "tsp": 5
    }
    
    def from_usda(self, raw_data: Dict, amino_acids: List[AminoAcid] = None, 
                  fatty_acids: List[FattyAcid] = None) -> NormalizedFood:
        """
        Normalize USDA FoodData Central response.
        
        Args:
            raw_data: Raw response from USDA API
            amino_acids: Pre-extracted amino acids (optional)
            fatty_acids: Pre-extracted fatty acids (optional)
        
        Returns:
            NormalizedFood object
        """
        fdc_id = str(raw_data.get("fdcId", ""))
        description = raw_data.get("description", "Unknown Food")
        data_type = raw_data.get("dataType", "")
        brand = raw_data.get("brandOwner") or raw_data.get("brandName")
        
        # Extract macros
        nutrients = raw_data.get("foodNutrients", [])
        macros = self._extract_usda_macros(nutrients)
        
        # Extract servings
        servings = self._extract_usda_servings(raw_data)
        
        # Convert amino/fatty acids to dict format
        aa_dict = {}
        if amino_acids:
            aa_dict = {aa.name: aa.value for aa in amino_acids}
        
        fa_dict = {}
        if fatty_acids:
            fa_dict = {fa.name: fa.value for fa in fatty_acids}
        
        return NormalizedFood(
            id=fdc_id,
            name=description,
            source="usda",
            calories=macros.get("calories", 0),
            protein=macros.get("protein", 0),
            fat=macros.get("fat", 0),
            carbs=macros.get("carbs", 0),
            fiber=macros.get("fiber", 0),
            amino_acids=aa_dict,
            fatty_acids=fa_dict,
            servings=servings,
            brand=brand,
            data_type=data_type
        )
    
    def from_off(self, product: Dict) -> NormalizedFood:
        """
        Normalize Open Food Facts product data.
        
        Args:
            product: Product dict from OFF API
        
        Returns:
            NormalizedFood object
        """
        barcode = product.get("code", "")
        name = product.get("product_name", "") or product.get("generic_name", "Unknown Product")
        brand = product.get("brands", "")
        
        nutriments = product.get("nutriments", {})
        
        # OFF uses different keys for nutrients
        calories = nutriments.get("energy-kcal_100g", 0) or nutriments.get("energy_100g", 0) / 4.184
        protein = nutriments.get("proteins_100g", 0) or 0
        fat = nutriments.get("fat_100g", 0) or 0
        carbs = nutriments.get("carbohydrates_100g", 0) or 0
        fiber = nutriments.get("fiber_100g", 0) or 0
        
        # Build servings from OFF serving size
        servings = self._extract_off_servings(product)
        
        return NormalizedFood(
            id=f"off:{barcode}",
            name=name,
            source="off",
            calories=calories,
            protein=protein,
            fat=fat,
            carbs=carbs,
            fiber=fiber,
            servings=servings,
            brand=brand,
            barcode=barcode,
            data_type="branded"
        )
    
    def from_custom(self, custom_food: Dict) -> NormalizedFood:
        """
        Normalize user-created custom food.
        
        Args:
            custom_food: Document from custom_foods collection
        
        Returns:
            NormalizedFood object
        """
        food_id = custom_food.get("id", "")
        name = custom_food.get("name", "Custom Food")
        
        # Custom foods may have amino/fatty acids as lists
        amino_acids = {}
        for aa in custom_food.get("amino_acids", []):
            if isinstance(aa, dict):
                amino_acids[aa.get("name", "")] = aa.get("value", 0)
        
        fatty_acids = {}
        for fa in custom_food.get("fatty_acids", []):
            if isinstance(fa, dict):
                fatty_acids[fa.get("name", "")] = fa.get("value", 0)
        
        # Build servings
        servings = custom_food.get("servings", [])
        if not servings:
            servings = self._build_default_servings()
        
        return NormalizedFood(
            id=f"custom:{food_id}",
            name=name,
            source="custom",
            calories=custom_food.get("calories", 0),
            protein=custom_food.get("protein", 0),
            fat=custom_food.get("fat", 0),
            carbs=custom_food.get("carbs", 0),
            fiber=custom_food.get("fiber", 0),
            amino_acids=amino_acids,
            fatty_acids=fatty_acids,
            servings=servings,
            category=custom_food.get("category")
        )
    
    def from_stored(self, stored_food: Dict) -> NormalizedFood:
        """
        Normalize locally stored food from MongoDB.
        
        Args:
            stored_food: Document from foods collection
        
        Returns:
            NormalizedFood object
        """
        food_id = stored_food.get("_id", "")
        name = stored_food.get("name", "")
        nutrition = stored_food.get("nutrition", {})
        
        return NormalizedFood(
            id=food_id,
            name=name,
            source=stored_food.get("source", "local"),
            calories=nutrition.get("calories", 0),
            protein=nutrition.get("protein", 0),
            fat=nutrition.get("fat", 0),
            carbs=nutrition.get("carbs", 0),
            fiber=nutrition.get("fiber", 0),
            amino_acids=stored_food.get("amino_acids", {}),
            fatty_acids=stored_food.get("fatty_acids", {}),
            servings=stored_food.get("servings", []),
            brand=stored_food.get("brand"),
            category=stored_food.get("category")
        )
    
    def from_search_result(self, result: Dict, source: str = "usda") -> Dict:
        """
        Normalize a search result for display (lightweight).
        
        Args:
            result: Search result from any source
            source: Source identifier
        
        Returns:
            Normalized search result dict
        """
        if source == "usda":
            return {
                "fdc_id": str(result.get("fdcId", "")),
                "description": result.get("description", ""),
                "brand_owner": result.get("brandOwner"),
                "data_type": result.get("dataType", ""),
                "protein_per_100g": self._get_usda_nutrient(result, 1003),
                "calories_per_100g": self._get_usda_nutrient(result, 1008)
            }
        elif source == "off":
            nutriments = result.get("nutriments", {})
            return {
                "fdc_id": f"off:{result.get('code', '')}",
                "description": result.get("product_name", ""),
                "brand_owner": result.get("brands"),
                "data_type": "branded",
                "protein_per_100g": nutriments.get("proteins_100g", 0) or 0,
                "calories_per_100g": nutriments.get("energy-kcal_100g", 0) or 0
            }
        elif source == "custom":
            return {
                "fdc_id": f"custom:{result.get('id', '')}",
                "description": result.get("name", ""),
                "brand_owner": None,
                "data_type": "custom",
                "protein_per_100g": result.get("protein", 0),
                "calories_per_100g": result.get("calories", 0)
            }
        else:
            return result
    
    # ==================== HELPER METHODS ====================
    
    def _extract_usda_macros(self, nutrients: List[Dict]) -> Dict[str, float]:
        """Extract macro nutrients from USDA nutrient array."""
        macros = {}
        for name, nutrient_id in self.NUTRIENT_IDS.items():
            for nutrient in nutrients:
                n_info = nutrient.get("nutrient", {})
                if n_info.get("id") == nutrient_id:
                    macros[name] = nutrient.get("amount", 0) or 0
                    break
        return macros
    
    def _extract_usda_servings(self, food_data: Dict) -> List[Dict]:
        """Extract serving options from USDA foodPortions."""
        servings = []
        portions = food_data.get("foodPortions", [])
        description = food_data.get("description", "").lower()
        seen_grams = set()
        
        for portion in portions:
            gram_weight = portion.get("gramWeight")
            modifier = portion.get("modifier", "")
            amount = portion.get("amount", 1.0)
            
            if not gram_weight or gram_weight <= 0:
                continue
            
            gram_weight = round(gram_weight, 1)
            if gram_weight in seen_grams:
                continue
            seen_grams.add(gram_weight)
            
            unit = self._generate_unit_key(modifier, description)
            label = self._build_serving_label(modifier, amount, gram_weight, description)
            
            servings.append({
                "unit": unit,
                "description": label,
                "grams": gram_weight
            })
        
        servings.sort(key=lambda s: s["grams"])
        
        # Add standard servings
        for unit, grams in [("oz", 28.35), ("100g", 100)]:
            if grams not in seen_grams:
                servings.append({
                    "unit": unit,
                    "description": f"1 {unit}" if unit != "100g" else "100g",
                    "grams": grams
                })
        
        return servings
    
    def _extract_off_servings(self, product: Dict) -> List[Dict]:
        """Extract serving options from Open Food Facts product."""
        servings = []
        
        # Get serving size if available
        serving_size = product.get("serving_size", "")
        serving_quantity = product.get("serving_quantity")
        
        if serving_quantity and serving_quantity > 0:
            servings.append({
                "unit": "serving",
                "description": f"1 serving ({serving_size})" if serving_size else f"1 serving ({serving_quantity}g)",
                "grams": float(serving_quantity)
            })
        
        # Add standard servings
        servings.extend([
            {"unit": "g", "description": "1 gram", "grams": 1},
            {"unit": "oz", "description": "1 oz (28g)", "grams": 28.35},
            {"unit": "100g", "description": "100g", "grams": 100}
        ])
        
        return servings
    
    def _build_default_servings(self) -> List[Dict]:
        """Build default serving options."""
        return [
            {"unit": "g", "description": "1 gram", "grams": 1},
            {"unit": "oz", "description": "1 oz (28g)", "grams": 28.35},
            {"unit": "100g", "description": "100g", "grams": 100},
            {"unit": "cup", "description": "1 cup (240g)", "grams": 240}
        ]
    
    def _generate_unit_key(self, modifier: str, description: str) -> str:
        """Generate a unique unit key from modifier and description."""
        modifier_lower = modifier.lower().strip() if modifier else ""
        
        # Common unit patterns
        unit_patterns = {
            "cup": "cup",
            "tbsp": "tbsp", "tablespoon": "tbsp",
            "tsp": "tsp", "teaspoon": "tsp",
            "slice": "slice",
            "piece": "piece",
            "oz": "oz", "ounce": "oz"
        }
        
        for pattern, unit in unit_patterns.items():
            if pattern in modifier_lower:
                return unit
        
        # Size descriptors
        size_words = ["small", "medium", "large", "extra_large", "jumbo"]
        for size in size_words:
            if size.replace("_", " ") in modifier_lower:
                item = self._get_item_name(description)
                return f"{size}_{item}".replace(" ", "_")
        
        if modifier_lower:
            return modifier_lower.replace(" ", "_").replace("-", "_")
        
        return f"serving"
    
    def _build_serving_label(self, modifier: str, amount: float, grams: float, description: str) -> str:
        """Build a human-readable serving label."""
        modifier_lower = modifier.lower() if modifier else ""
        
        # Format amount
        if amount == int(amount):
            amt_str = str(int(amount))
        else:
            amt_str = str(amount)
        
        # Build label
        if modifier_lower:
            return f"{amt_str} {modifier} ({int(grams)}g)"
        else:
            return f"{amt_str} serving ({int(grams)}g)"
    
    def _get_item_name(self, description: str) -> str:
        """Extract the main item name from a food description."""
        words = description.lower().split(",")[0].split()
        if words:
            return words[0]
        return "item"
    
    def _get_usda_nutrient(self, result: Dict, nutrient_id: int) -> float:
        """Get nutrient value from USDA search result."""
        for nutrient in result.get("foodNutrients", []):
            if nutrient.get("nutrientId") == nutrient_id:
                return nutrient.get("value", 0) or 0
        return 0


# Singleton instance
normalizer = FoodNormalizer()
