"""
Stored Foods Routes

Hybrid food storage: check local MongoDB first, fallback to USDA.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone

from core.database import db
from core.security import get_current_user
from models.stored_food import StoredFoodCreate, StoredFoodUpdate
from services.nutrition_calculator import NutritionCalculator
from services.fdc_client import fdc_client

router = APIRouter(prefix="/stored-foods", tags=["Stored Foods"])


# ==================== HYBRID LOOKUP FUNCTION ====================

async def get_food_hybrid(food_id: str) -> Optional[dict]:
    """
    Hybrid food lookup: check local DB first, fallback to USDA.
    
    Returns food in NutritionCalculator-compatible format.
    """
    # 1. Check local MongoDB first
    local_food = await db.foods.find_one({"_id": food_id})
    if local_food:
        return {
            "id": local_food["_id"],
            "name": local_food["name"],
            "nutrition": local_food.get("nutrition", {}),
            "amino_acids": local_food.get("amino_acids", {}),
            "fatty_acids": local_food.get("fatty_acids", {}),
            "base_amount": local_food.get("base_amount", 100),
            "servings": local_food.get("servings", []),
            "source": "local"
        }
    
    # 2. Fallback to USDA
    usda_raw = await fdc_client.get_food_details(food_id)
    if usda_raw:
        food_detail = fdc_client.parse_food_detail(usda_raw)
        amino_acids = fdc_client.extract_amino_acids(usda_raw)
        fatty_acids = fdc_client.extract_fatty_acids(usda_raw)
        
        return {
            "id": food_detail.fdc_id,
            "name": food_detail.description,
            "nutrition": {
                "calories": food_detail.calories,
                "protein": food_detail.protein,
                "fat": food_detail.fat,
                "carbs": food_detail.carbs,
                "fiber": food_detail.fiber
            },
            "amino_acids": {aa.name: aa.value for aa in amino_acids},
            "fatty_acids": {fa.name: fa.value for fa in fatty_acids},
            "base_amount": 100,
            "servings": [
                {"unit": s.unit, "description": s.description, "grams": s.grams}
                for s in food_detail.servings
            ],
            "source": "usda"
        }
    
    return None


# ==================== STATIC ROUTES (must come before dynamic /{food_id}) ====================

@router.get("/calculate")
async def calculate_nutrition_hybrid(
    food_id: str = Query(...),
    amount: float = Query(1.0),
    unit: str = Query("g"),
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate nutrition using hybrid lookup (local DB → USDA fallback).
    
    Query params:
    - food_id: Local ID (e.g., "egg") or USDA FDC ID (e.g., "171287")
    - amount: Number of servings
    - unit: Serving unit (e.g., "egg", "cup", "g")
    """
    food = await get_food_hybrid(food_id)
    
    if not food:
        raise HTTPException(status_code=404, detail=f"Food '{food_id}' not found")
    
    try:
        calculator = NutritionCalculator(food)
        result = calculator.calculate_nutrition(amount, unit)
        result["source"] = food.get("source", "unknown")
        return result
    except ValueError as e:
        available = list(calculator.servings.keys()) if 'calculator' in dir() else []
        raise HTTPException(
            status_code=400,
            detail=f"{str(e)}. Available units: {available}"
        )


@router.post("/import/{fdc_id}")
async def import_from_usda(
    fdc_id: str,
    custom_id: Optional[str] = Query(None, description="Custom ID for the food"),
    current_user: dict = Depends(get_current_user)
):
    """Import a food from USDA into local database."""
    usda_raw = await fdc_client.get_food_details(fdc_id)
    if not usda_raw:
        raise HTTPException(status_code=404, detail=f"USDA food '{fdc_id}' not found")
    
    food_detail = fdc_client.parse_food_detail(usda_raw)
    amino_acids = fdc_client.extract_amino_acids(usda_raw)
    fatty_acids = fdc_client.extract_fatty_acids(usda_raw)
    
    food_id = custom_id or fdc_id
    
    existing = await db.foods.find_one({"_id": food_id})
    if existing:
        raise HTTPException(status_code=409, detail=f"Food '{food_id}' already exists")
    
    now = datetime.now(timezone.utc)
    doc = {
        "_id": food_id,
        "name": food_detail.description,
        "nutrition": {
            "calories": food_detail.calories,
            "protein": food_detail.protein,
            "fat": food_detail.fat,
            "carbs": food_detail.carbs,
            "fiber": food_detail.fiber
        },
        "amino_acids": {aa.name: aa.value for aa in amino_acids},
        "fatty_acids": {fa.name: fa.value for fa in fatty_acids},
        "base_amount": 100,
        "servings": [
            {"unit": s.unit, "description": s.description, "grams": s.grams}
            for s in food_detail.servings
        ],
        "source": "usda",
        "usda_fdc_id": fdc_id,
        "created_at": now,
        "updated_at": now
    }
    
    await db.foods.insert_one(doc)
    
    return {
        "success": True,
        "id": food_id,
        "name": food_detail.description,
        "message": f"Imported '{food_detail.description}' from USDA"
    }


