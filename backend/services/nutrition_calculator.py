"""
Nutrition Calculator Service

Handles serving size conversions and nutrition calculations
for foods with USDA-style portion data.
"""

from functools import lru_cache
from typing import Dict, List, Optional

NutritionDict = Dict[str, float]


class NutritionCalculator:
    """
    Calculates nutrition values based on serving size and amount.
    
    Usage:
        food = {
            "name": "Egg",
            "nutrition": {"calories": 155, "protein": 13, "fat": 11, "carbs": 1.1},
            "base_amount": 100,
            "servings": [
                {"unit": "egg", "description": "1 large egg", "grams": 50},
                {"unit": "cup", "description": "1 cup chopped", "grams": 243},
                {"unit": "g", "description": "1 gram", "grams": 1}
            ]
        }
        
        calc = NutritionCalculator(food)
        result = calc.calculate_nutrition(2, "egg")
        # Returns: {"grams": 100, "nutrition": {"calories": 155, "protein": 13, ...}}
    """
    
    def __init__(self, food: Dict):
        self.food = food
        self.name = food.get("name", "Unknown")
        self.base_amount = food.get("base_amount", 100)
        self.base_nutrition = food.get("nutrition", {})
        self.servings = {s["unit"]: s for s in food.get("servings", [])}
        
        # Add default gram serving if not present
        if "g" not in self.servings:
            self.servings["g"] = {"unit": "g", "description": "1 gram", "grams": 1}
    
    @lru_cache(maxsize=1024)
    def get_serving_grams(self, unit: str) -> float:
        """Get the gram weight for a serving unit."""
        if unit not in self.servings:
            raise ValueError(f"Unknown serving unit: {unit}")
        return self.servings[unit]["grams"]
    
    def get_serving_description(self, unit: str) -> str:
        """Get the human-readable description for a serving unit."""
        if unit not in self.servings:
            return f"1 {unit}"
        return self.servings[unit].get("description", f"1 {unit}")
    
    def list_servings(self) -> List[Dict]:
        """List all available serving options."""
        return [
            {
                "unit": s["unit"],
                "description": s["description"],
                "grams": s["grams"]
            }
            for s in self.servings.values()
        ]
    
    def calculate_nutrition(self, amount: float, unit: str) -> Dict:
        """
        Calculate nutrition for a given amount and serving unit.
        
        Args:
            amount: Number of servings (e.g., 2 for "2 eggs")
            unit: Serving unit (e.g., "egg", "cup", "g")
        
        Returns:
            {
                "grams": 100.0,
                "nutrition": {
                    "calories": 155.0,
                    "protein": 13.0,
                    "fat": 11.0,
                    "carbs": 1.1
                }
            }
        """
        grams = amount * self.get_serving_grams(unit)
        factor = grams / self.base_amount
        
        nutrition = {
            key: round(value * factor, 2) 
            for key, value in self.base_nutrition.items()
        }
        
        return {
            "grams": round(grams, 2),
            "nutrition": nutrition
        }
    
    def calculate_from_grams(self, grams: float) -> Dict:
        """
        Calculate nutrition directly from gram weight.
        
        Args:
            grams: Weight in grams
        
        Returns:
            {"grams": 50.0, "nutrition": {...}}
        """
        return self.calculate_nutrition(grams, "g")


def food_to_calculator_format(food_detail: Dict) -> Dict:
    """
    Convert FDC/API food response to NutritionCalculator format.
    
    Input (from /api/foods/{id}):
        {
            "fdc_id": "171287",
            "description": "Egg, whole, raw",
            "calories": 143,
            "protein": 12.56,
            "fat": 9.51,
            "carbs": 0.72,
            "servings": [
                {"unit": "large_egg", "description": "1 large egg (50g)", "grams": 50.0},
                {"unit": "cup", "description": "1 cup (243g)", "grams": 243.0}
            ]
        }
    
    Output:
        {
            "name": "Egg, whole, raw",
            "nutrition": {"calories": 143, "protein": 12.56, "fat": 9.51, "carbs": 0.72},
            "base_amount": 100,
            "servings": [
                {"unit": "large_egg", "description": "1 large egg (50g)", "grams": 50.0},
                {"unit": "cup", "description": "1 cup (243g)", "grams": 243.0},
                {"unit": "g", "description": "1 gram", "grams": 1}
            ]
        }
    """
    servings = []
    
    # Convert API servings to calculator format
    for idx, s in enumerate(food_detail.get("servings", [])):
        # Use unit directly if present, otherwise generate from description
        unit = s.get("unit", "")
        description = s.get("description", "") or s.get("label", "")  # Backward compatible
        
        if not unit:
            # Generate a unit key from the description (backward compatibility)
            if "cup" in description.lower():
                unit = "cup"
            elif "tbsp" in description.lower():
                unit = "tbsp"
            elif "tsp" in description.lower():
                unit = "tsp"
            elif "oz" in description.lower() and "fl" not in description.lower():
                unit = "oz"
            elif "slice" in description.lower():
                unit = "slice"
            elif "piece" in description.lower():
                unit = "piece"
            else:
                unit = f"serving_{idx}"
        
        servings.append({
            "unit": unit,
            "description": description,
            "grams": s.get("grams", 100)
        })
    
    # Always add gram unit if not present
    if not any(s["unit"] == "g" for s in servings):
        servings.append({
            "unit": "g",
            "description": "1 gram",
            "grams": 1
        })
    
    return {
        "name": food_detail.get("description", "Unknown"),
        "fdc_id": food_detail.get("fdc_id"),
        "nutrition": {
            "calories": food_detail.get("calories", 0),
            "protein": food_detail.get("protein", 0),
            "fat": food_detail.get("fat", 0),
            "carbs": food_detail.get("carbs", 0),
            "fiber": food_detail.get("fiber", 0)
        },
        "base_amount": 100,
        "servings": servings
    }


# Convenience function for quick calculations
def calculate_food_nutrition(
    food_detail: Dict,
    amount: float,
    unit: str
) -> Dict:
    """
    One-liner to calculate nutrition from API food response.
    
    Usage:
        food = await foodsApi.get("171287")
        result = calculate_food_nutrition(food, 2, "large_egg")
    """
    calc_format = food_to_calculator_format(food_detail)
    calculator = NutritionCalculator(calc_format)
    return calculator.calculate_nutrition(amount, unit)
