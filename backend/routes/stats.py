from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
from core.database import db
from core.security import get_current_user
from models.stats import DailyStats, KetoScore

router = APIRouter(prefix="/stats", tags=["Statistics"])

@router.get("/daily", response_model=DailyStats)
async def get_daily_stats(
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
    
    total_protein = 0
    total_calories = 0
    total_carbs = 0
    total_fat = 0
    total_fiber = 0
    amino_totals = {}
    
    for log in logs:
        servings = log.get("servings", 1)
        total_protein += log.get("protein", 0) * servings
        total_calories += log.get("calories", 0) * servings
        total_carbs += log.get("carbs", 0) * servings
        total_fat += log.get("fat", 0) * servings
        total_fiber += log.get("fiber", 0) * servings
        
        for aa in log.get("amino_acids", []):
            aa_name = aa.get("name", "")
            aa_value = aa.get("value", 0) * servings
            amino_totals[aa_name] = amino_totals.get(aa_name, 0) + aa_value
    
    protein_goal = current_user.get("protein_goal", 150.0)
    protein_percentage = (total_protein / protein_goal * 100) if protein_goal > 0 else 0
    
    return DailyStats(
        date=date,
        total_protein=round(total_protein, 1),
        total_calories=round(total_calories, 1),
        total_carbs=round(total_carbs, 1),
        total_fat=round(total_fat, 1),
        total_fiber=round(total_fiber, 1),
        amino_acid_totals={k: round(v, 3) for k, v in amino_totals.items()},
        protein_goal=protein_goal,
        protein_goal_percentage=round(protein_percentage, 1),
        logs_count=len(logs)
    )

@router.get("/weekly")
async def get_weekly_stats(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=6)
    
    daily_stats = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        date_str = day.strftime("%Y-%m-%d")
        
        start = day
        end = day + timedelta(days=1)
        
        logs = await db.food_logs.find({
            "user_id": current_user["id"],
            "logged_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}
        }, {"_id": 0}).to_list(500)
        
        total_protein = sum(log.get("protein", 0) * log.get("servings", 1) for log in logs)
        total_calories = sum(log.get("calories", 0) * log.get("servings", 1) for log in logs)
        
        daily_stats.append({
            "date": date_str,
            "day_name": day.strftime("%a"),
            "protein": round(total_protein, 1),
            "calories": round(total_calories, 1),
            "logs_count": len(logs)
        })
    
    return {
        "days": daily_stats,
        "protein_goal": current_user.get("protein_goal", 150.0)
    }