# ==================== CRUD OPERATIONS ====================

@router.post("")
async def create_stored_food(
    food: StoredFoodCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new stored food in local database."""
    existing = await db.foods.find_one({"_id": food.id})
    if existing:
        raise HTTPException(status_code=409, detail=f"Food with id '{food.id}' already exists")
    
    now = datetime.now(timezone.utc)
    doc = {
        "_id": food.id,
        "name": food.name,
        "nutrition": food.nutrition,
        "amino_acids": food.amino_acids,
        "fatty_acids": food.fatty_acids,
        "base_amount": food.base_amount,
        "servings": [s.dict() for s in food.servings],
        "brand": food.brand,
        "category": food.category,
        "source": "local",
        "created_at": now,
        "updated_at": now
    }
    
    await db.foods.insert_one(doc)
    
    return {"success": True, "id": food.id, "message": f"Food '{food.name}' created"}


@router.get("")
async def list_stored_foods(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """List all stored foods with optional filtering."""
    query = {}
    
    if category:
        query["category"] = category
    
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    cursor = db.foods.find(query).limit(limit)
    foods = []
    
    async for doc in cursor:
        foods.append({
            "id": doc["_id"],
            "name": doc["name"],
            "nutrition": doc.get("nutrition", {}),
            "category": doc.get("category"),
            "source": doc.get("source", "local")
        })
    
    return {"foods": foods, "count": len(foods)}


# ==================== DYNAMIC ROUTES (must come after static routes) ====================

@router.get("/{food_id}")
async def get_stored_food(
    food_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific stored food by ID."""
    doc = await db.foods.find_one({"_id": food_id})
    
    if not doc:
        raise HTTPException(status_code=404, detail=f"Food '{food_id}' not found")
    
    return {
        "id": doc["_id"],
        "name": doc["name"],
        "nutrition": doc.get("nutrition", {}),
        "amino_acids": doc.get("amino_acids", {}),
        "fatty_acids": doc.get("fatty_acids", {}),
        "base_amount": doc.get("base_amount", 100),
        "servings": doc.get("servings", []),
        "brand": doc.get("brand"),
        "category": doc.get("category"),
        "source": doc.get("source", "local")
    }


@router.put("/{food_id}")
async def update_stored_food(
    food_id: str,
    update: StoredFoodUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing stored food."""
    doc = await db.foods.find_one({"_id": food_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Food '{food_id}' not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if update.name is not None:
        update_data["name"] = update.name
    if update.nutrition is not None:
        update_data["nutrition"] = update.nutrition
    if update.amino_acids is not None:
        update_data["amino_acids"] = update.amino_acids
    if update.fatty_acids is not None:
        update_data["fatty_acids"] = update.fatty_acids
    if update.base_amount is not None:
        update_data["base_amount"] = update.base_amount
    if update.servings is not None:
        update_data["servings"] = [s.dict() for s in update.servings]
    if update.brand is not None:
        update_data["brand"] = update.brand
    if update.category is not None:
        update_data["category"] = update.category
    
    await db.foods.update_one({"_id": food_id}, {"$set": update_data})
    
    return {"success": True, "id": food_id, "message": "Food updated"}


@router.delete("/{food_id}")
async def delete_stored_food(
    food_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a stored food."""
    result = await db.foods.delete_one({"_id": food_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Food '{food_id}' not found")
    
    return {"success": True, "id": food_id, "message": "Food deleted"}
