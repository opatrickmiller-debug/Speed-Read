from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import httpx
import asyncio
from core.database import db
from core.security import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/custom-foods", tags=["Custom Foods"])

class CustomFoodCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    serving_size: float = 100
    serving_unit: str = "g"
    calories: float = 0
    protein: float = 0
    fat: float = 0
    carbs: float = 0
    fiber: float = 0
    sugar: Optional[float] = None
    sodium: Optional[float] = None
    notes: Optional[str] = None

class CustomFoodResponse(BaseModel):
    id: str
    user_id: str
    name: str
    brand: Optional[str]
    serving_size: float
    serving_unit: str
    calories: float
    protein: float
    fat: float
    carbs: float
    fiber: float
    sugar: Optional[float]
    sodium: Optional[float]
    notes: Optional[str]
    created_at: datetime

@router.post("", response_model=CustomFoodResponse)
async def create_custom_food(food_data: CustomFoodCreate, current_user: dict = Depends(get_current_user)):
    """Create a custom food entry"""
    food_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    food_doc = {
        "id": food_id,
        "user_id": current_user["id"],
        "name": food_data.name,
        "brand": food_data.brand,
        "serving_size": food_data.serving_size,
        "serving_unit": food_data.serving_unit,
        "calories": food_data.calories,
        "protein": food_data.protein,
        "fat": food_data.fat,
        "carbs": food_data.carbs,
        "fiber": food_data.fiber,
        "sugar": food_data.sugar,
        "sodium": food_data.sodium,
        "notes": food_data.notes,
        "created_at": now.isoformat()
    }
    
    await db.custom_foods.insert_one(food_doc)
    
    return CustomFoodResponse(
        id=food_id,
        user_id=current_user["id"],
        name=food_data.name,
        brand=food_data.brand,
        serving_size=food_data.serving_size,
        serving_unit=food_data.serving_unit,
        calories=food_data.calories,
        protein=food_data.protein,
        fat=food_data.fat,
        carbs=food_data.carbs,
        fiber=food_data.fiber,
        sugar=food_data.sugar,
        sodium=food_data.sodium,
        notes=food_data.notes,
        created_at=now
    )

@router.get("", response_model=List[CustomFoodResponse])
async def get_custom_foods(current_user: dict = Depends(get_current_user)):
    """Get all custom foods for the current user"""
    foods = await db.custom_foods.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(500)
    
    result = []
    for food in foods:
        created_at = food.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        result.append(CustomFoodResponse(
            id=food["id"],
            user_id=food["user_id"],
            name=food["name"],
            brand=food.get("brand"),
            serving_size=food.get("serving_size", 100),
            serving_unit=food.get("serving_unit", "g"),
            calories=food.get("calories", 0),
            protein=food.get("protein", 0),
            fat=food.get("fat", 0),
            carbs=food.get("carbs", 0),
            fiber=food.get("fiber", 0),
            sugar=food.get("sugar"),
            sodium=food.get("sodium"),
            notes=food.get("notes"),
            created_at=created_at
        ))
    
    return result

@router.get("/{food_id}", response_model=CustomFoodResponse)
async def get_custom_food(food_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific custom food"""
    food = await db.custom_foods.find_one({"id": food_id, "user_id": current_user["id"]}, {"_id": 0})
    if not food:
        raise HTTPException(status_code=404, detail="Custom food not found")
    
    created_at = food.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return CustomFoodResponse(
        id=food["id"],
        user_id=food["user_id"],
        name=food["name"],
        brand=food.get("brand"),
        serving_size=food.get("serving_size", 100),
        serving_unit=food.get("serving_unit", "g"),
        calories=food.get("calories", 0),
        protein=food.get("protein", 0),
        fat=food.get("fat", 0),
        carbs=food.get("carbs", 0),
        fiber=food.get("fiber", 0),
        sugar=food.get("sugar"),
        sodium=food.get("sodium"),
        notes=food.get("notes"),
        created_at=created_at
    )

@router.put("/{food_id}", response_model=CustomFoodResponse)
async def update_custom_food(food_id: str, food_data: CustomFoodCreate, current_user: dict = Depends(get_current_user)):
    """Update a custom food"""
    existing = await db.custom_foods.find_one({"id": food_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Custom food not found")
    
    update_data = {
        "name": food_data.name,
        "brand": food_data.brand,
        "serving_size": food_data.serving_size,
        "serving_unit": food_data.serving_unit,
        "calories": food_data.calories,
        "protein": food_data.protein,
        "fat": food_data.fat,
        "carbs": food_data.carbs,
        "fiber": food_data.fiber,
        "sugar": food_data.sugar,
        "sodium": food_data.sodium,
        "notes": food_data.notes
    }
    
    await db.custom_foods.update_one({"id": food_id}, {"$set": update_data})
    
    created_at = existing.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return CustomFoodResponse(
        id=food_id,
        user_id=current_user["id"],
        name=food_data.name,
        brand=food_data.brand,
        serving_size=food_data.serving_size,
        serving_unit=food_data.serving_unit,
        calories=food_data.calories,
        protein=food_data.protein,
        fat=food_data.fat,
        carbs=food_data.carbs,
        fiber=food_data.fiber,
        sugar=food_data.sugar,
        sodium=food_data.sodium,
        notes=food_data.notes,
        created_at=created_at
    )

@router.delete("/{food_id}")
async def delete_custom_food(food_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a custom food"""
    result = await db.custom_foods.delete_one({"id": food_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom food not found")
    return {"message": "Custom food deleted"}
