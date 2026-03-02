from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class AminoAcid(BaseModel):
    name: str
    value: float
    unit: str = "g"
    is_essential: bool

class FoodSearchResult(BaseModel):
    fdc_id: str
    description: str
    brand_owner: Optional[str] = None
    data_type: str
    protein_per_100g: float = 0

class FoodDetail(BaseModel):
    fdc_id: str
    description: str
    brand_owner: Optional[str] = None
    serving_size: float = 100
    serving_unit: str = "g"
    calories: float = 0
    protein: float = 0
    fat: float = 0
    carbs: float = 0
    fiber: float = 0
    amino_acids: List[AminoAcid] = []
    is_complete_protein: bool = False
    missing_amino_acids: List[str] = []
    protein_quality_score: float = 0

class FoodLogCreate(BaseModel):
    fdc_id: str
    description: str
    serving_size: float
    serving_unit: str = "g"
    servings: float = 1
    calories: float = 0
    protein: float = 0
    fat: float = 0
    carbs: float = 0
    fiber: float = 0
    amino_acids: List[Dict[str, Any]] = []
    meal_type: str = "snack"
    logged_at: Optional[datetime] = None

class FoodLogResponse(BaseModel):
    id: str
    user_id: str
    fdc_id: str
    description: str
    serving_size: float
    serving_unit: str
    servings: float
    calories: float
    protein: float
    fat: float
    carbs: float
    fiber: float
    amino_acids: List[Dict[str, Any]]
    meal_type: str
    logged_at: datetime
    created_at: datetime

class BarcodeProduct(BaseModel):
    barcode: str
    product_name: Optional[str] = None
    brand: Optional[str] = None
    protein_per_100g: float = 0
    calories_per_100g: float = 0
    fat_per_100g: float = 0
    carbs_per_100g: float = 0
    fiber_per_100g: float = 0
    image_url: Optional[str] = None
    source: str = "open_food_facts"
