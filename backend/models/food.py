from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class AminoAcid(BaseModel):
    name: str
    value: float
    unit: str = "g"
    is_essential: bool

class FattyAcid(BaseModel):
    name: str
    value: float
    unit: str = "g"
    is_essential: bool
    omega_type: Optional[int] = None  # 3 or 6 for omega classification

class ServingSize(BaseModel):
    """Represents a serving size option from USDA foodPortions"""
    label: str          # e.g., "1 large egg", "1 cup"
    grams: float        # Weight in grams
    modifier: str = ""  # Original modifier from USDA (e.g., "large", "medium")

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
    fatty_acids: List[FattyAcid] = []
    is_complete_protein: bool = False
    missing_amino_acids: List[str] = []
    protein_quality_score: float = 0
    omega3_total: float = 0
    omega6_total: float = 0
    omega_ratio: Optional[str] = None  # e.g., "1:4" (omega3:omega6)
    servings: List[ServingSize] = []   # Available serving options from USDA

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
    fatty_acids: List[Dict[str, Any]] = []
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
    fatty_acids: List[Dict[str, Any]] = []
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
