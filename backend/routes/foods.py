from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from core.database import db
from core.security import get_current_user
from models.food import FoodLogCreate, FoodLogResponse
from services.fdc_client import fdc_client

router = APIRouter(prefix="/foods", tags=["Foods"])

@router.get("/search")
async def search_foods(
    query: str = Query(..., min_length=1),
    page_size: int = Query(25, ge=1, le=100),
    page: int = Query(1, ge=1),
    data_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    # Reliable data types that always have details available
    RELIABLE_DATA_TYPES = {"SR Legacy", "Foundation", "Survey (FNDDS)"}
    
    result = await fdc_client.search_foods(query, page_size, page, data_type)
    
    foods = []
    for food in result.get("foods", []):
        food_data_type = food.get("dataType", "")
        
        # Only include foods from reliable data sources
        if food_data_type not in RELIABLE_DATA_TYPES:
            continue
            
        protein = 0
        for nutrient in food.get("foodNutrients", []):
            if nutrient.get("nutrientId") == 1003:
                protein = nutrient.get("value", 0) or 0
                break
        
        foods.append({
            "fdc_id": str(food.get("fdcId", "")),
            "description": food.get("description", ""),
            "brand_owner": food.get("brandOwner"),
            "data_type": food_data_type,
            "protein_per_100g": round(protein, 2)
        })
    
    return {
        "foods": foods,
        "total_hits": len(foods),
        "current_page": page,
        "page_size": page_size
    }

@router.get("/{fdc_id}")
async def get_food_details(fdc_id: str, current_user: dict = Depends(get_current_user)):
    food_data = await fdc_client.get_food_details(fdc_id)
    if not food_data:
        raise HTTPException(status_code=404, detail="Food not found")
    
    food_detail = fdc_client.parse_food_detail(food_data)
    return food_detail
