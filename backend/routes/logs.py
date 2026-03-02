from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
from core.database import db
from core.security import get_current_user
from models.food import FoodLogCreate, FoodLogResponse

router = APIRouter(prefix="/logs", tags=["Food Logs"])

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
        "meal_type": log_data.meal_type,
        "logged_at": logged_at.isoformat() if isinstance(logged_at, datetime) else logged_at,
        "created_at": now.isoformat()
    }
    
    await db.food_logs.insert_one(log_doc)
    
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
