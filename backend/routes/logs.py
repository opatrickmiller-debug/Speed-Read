from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from enum import Enum
import uuid
from core.database import db
from core.security import get_current_user
from models.food import FoodLogCreate, FoodLogResponse
from routes.popularity import track_food_log
from services.fdc_client import fdc_client
from services.nutrition_calculator import NutritionCalculator, food_to_calculator_format

router = APIRouter(prefix="/logs", tags=["Food Logs"])


class MealType(str, Enum):
    breakfast = "breakfast"
    lunch = "lunch"
    dinner = "dinner"
    snack = "snack"


class SimpleFoodLog(BaseModel):
    """Simplified food log request - server fetches nutrition data"""
    food_id: str
    amount: float = 100  # grams
    meal: MealType = MealType.snack


class ServingFoodLog(BaseModel):
    """Food log using serving unit (like MyFitnessPal)"""
    food_id: str
    amount: float = 1.0        # Number of servings
    serving_index: int = 0     # Index into food's servings array
    meal: MealType = MealType.snack


@router.post("/quick")
async def quick_log_food(log_data: SimpleFoodLog, current_user: dict = Depends(get_current_user)):
    """
    Quick food logging with minimal payload.
    Server fetches full nutrition data from the food_id.
    
    Body:
    {
      "food_id": "171534",
      "amount": 100,
      "meal": "breakfast" | "lunch" | "dinner" | "snack"
    }
    """
    food_details = None
    source = "usda"
    
    # Check if it's a custom food
    if log_data.food_id.startswith("custom:"):
        custom_id = log_data.food_id.replace("custom:", "")
        custom_food = await db.custom_foods.find_one(
            {"id": custom_id, "user_id": current_user["id"]},
            {"_id": 0}
        )
        if custom_food:
            food_details = {
                "fdc_id": log_data.food_id,
                "description": custom_food.get("name", "Custom Food"),
                "calories": custom_food.get("calories", 0),
                "protein": custom_food.get("protein", 0),
                "fat": custom_food.get("fat", 0),
                "carbs": custom_food.get("carbs", 0),
                "fiber": custom_food.get("fiber", 0),
                "amino_acids": custom_food.get("amino_acids", []),
                "fatty_acids": custom_food.get("fatty_acids", []),
            }
            source = "custom"
    else:
        # Fetch from USDA
        try:
            usda_raw = await fdc_client.get_food_details(log_data.food_id)
            if usda_raw:
                # Extract nutrients using the FDC client helper methods
                # Nutrient IDs: Energy=1008, Protein=1003, Fat=1004, Carbs=1005, Fiber=1079
                calories = fdc_client.extract_nutrient(usda_raw, 1008)
                protein = fdc_client.extract_nutrient(usda_raw, 1003)
                fat = fdc_client.extract_nutrient(usda_raw, 1004)
                carbs = fdc_client.extract_nutrient(usda_raw, 1005)
                fiber = fdc_client.extract_nutrient(usda_raw, 1079)
                
                # Extract amino acids and fatty acids
                amino_acids = fdc_client.extract_amino_acids(usda_raw)
                fatty_acids = fdc_client.extract_fatty_acids(usda_raw)
                
                food_details = {
                    "fdc_id": log_data.food_id,
                    "description": usda_raw.get("description", "Unknown Food"),
                    "calories": calories,
                    "protein": protein,
                    "fat": fat,
                    "carbs": carbs,
                    "fiber": fiber,
                    "amino_acids": [{"name": aa.name, "value": aa.value, "is_essential": aa.is_essential} for aa in amino_acids],
                    "fatty_acids": [{"name": fa.name, "value": fa.value, "is_essential": fa.is_essential, "omega_type": fa.omega_type} for fa in fatty_acids],
                }
        except Exception as e:
            print(f"Error fetching USDA food: {e}")
    
    if not food_details:
        raise HTTPException(status_code=404, detail="Food not found")
    
    # Calculate nutrition based on amount (values are per 100g)
    multiplier = log_data.amount / 100
    
    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Build log document
    log_doc = {
        "id": log_id,
        "user_id": current_user["id"],
        "fdc_id": log_data.food_id,
        "description": food_details.get("description", "Unknown Food"),
        "serving_size": log_data.amount,
        "serving_unit": "g",
        "servings": 1,
        "calories": round((food_details.get("calories", 0) or 0) * multiplier, 1),
        "protein": round((food_details.get("protein", 0) or 0) * multiplier, 2),
        "fat": round((food_details.get("fat", 0) or 0) * multiplier, 2),
        "carbs": round((food_details.get("carbs", 0) or 0) * multiplier, 2),
        "fiber": round((food_details.get("fiber", 0) or 0) * multiplier, 2),
        "amino_acids": [
            {
                "name": aa.get("name"),
                "value": round((aa.get("value", 0) or 0) * multiplier, 3),
                "is_essential": aa.get("is_essential", False)
            }
            for aa in food_details.get("amino_acids", [])
        ],
        "fatty_acids": [
            {
                "name": fa.get("name"),
                "value": round((fa.get("value", 0) or 0) * multiplier, 3),
                "is_essential": fa.get("is_essential", False),
                "omega_type": fa.get("omega_type")
            }
            for fa in food_details.get("fatty_acids", [])
        ],
        "meal_type": log_data.meal.value,
        "logged_at": now.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.food_logs.insert_one(log_doc)
    
    # Track food popularity
    await track_food_log(log_data.food_id, food_details.get("description", ""), source)
    
    return {
        "success": True,
        "message": f"Added {food_details.get('description', 'food')[:30]} to {log_data.meal.value}",
        "log_id": log_id,
        "nutrition": {
            "calories": log_doc["calories"],
            "protein": log_doc["protein"],
            "fat": log_doc["fat"],
            "carbs": log_doc["carbs"]
        }
    }


@router.post("/serving")
async def log_food_by_serving(log_data: ServingFoodLog, current_user: dict = Depends(get_current_user)):
    """
    Log food using serving unit selection (MyFitnessPal style).
    
    Body:
    {
      "food_id": "171287",
      "amount": 2,              // 2 servings
      "serving_index": 3,       // Index into servings array (e.g., "1 large egg")
      "meal": "breakfast"
    }
    
    The server will:
    1. Fetch food details including servings array
    2. Look up the serving at serving_index
    3. Calculate: grams = amount × serving.grams
    4. Calculate nutrition based on grams
    """
    # Fetch food details
    usda_raw = await fdc_client.get_food_details(log_data.food_id)
    if not usda_raw:
        raise HTTPException(status_code=404, detail="Food not found")
    
    # Parse food to get servings
    food_detail = fdc_client.parse_food_detail(usda_raw)
    
    # Validate serving index
    if log_data.serving_index >= len(food_detail.servings):
        raise HTTPException(status_code=400, detail=f"Invalid serving_index. Food has {len(food_detail.servings)} servings.")
    
    # Get selected serving
    selected_serving = food_detail.servings[log_data.serving_index]
    
    # Convert to calculator format and calculate
    calc_format = food_to_calculator_format({
        "fdc_id": food_detail.fdc_id,
        "description": food_detail.description,
        "calories": food_detail.calories,
        "protein": food_detail.protein,
        "fat": food_detail.fat,
        "carbs": food_detail.carbs,
        "fiber": food_detail.fiber,
        "servings": [{"unit": s.unit, "description": s.description, "grams": s.grams} for s in food_detail.servings]
    })
    
    calculator = NutritionCalculator(calc_format)
    
    # Find the unit key for this serving
    serving_unit = None
    for unit, serving_data in calculator.servings.items():
        if abs(serving_data["grams"] - selected_serving.grams) < 0.1:
            serving_unit = unit
            break
    
    if not serving_unit:
        # Fallback to gram calculation
        grams = log_data.amount * selected_serving.grams
        result = calculator.calculate_from_grams(grams)
    else:
        result = calculator.calculate_nutrition(log_data.amount, serving_unit)
    
    grams = result["grams"]
    nutrition = result["nutrition"]
    
    # Extract amino acids and fatty acids with multiplier
    multiplier = grams / 100
    amino_acids = fdc_client.extract_amino_acids(usda_raw)
    fatty_acids = fdc_client.extract_fatty_acids(usda_raw)
    
    # Build log document
    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    serving_desc = selected_serving.description or f"{selected_serving.unit} ({selected_serving.grams}g)"
    
    log_doc = {
        "id": log_id,
        "user_id": current_user["id"],
        "fdc_id": log_data.food_id,
        "description": food_detail.description,
        "serving_size": grams,
        "serving_unit": "g",
        "serving_description": f"{log_data.amount} × {serving_desc}",
        "servings": log_data.amount,
        "calories": nutrition.get("calories", 0),
        "protein": nutrition.get("protein", 0),
        "fat": nutrition.get("fat", 0),
        "carbs": nutrition.get("carbs", 0),
        "fiber": nutrition.get("fiber", 0),
        "amino_acids": [
            {
                "name": aa.name,
                "value": round(aa.value * multiplier, 3),
                "is_essential": aa.is_essential
            }
            for aa in amino_acids
        ],
        "fatty_acids": [
            {
                "name": fa.name,
                "value": round(fa.value * multiplier, 3),
                "is_essential": fa.is_essential,
                "omega_type": fa.omega_type
            }
            for fa in fatty_acids
        ],
        "meal_type": log_data.meal.value,
        "logged_at": now.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.food_logs.insert_one(log_doc)
    
    # Track food popularity
    await track_food_log(log_data.food_id, food_detail.description, "usda")
    
    return {
        "success": True,
        "message": f"Added {log_data.amount} × {serving_desc} to {log_data.meal.value}",
        "log_id": log_id,
        "grams": grams,
        "serving_description": f"{log_data.amount} × {serving_desc}",
        "nutrition": nutrition
    }


@router.post("", response_model=FoodLogResponse)
async def create_food_log(log_data: FoodLogCreate, current_user: dict = Depends(get_current_user)):
    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    logged_at = log_data.logged_at or now
    
    log_doc = {
        "id": log_id,
        "user_id": current_user["id"],
        "fdc_id": log_data.fdc_id,
        "description": log_data.description,
        "serving_size": log_data.serving_size,
        "serving_unit": log_data.serving_unit,
        "servings": log_data.servings,
        "calories": log_data.calories,
        "protein": log_data.protein,
        "fat": log_data.fat,
        "carbs": log_data.carbs,
        "fiber": log_data.fiber,
        "amino_acids": log_data.amino_acids,
        "fatty_acids": log_data.fatty_acids,
        "meal_type": log_data.meal_type,
        "logged_at": logged_at.isoformat() if isinstance(logged_at, datetime) else logged_at,
        "created_at": now.isoformat()
    }
    
    await db.food_logs.insert_one(log_doc)
    
    # Track food popularity for search ranking
    await track_food_log(log_data.fdc_id, log_data.description, "usda")
    
    return FoodLogResponse(
        id=log_id,
        user_id=current_user["id"],
        fdc_id=log_data.fdc_id,
        description=log_data.description,
        serving_size=log_data.serving_size,
        serving_unit=log_data.serving_unit,
        servings=log_data.servings,
        calories=log_data.calories,
        protein=log_data.protein,
        fat=log_data.fat,
        carbs=log_data.carbs,
        fiber=log_data.fiber,
        amino_acids=log_data.amino_acids,
        fatty_acids=log_data.fatty_acids,
        meal_type=log_data.meal_type,
        logged_at=logged_at if isinstance(logged_at, datetime) else datetime.fromisoformat(logged_at),
        created_at=now
    )

@router.get("", response_model=List[FoodLogResponse])
async def get_food_logs(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    
    if date:
        start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        query["logged_at"] = {
            "$gte": start.isoformat(),
            "$lt": end.isoformat()
        }
    
    logs = await db.food_logs.find(query, {"_id": 0}).sort("logged_at", -1).to_list(500)
    
    result = []
    for log in logs:
        logged_at = log.get("logged_at")
        created_at = log.get("created_at")
        
        if isinstance(logged_at, str):
            logged_at = datetime.fromisoformat(logged_at)
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        result.append(FoodLogResponse(
            id=log["id"],
            user_id=log["user_id"],
            fdc_id=log["fdc_id"],
            description=log["description"],
            serving_size=log["serving_size"],
            serving_unit=log["serving_unit"],
            servings=log["servings"],
            calories=log.get("calories", 0),
            protein=log.get("protein", 0),
            fat=log.get("fat", 0),
            carbs=log.get("carbs", 0),
            fiber=log.get("fiber", 0),
            amino_acids=log.get("amino_acids", []),
            fatty_acids=log.get("fatty_acids", []),
            meal_type=log.get("meal_type", "snack"),
            logged_at=logged_at,
            created_at=created_at
        ))
    
    return result

@router.delete("/{log_id}")
async def delete_food_log(log_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.food_logs.delete_one({"id": log_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    return {"message": "Log deleted"}
