"""
Canonical Food Models

This module defines the canonical food schema used throughout the application.
All food sources (USDA, OFF, custom) are normalized to this format.

Schema follows /memory/ARCHITECTURE.md rules:
- Nutrition stored per 100g
- Servings are gram conversion definitions
- Immutable once logged
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum


class FoodSource(str, Enum):
    """Food data source identifier."""
    USDA = "usda"
    OFF = "off"  # Open Food Facts
    CUSTOM = "custom"  # User-created
    LOCAL = "local"  # Locally cached


class ServingSize(BaseModel):
    """
    Serving size definition.
    
    A serving is ONLY a gram conversion - it defines how many grams
    correspond to one unit of this serving type.
    """
    unit: str                        # "g", "oz", "piece", "cup"
    description: str                 # "gram", "ounce", "1 breast"
    grams: float                     # Gram equivalent
    
    class Config:
        json_schema_extra = {
            "example": {
                "unit": "piece",
                "description": "1 breast",
                "grams": 120
            }
        }


class NutrientsPercentage(BaseModel):
    """Macronutrient breakdown as percentages."""
    protein_pct: float = 0
    fat_pct: float = 0
    carbs_pct: float = 0


class CanonicalFood(BaseModel):
    """
    Canonical food document schema.
    
    This is the single source of truth for food data in the system.
    All external sources are normalized to this format before storage.
    
    Key invariants:
    - All nutrition values are per 100g
    - Servings define gram conversions only
    - Source tracks data origin
    """
    # Identity
    id: str = Field(..., alias="_id")
    name: str
    normalized_name: str              # Lowercase, normalized for search
    
    # Source tracking
    source: FoodSource = FoodSource.LOCAL
    brand: Optional[str] = None
    is_branded: bool = False
    
    # Nutrition per 100g (CANONICAL)
    nutrients_per_100g: Dict[str, float] = Field(
        default_factory=lambda: {
            "calories": 0,
            "protein": 0,
            "fat": 0,
            "carbs": 0,
            "fiber": 0
        }
    )
    
    # Detailed nutrition per 100g
    amino_acids_per_100g: Dict[str, float] = Field(default_factory=dict)
    fatty_acids_per_100g: Dict[str, float] = Field(default_factory=dict)
    
    # Serving definitions
    default_serving_unit: str = "g"
    servings: List[ServingSize] = Field(default_factory=list)
    
    # Quality & ranking
    quality_score: float = 0.0        # Data completeness/accuracy (0-1)
    popularity_score: float = 0.0     # Usage frequency (0-1)
    is_verified: bool = False         # Manual verification flag
    
    # Metadata
    category: Optional[str] = None
    barcode: Optional[str] = None
    usda_fdc_id: Optional[str] = None
    
    # Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        use_enum_values = True
    
    # ==================== HELPER METHODS ====================
    
    def get_serving_grams(self, unit: str) -> float:
        """Get gram equivalent for a serving unit."""
        for serving in self.servings:
            if serving.unit == unit:
                return serving.grams
        raise ValueError(f"Unknown serving unit: {unit}")
    
    def get_default_serving(self) -> Optional[ServingSize]:
        """Get the default serving size."""
        for serving in self.servings:
            if serving.unit == self.default_serving_unit:
                return serving
        return self.servings[0] if self.servings else None
    
    def to_calculator_format(self) -> Dict:
        """
        Convert to NutritionCalculator input format.
        
        This is the bridge between canonical storage and calculation.
        """
        return {
            "name": self.name,
            "fdc_id": self.id,
            "nutrition": self.nutrients_per_100g,
            "amino_acids": self.amino_acids_per_100g,
            "fatty_acids": self.fatty_acids_per_100g,
            "base_amount": 100,
            "servings": [s.model_dump() for s in self.servings]
        }
    
    def to_api_response(self) -> Dict:
        """
        Convert to API response format.
        
        Maintains backward compatibility with existing frontend.
        """
        return {
            # Identity
            "id": self.id,
            "fdc_id": self.id,  # Alias for compatibility
            "name": self.name,
            "description": self.name,  # Alias for compatibility
            
            # Source
            "source": self.source,
            "brand": self.brand,
            "is_branded": self.is_branded,
            
            # Nutrition (flattened for backward compatibility)
            "calories": self.nutrients_per_100g.get("calories", 0),
            "protein": self.nutrients_per_100g.get("protein", 0),
            "fat": self.nutrients_per_100g.get("fat", 0),
            "carbs": self.nutrients_per_100g.get("carbs", 0),
            "fiber": self.nutrients_per_100g.get("fiber", 0),
            
            # Also include structured format
            "nutrients_per_100g": self.nutrients_per_100g,
            "amino_acids_per_100g": self.amino_acids_per_100g,
            "fatty_acids_per_100g": self.fatty_acids_per_100g,
            
            # Servings
            "default_serving_unit": self.default_serving_unit,
            "servings": [s.model_dump() for s in self.servings],
            
            # Scores
            "quality_score": self.quality_score,
            "popularity_score": self.popularity_score,
            "is_verified": self.is_verified,
            
            # Metadata
            "category": self.category,
            "barcode": self.barcode
        }


class CanonicalFoodCreate(BaseModel):
    """Request body for creating a canonical food."""
    id: str
    name: str
    source: FoodSource = FoodSource.LOCAL
    brand: Optional[str] = None
    is_branded: bool = False
    
    nutrients_per_100g: Dict[str, float]
    amino_acids_per_100g: Dict[str, float] = Field(default_factory=dict)
    fatty_acids_per_100g: Dict[str, float] = Field(default_factory=dict)
    
    default_serving_unit: str = "g"
    servings: List[ServingSize] = Field(default_factory=list)
    
    category: Optional[str] = None
    barcode: Optional[str] = None


class CanonicalFoodUpdate(BaseModel):
    """Request body for updating a canonical food."""
    name: Optional[str] = None
    brand: Optional[str] = None
    is_branded: Optional[bool] = None
    
    nutrients_per_100g: Optional[Dict[str, float]] = None
    amino_acids_per_100g: Optional[Dict[str, float]] = None
    fatty_acids_per_100g: Optional[Dict[str, float]] = None
    
    default_serving_unit: Optional[str] = None
    servings: Optional[List[ServingSize]] = None
    
    quality_score: Optional[float] = None
    is_verified: Optional[bool] = None
    category: Optional[str] = None


# ==================== UTILITY FUNCTIONS ====================

def normalize_food_name(name: str) -> str:
    """
    Normalize a food name for search/matching.
    
    - Lowercase
    - Remove extra whitespace
    - Remove special characters
    """
    import re
    normalized = name.lower().strip()
    normalized = re.sub(r'[^\w\s]', '', normalized)
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized


def calculate_quality_score(food: Dict) -> float:
    """
    Calculate data quality score based on completeness.
    
    Factors:
    - Has all macros: +0.3
    - Has amino acids: +0.2
    - Has fatty acids: +0.2
    - Has servings: +0.2
    - Has brand/source: +0.1
    """
    score = 0.0
    
    nutrients = food.get("nutrients_per_100g", {})
    if all(k in nutrients for k in ["calories", "protein", "fat", "carbs"]):
        score += 0.3
    
    if food.get("amino_acids_per_100g"):
        score += 0.2
    
    if food.get("fatty_acids_per_100g"):
        score += 0.2
    
    if food.get("servings") and len(food["servings"]) > 1:
        score += 0.2
    
    if food.get("source") and food["source"] != "local":
        score += 0.1
    
    return round(score, 2)
