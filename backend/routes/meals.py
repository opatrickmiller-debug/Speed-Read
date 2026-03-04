from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
from core.database import db
from core.security import get_current_user
from core.constants import ESSENTIAL_AMINO_ACIDS
from models.meal import MealPlanCreate, MealPlanResponse, CustomMealCreate, CustomMealResponse, FavoriteCreate, FavoriteResponse
from services.fdc_client import fdc_client

router = APIRouter(tags=["Meals"])

# Meal Builder
@router.post("/meal-builder/analyze")
async def analyze_meal_combo(
    food_ids: List[str] = Query(..., description="List of FDC IDs to combine"),
    current_user: dict = Depends(get_current_user)
):
    combined_amino_acids = {}
    total_protein = 0
    total_carbs = 0
    total_fat = 0
    total_calories = 0
    foods_data = []
    
    for fdc_id in food_ids[:10]:
        food_data = await fdc_client.get_food_details(fdc_id)
        if not food_data:
            continue
        
        food_detail = fdc_client.parse_food_detail(food_data)
        foods_data.append({
            "fdc_id": fdc_id,
            "name": food_detail.description,
            "protein": food_detail.protein,
            "carbs": food_detail.carbs,
            "fat": food_detail.fat,
            "calories": food_detail.calories
        })
        
        total_protein += food_detail.protein
        total_carbs += food_detail.carbs
        total_fat += food_detail.fat
        total_calories += food_detail.calories
        
        for aa in food_detail.amino_acids:
            combined_amino_acids[aa.name] = combined_amino_acids.get(aa.name, 0) + aa.value
    
    essential_present = []
    essential_missing = []
    for aa_name in ESSENTIAL_AMINO_ACIDS.keys():
        if combined_amino_acids.get(aa_name, 0) > 0:
            essential_present.append(aa_name)
        else:
            essential_missing.append(aa_name)
    
    is_complete = len(essential_missing) == 0
    
    if total_carbs <= 2:
        keto_tier = "ultra_low"
        keto_label = "Ultra Low Carb (<=2g)"
    elif total_carbs <= 5:
        keto_tier = "low"
        keto_label = "Low Carb (<=5g)"
    elif total_carbs <= 10:
        keto_tier = "moderate"
        keto_label = "Moderate Carb (<=10g)"
    else:
        keto_tier = "high"
        keto_label = "Higher Carb (>10g) - May not fit strict keto"
    
    return {
        "foods": foods_data,
        "combined_macros": {
            "protein": round(total_protein, 1),
            "carbs": round(total_carbs, 1),
            "fat": round(total_fat, 1),
            "calories": round(total_calories, 1)
        },
        "combined_amino_acids": {k: round(v, 3) for k, v in sorted(combined_amino_acids.items())},
        "amino_acid_analysis": {
            "is_complete_protein": is_complete,
            "essential_present": essential_present,
            "essential_missing": essential_missing,
            "completeness_score": round((len(essential_present) / 9) * 100, 1)
        },
        "keto_analysis": {
            "tier": keto_tier,
            "label": keto_label,
            "net_carbs": round(total_carbs, 1),
            "is_keto_friendly": total_carbs <= 10
        }
    }

# Custom Meals
@router.post("/custom-meals", response_model=CustomMealResponse)
async def create_custom_meal(meal_data: CustomMealCreate, current_user: dict = Depends(get_current_user)):
    meal_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    total_protein = sum(f.get("protein", 0) * f.get("servings", 1) for f in meal_data.foods)
    total_carbs = sum(f.get("carbs", 0) * f.get("servings", 1) for f in meal_data.foods)
    total_fat = sum(f.get("fat", 0) * f.get("servings", 1) for f in meal_data.foods)
    total_calories = sum(f.get("calories", 0) * f.get("servings", 1) for f in meal_data.foods)
    
    if total_carbs <= 2:
        keto_tier = "ultra_low"
    elif total_carbs <= 5:
        keto_tier = "low"
    elif total_carbs <= 10:
        keto_tier = "moderate"
    else:
        keto_tier = "high"
    
    amino_acids_present = set()
    for food in meal_data.foods:
        for aa in food.get("amino_acids", []):
            if aa.get("is_essential") and aa.get("value", 0) > 0:
                amino_acids_present.add(aa.get("name"))
    is_complete = len(amino_acids_present) >= 9
    
    meal_doc = {
        "id": meal_id,
        "user_id": current_user["id"],
        "name": meal_data.name,
        "description": meal_data.description or "",
        "foods": meal_data.foods,
        "total_protein": round(total_protein, 1),
        "total_carbs": round(total_carbs, 1),
        "total_fat": round(total_fat, 1),
        "total_calories": round(total_calories, 1),
        "is_complete_protein": is_complete,
        "keto_tier": keto_tier,
        "created_at": now.isoformat()
    }
    
    await db.custom_meals.insert_one(meal_doc)
    
    return CustomMealResponse(
        id=meal_id,
        user_id=current_user["id"],
        name=meal_data.name,
        description=meal_data.description or "",
        foods=meal_data.foods,
        total_protein=round(total_protein, 1),
        total_carbs=round(total_carbs, 1),
        total_fat=round(total_fat, 1),
        total_calories=round(total_calories, 1),
        is_complete_protein=is_complete,
        keto_tier=keto_tier,
        created_at=now
    )

