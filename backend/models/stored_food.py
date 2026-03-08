from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import datetime


class ServingSize(BaseModel):
    unit: str
    description: Optional[str] = None
    grams: float


class StoredFood(BaseModel):
    """Food document stored in MongoDB for fast local access."""
    id: str = Field(..., alias="_id")
    name: str
    nutrition: Dict[str, float]  # calories, protein, fat, carbs, fiber
    amino_acids: Dict[str, float] = {}
    fatty_acids: Dict[str, float] = {}
    base_amount: float = 100
    servings: List[ServingSize] = []
    
    # Optional metadata
    brand: Optional[str] = None
    category: Optional[str] = None
    source: str = "local"  # local, usda, off
    usda_fdc_id: Optional[str] = None  # Link to USDA if imported
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class StoredFoodCreate(BaseModel):
    """Request body for creating a stored food."""
    id: str  # Custom ID like "egg", "chicken_breast"
    name: str
    nutrition: Dict[str, float]
    amino_acids: Dict[str, float] = {}
    fatty_acids: Dict[str, float] = {}
    base_amount: float = 100
    servings: List[ServingSize] = []
    brand: Optional[str] = None
    category: Optional[str] = None


class StoredFoodUpdate(BaseModel):
    """Request body for updating a stored food."""
    name: Optional[str] = None
    nutrition: Optional[Dict[str, float]] = None
    amino_acids: Optional[Dict[str, float]] = None
    fatty_acids: Optional[Dict[str, float]] = None
    base_amount: Optional[float] = None
    servings: Optional[List[ServingSize]] = None
    brand: Optional[str] = None
    category: Optional[str] = None
