from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class MealPlanCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    foods: List[Dict[str, Any]]

class MealPlanResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str
    foods: List[Dict[str, Any]]
    total_protein: float
    total_calories: float
    created_at: datetime

class CustomMealCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    foods: List[Dict[str, Any]]

class CustomMealResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str
    foods: List[Dict[str, Any]]
    total_protein: float
    total_carbs: float
    total_fat: float
    total_calories: float
    is_complete_protein: bool
    keto_tier: str
    created_at: datetime

class FavoriteCreate(BaseModel):
    fdc_id: str
    description: str
    protein_per_100g: float = 0
    is_complete_protein: bool = False

class FavoriteResponse(BaseModel):
    id: str
    user_id: str
    fdc_id: str
    description: str
    protein_per_100g: float
    is_complete_protein: bool
    created_at: datetime