@router.get("/custom-meals", response_model=List[CustomMealResponse])
async def get_custom_meals(current_user: dict = Depends(get_current_user)):
    meals = await db.custom_meals.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    result = []
    for meal in meals:
        created_at = meal.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        result.append(CustomMealResponse(
            id=meal["id"],
            user_id=meal["user_id"],
            name=meal["name"],
            description=meal.get("description", ""),
            foods=meal.get("foods", []),
            total_protein=meal.get("total_protein", 0),
            total_carbs=meal.get("total_carbs", 0),
            total_fat=meal.get("total_fat", 0),
            total_calories=meal.get("total_calories", 0),
            is_complete_protein=meal.get("is_complete_protein", False),
            keto_tier=meal.get("keto_tier", "unknown"),
            created_at=created_at
        ))
    
    return result

@router.delete("/custom-meals/{meal_id}")
async def delete_custom_meal(meal_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.custom_meals.delete_one({"id": meal_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom meal not found")
    return {"message": "Custom meal deleted"}

@router.post("/custom-meals/{meal_id}/log")
async def log_custom_meal(
    meal_id: str,
    meal_type: str = Query("snack"),
    current_user: dict = Depends(get_current_user)
):
    meal = await db.custom_meals.find_one({"id": meal_id, "user_id": current_user["id"]}, {"_id": 0})
    if not meal:
        raise HTTPException(status_code=404, detail="Custom meal not found")
    
    now = datetime.now(timezone.utc)
    logged_ids = []
    
    for food in meal.get("foods", []):
        log_id = str(uuid.uuid4())
        log_doc = {
            "id": log_id,
            "user_id": current_user["id"],
            "fdc_id": food.get("fdc_id", "custom"),
            "description": food.get("description", food.get("name", "Unknown")),
            "serving_size": food.get("serving_size", 100),
            "serving_unit": food.get("serving_unit", "g"),
            "servings": food.get("servings", 1),
            "calories": food.get("calories", 0),
            "protein": food.get("protein", 0),
            "fat": food.get("fat", 0),
            "carbs": food.get("carbs", 0),
            "fiber": food.get("fiber", 0),
            "amino_acids": food.get("amino_acids", []),
            "meal_type": meal_type,
            "logged_at": now.isoformat(),
            "created_at": now.isoformat(),
            "from_custom_meal": meal["name"]
        }
        await db.food_logs.insert_one(log_doc)
        logged_ids.append(log_id)
    
    return {
        "message": f"Logged {len(logged_ids)} foods from '{meal['name']}'",
        "log_ids": logged_ids
    }

# Meal Plans
@router.post("/meal-plans", response_model=MealPlanResponse)
async def create_meal_plan(plan_data: MealPlanCreate, current_user: dict = Depends(get_current_user)):
    plan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    total_protein = sum(food.get("protein", 0) * food.get("servings", 1) for food in plan_data.foods)
    total_calories = sum(food.get("calories", 0) * food.get("servings", 1) for food in plan_data.foods)
    
    plan_doc = {
        "id": plan_id,
        "user_id": current_user["id"],
        "name": plan_data.name,
        "description": plan_data.description or "",
        "foods": plan_data.foods,
        "total_protein": round(total_protein, 1),
        "total_calories": round(total_calories, 1),
        "created_at": now.isoformat()
    }
    
    await db.meal_plans.insert_one(plan_doc)
    
    return MealPlanResponse(
        id=plan_id,
        user_id=current_user["id"],
        name=plan_data.name,
        description=plan_data.description or "",
        foods=plan_data.foods,
        total_protein=round(total_protein, 1),
        total_calories=round(total_calories, 1),
        created_at=now
    )

@router.get("/meal-plans", response_model=List[MealPlanResponse])
async def get_meal_plans(current_user: dict = Depends(get_current_user)):
    plans = await db.meal_plans.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    result = []
    for plan in plans:
        created_at = plan.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        result.append(MealPlanResponse(
            id=plan["id"],
            user_id=plan["user_id"],
            name=plan["name"],
            description=plan.get("description", ""),
            foods=plan.get("foods", []),
            total_protein=plan.get("total_protein", 0),
            total_calories=plan.get("total_calories", 0),
            created_at=created_at
        ))
    
    return result

@router.delete("/meal-plans/{plan_id}")
async def delete_meal_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.meal_plans.delete_one({"id": plan_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    return {"message": "Meal plan deleted"}

# Favorites
@router.post("/favorites", response_model=FavoriteResponse)
async def add_favorite(fav_data: FavoriteCreate, current_user: dict = Depends(get_current_user)):
    existing = await db.favorites.find_one({
        "user_id": current_user["id"],
        "fdc_id": fav_data.fdc_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already in favorites")
    
    fav_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    fav_doc = {
        "id": fav_id,
        "user_id": current_user["id"],
        "fdc_id": fav_data.fdc_id,
        "description": fav_data.description,
        "protein_per_100g": fav_data.protein_per_100g,
        "is_complete_protein": fav_data.is_complete_protein,
        "created_at": now.isoformat()
    }
    
    await db.favorites.insert_one(fav_doc)
    
    return FavoriteResponse(
        id=fav_id,
        user_id=current_user["id"],
        fdc_id=fav_data.fdc_id,
        description=fav_data.description,
        protein_per_100g=fav_data.protein_per_100g,
        is_complete_protein=fav_data.is_complete_protein,
        created_at=now
    )

@router.get("/favorites", response_model=List[FavoriteResponse])
async def get_favorites(current_user: dict = Depends(get_current_user)):
    favorites = await db.favorites.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    
    result = []
    for fav in favorites:
        created_at = fav.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        result.append(FavoriteResponse(
            id=fav["id"],
            user_id=fav["user_id"],
            fdc_id=fav["fdc_id"],
            description=fav["description"],
            protein_per_100g=fav.get("protein_per_100g", 0),
            is_complete_protein=fav.get("is_complete_protein", False),
            created_at=created_at
        ))
    
    return result

@router.delete("/favorites/{fav_id}")
async def remove_favorite(fav_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.favorites.delete_one({"id": fav_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"message": "Favorite removed"}

@router.get("/favorites/check/{fdc_id}")
async def check_favorite(fdc_id: str, current_user: dict = Depends(get_current_user)):
    fav = await db.favorites.find_one({
        "user_id": current_user["id"],
        "fdc_id": fdc_id
    }, {"_id": 0})
    return {"is_favorite": fav is not None, "favorite_id": fav.get("id") if fav else None}


# ==================== PUBLIC MEAL LIBRARY ====================

@router.post("/meals/publish/{meal_id}")
async def publish_meal(meal_id: str, current_user: dict = Depends(get_current_user)):
    """Make a custom meal public in the community library"""
    meal = await db.custom_meals.find_one({
        "id": meal_id,
        "user_id": current_user["id"]
    }, {"_id": 0})
    
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    if meal.get("is_public"):
        raise HTTPException(status_code=400, detail="Meal is already public")
    
    await db.custom_meals.update_one(
        {"id": meal_id},
        {"$set": {
            "is_public": True,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "author_name": current_user.get("name", "Anonymous"),
            "likes": 0,
            "saves": 0
        }}
    )
    
    return {"message": "Meal published to community library", "meal_id": meal_id}

@router.post("/meals/unpublish/{meal_id}")
async def unpublish_meal(meal_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a meal from the public library"""
    result = await db.custom_meals.update_one(
        {"id": meal_id, "user_id": current_user["id"]},
        {"$set": {"is_public": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return {"message": "Meal removed from public library"}

@router.get("/meals/library")
async def get_public_meal_library(
    skip: int = 0,
    limit: int = 20,
    sort_by: str = "recent",  # recent, popular, protein
    keto_tier: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Browse the public meal library"""
    query = {"is_public": True}
    
    if keto_tier:
        query["keto_tier"] = keto_tier
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    # Determine sort order
    sort_field = "published_at"
    sort_order = -1
    if sort_by == "popular":
        sort_field = "likes"
    elif sort_by == "protein":
        sort_field = "total_protein"
    elif sort_by == "saves":
        sort_field = "saves"
    
    cursor = db.custom_meals.find(query, {"_id": 0}).sort(sort_field, sort_order).skip(skip).limit(limit)
    meals = await cursor.to_list(length=limit)
    
    total = await db.custom_meals.count_documents(query)
    
    # Check if current user has saved each meal
    user_saved = await db.saved_meals.find(
        {"user_id": current_user["id"]},
        {"meal_id": 1, "_id": 0}
    ).to_list(length=1000)
    saved_ids = {s["meal_id"] for s in user_saved}
    
    for meal in meals:
        meal["is_saved"] = meal["id"] in saved_ids
        meal["is_own"] = meal.get("user_id") == current_user["id"]
    
    return {
        "meals": meals,
        "total": total,
        "has_more": skip + limit < total
    }

@router.post("/meals/library/{meal_id}/save")
async def save_public_meal(meal_id: str, current_user: dict = Depends(get_current_user)):
    """Save a public meal to your collection"""
    meal = await db.custom_meals.find_one({"id": meal_id, "is_public": True}, {"_id": 0})
    
    if not meal:
        raise HTTPException(status_code=404, detail="Public meal not found")
    
    # Check if already saved
    existing = await db.saved_meals.find_one({
        "user_id": current_user["id"],
        "meal_id": meal_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Meal already saved")
    
    # Save the meal
    save_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "meal_id": meal_id,
        "saved_at": datetime.now(timezone.utc).isoformat()
    }
    await db.saved_meals.insert_one(save_doc)
    
    # Increment save count
    await db.custom_meals.update_one(
        {"id": meal_id},
        {"$inc": {"saves": 1}}
    )
    
    return {"message": "Meal saved", "save_id": save_doc["id"]}

@router.delete("/meals/library/{meal_id}/unsave")
async def unsave_public_meal(meal_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a saved meal from your collection"""
    result = await db.saved_meals.delete_one({
        "user_id": current_user["id"],
        "meal_id": meal_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Saved meal not found")
    
    # Decrement save count
    await db.custom_meals.update_one(
        {"id": meal_id},
        {"$inc": {"saves": -1}}
    )
    
    return {"message": "Meal removed from saved"}

@router.post("/meals/library/{meal_id}/like")
async def like_public_meal(meal_id: str, current_user: dict = Depends(get_current_user)):
    """Like a public meal"""
    meal = await db.custom_meals.find_one({"id": meal_id, "is_public": True})
    
    if not meal:
        raise HTTPException(status_code=404, detail="Public meal not found")
    
    # Check if already liked
    existing = await db.meal_likes.find_one({
        "user_id": current_user["id"],
        "meal_id": meal_id
    })
    
    if existing:
        # Unlike
        await db.meal_likes.delete_one({"_id": existing["_id"]})
        await db.custom_meals.update_one({"id": meal_id}, {"$inc": {"likes": -1}})
        return {"message": "Like removed", "liked": False}
    else:
        # Like
        await db.meal_likes.insert_one({
            "user_id": current_user["id"],
            "meal_id": meal_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.custom_meals.update_one({"id": meal_id}, {"$inc": {"likes": 1}})
        return {"message": "Meal liked", "liked": True}

@router.get("/meals/saved")
async def get_saved_meals(current_user: dict = Depends(get_current_user)):
    """Get all meals saved by the current user"""
    saved = await db.saved_meals.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(length=100)
    
    meal_ids = [s["meal_id"] for s in saved]
    
    meals = await db.custom_meals.find(
        {"id": {"$in": meal_ids}},
        {"_id": 0}
    ).to_list(length=100)
    
    return {"meals": meals, "count": len(meals)}

@router.post("/meals/library/{meal_id}/copy")
async def copy_meal_to_collection(meal_id: str, current_user: dict = Depends(get_current_user)):
    """Copy a public meal to your own custom meals"""
    meal = await db.custom_meals.find_one({"id": meal_id, "is_public": True}, {"_id": 0})
    
    if not meal:
        raise HTTPException(status_code=404, detail="Public meal not found")
    
    # Create a copy
    new_meal_id = str(uuid.uuid4())
    new_meal = {
        **meal,
        "id": new_meal_id,
        "user_id": current_user["id"],
        "name": f"{meal['name']} (Copy)",
        "is_public": False,
        "copied_from": meal_id,
        "original_author": meal.get("author_name", "Unknown"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Remove public-specific fields
    new_meal.pop("published_at", None)
    new_meal.pop("likes", None)
    new_meal.pop("saves", None)
    
    await db.custom_meals.insert_one(new_meal)
    
    return {"message": "Meal copied to your collection", "new_meal_id": new_meal_id}
