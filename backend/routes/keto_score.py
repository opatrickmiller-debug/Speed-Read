from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
from models.stats import KetoScore

router = APIRouter(prefix="/keto-score", tags=["Keto Score"])

@router.get("", response_model=KetoScore)
async def get_keto_score(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    
    logs = await db.food_logs.find({
        "user_id": current_user["id"],
        "logged_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    total_carbs = sum(log.get("carbs", 0) * log.get("servings", 1) for log in logs)
    total_fiber = sum(log.get("fiber", 0) * log.get("servings", 1) for log in logs)
    net_carbs = max(0, total_carbs - total_fiber)
    
    carb_limit = current_user.get("daily_carb_limit", 20.0)
    carbs_remaining = max(0, carb_limit - net_carbs)
    
    if net_carbs <= carb_limit:
        score = 100
        status = "ketosis"
        color = "emerald"
        message = f"Perfect! You're within your {carb_limit}g carb limit."
    elif net_carbs <= carb_limit * 1.5:
        score = max(50, int(100 - ((net_carbs - carb_limit) / carb_limit) * 100))
        status = "borderline"
        color = "amber"
        message = f"Borderline - {net_carbs - carb_limit:.1f}g over your limit. You might still be in ketosis."
    else:
        score = max(0, int(50 - ((net_carbs - carb_limit * 1.5) / carb_limit) * 50))
        status = "over_limit"
        color = "red"
        message = f"Over limit by {net_carbs - carb_limit:.1f}g. Consider reducing carbs tomorrow."
    
    return KetoScore(
        date=date,
        net_carbs=round(net_carbs, 1),
        carb_limit=carb_limit,
        carbs_remaining=round(carbs_remaining, 1),
        score=score,
        status=status,
        color=color,
        message=message
    )
