from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    protein_goal: float = 150.0
    daily_carb_limit: float = 20.0
    body_weight_kg: float = 70.0
    body_fat_percentage: float = 20.0
    protein_per_kg_lbm: float = 2.0
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserSettingsUpdate(BaseModel):
    protein_goal: Optional[float] = Field(None, gt=0)
    daily_carb_limit: Optional[float] = Field(None, ge=0)
    body_weight_kg: Optional[float] = Field(None, gt=0)
    body_fat_percentage: Optional[float] = Field(None, ge=0, le=100)
    protein_per_kg_lbm: Optional[float] = Field(None, gt=0)

class ProteinGoalUpdate(BaseModel):
    protein_goal: float = Field(gt=0)
