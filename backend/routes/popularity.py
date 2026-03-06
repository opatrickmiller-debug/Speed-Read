"""
Food Popularity Tracking
Tracks which foods users select and log to improve search ranking.
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/popularity", tags=["Food Popularity"])

async def track_food_selection(food_id: str, description: str, source: str = "usda"):
    """
    Track when a user selects/views a food from search results.
    This data is used to boost popular foods in search ranking.
    """
    now = datetime.now(timezone.utc)
    
    # Upsert: increment selection count or create new record
    await db.food_popularity.update_one(
        {"food_id": food_id},
        {
            "$inc": {"selection_count": 1},
            "$set": {
                "description": description,
                "source": source,
                "last_selected": now.isoformat()
            },
            "$setOnInsert": {
                "food_id": food_id,
                "log_count": 0,
                "created_at": now.isoformat()
            }
        },
        upsert=True
    )

async def track_food_log(food_id: str, description: str, source: str = "usda"):
    """
    Track when a user logs a food to their diary.
    Logged foods get higher weight than just selections.
    """
    now = datetime.now(timezone.utc)
    
    await db.food_popularity.update_one(
        {"food_id": food_id},
        {
            "$inc": {"log_count": 1, "selection_count": 1},
            "$set": {
                "description": description,
                "source": source,
                "last_logged": now.isoformat(),
                "last_selected": now.isoformat()
            },
            "$setOnInsert": {
                "food_id": food_id,
                "created_at": now.isoformat()
            }
        },
        upsert=True
    )

async def get_popular_foods(limit: int = 100) -> dict:
    """
    Get popularity scores for foods.
    Returns a dict of food_id -> popularity_score for quick lookup.
    Score = selection_count + (log_count * 3)  # Logging weighs more
    """
    cursor = db.food_popularity.find(
        {},
        {"food_id": 1, "selection_count": 1, "log_count": 1, "_id": 0}
    ).sort("log_count", -1).limit(limit)
    
    popularity_map = {}
    async for doc in cursor:
        food_id = doc.get("food_id")
        selections = doc.get("selection_count", 0)
        logs = doc.get("log_count", 0)
        # Logarithmic scaling to prevent runaway popularity
        import math
        score = math.log1p(selections + logs * 3) * 10
        popularity_map[food_id] = min(score, 50)  # Cap at 50 points
    
    return popularity_map

@router.post("/track-selection")
async def track_selection(
    food_id: str,
    description: str,
    source: str = "usda",
    current_user: dict = Depends(get_current_user)
):
    """Track when user selects a food from search results"""
    await track_food_selection(food_id, description, source)
    return {"status": "tracked"}

@router.get("/top-foods")
async def get_top_foods(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get most popular foods across all users"""
    cursor = db.food_popularity.find(
        {},
        {"food_id": 1, "description": 1, "selection_count": 1, "log_count": 1, "_id": 0}
    ).sort([("log_count", -1), ("selection_count", -1)]).limit(limit)
    
    foods = []
    async for doc in cursor:
        foods.append({
            "food_id": doc.get("food_id"),
            "description": doc.get("description"),
            "times_logged": doc.get("log_count", 0),
            "times_viewed": doc.get("selection_count", 0)
        })
    
    return {"popular_foods": foods}
