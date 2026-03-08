from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from core.security import get_current_user
from core.constants import KETO_COMPLETE_PROTEINS, KETO_MEAL_COMBOS, ESSENTIAL_AMINO_ACIDS, ESSENTIAL_FATTY_ACIDS, FATTY_ACID_RICH_FOODS, AMINO_ACID_RICH_FOODS
from models.stats import AminoAcidSuggestionsResponse, FattyAcidSuggestionsResponse, KetoScore
from services.fdc_client import fdc_client
from services.suggestions import get_amino_acid_suggestions, get_fatty_acid_suggestions
from core.database import db

router = APIRouter(prefix="/suggestions", tags=["Suggestions"])


class FoodSuggestion(BaseModel):
    food: str
    fdc_id: str
    reason: str
    nutrient: str
    deficit_percent: float
    protein_per_100g: float


class DailySuggestionsResponse(BaseModel):
    date: str
    suggestions: List[FoodSuggestion]
    profile_complete: bool
    total_deficits: int
    tip: str


@router.get("/daily", response_model=DailySuggestionsResponse)
async def get_daily_suggestions(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    limit: int = Query(10, ge=1, le=20, description="Max number of suggestions"),
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze user's daily intake and compare against amino acid RDAs.
    Returns foods rich in missing nutrients.
    
    Response example:
    [
      {"food": "Pumpkin seeds", "reason": "High in magnesium"},
      {"food": "Salmon", "reason": "Rich in Tryptophan (45% below RDA)"}
    ]
    """
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get user info for RDA calculation
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    body_weight_kg = user.get("body_weight", 70) if user else 70
    
    # Get today's logs
    start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    
    logs = await db.food_logs.find({
        "user_id": current_user["id"],
        "logged_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    # Calculate amino acid totals
    amino_totals = {}
    for log in logs:
        servings = log.get("servings", 1)
        for aa in log.get("amino_acids", []):
            name = aa.get("name", "")
            value = (aa.get("value", 0) or 0) * servings
            amino_totals[name] = amino_totals.get(name, 0) + value
    
    # Calculate fatty acid totals
    fatty_totals = {}
    for log in logs:
        servings = log.get("servings", 1)
        for fa in log.get("fatty_acids", []):
            name = fa.get("name", "")
            value = (fa.get("value", 0) or 0) * servings
            fatty_totals[name] = fatty_totals.get(name, 0) + value
    
    # Find deficits and build suggestions
    deficits = []
    
    # Check amino acids against RDA
    for aa_name, aa_info in ESSENTIAL_AMINO_ACIDS.items():
        current = amino_totals.get(aa_name, 0)
        rda = (aa_info["rda_mg_per_kg"] * body_weight_kg) / 1000  # Convert to grams
        
        if current < rda * 0.8:  # Below 80% of RDA
            deficit_pct = ((rda - current) / rda) * 100 if rda > 0 else 100
            deficits.append({
                "type": "amino_acid",
                "nutrient": aa_name,
                "current": current,
                "rda": rda,
                "deficit_percent": deficit_pct,
                "foods": AMINO_ACID_RICH_FOODS.get(aa_name, [])
            })
    
    # Check fatty acids against RDA
    for fa_name, fa_info in ESSENTIAL_FATTY_ACIDS.items():
        current = fatty_totals.get(fa_name, 0)
        rda = fa_info["rda_g"]
        
        if current < rda * 0.8:  # Below 80% of RDA
            deficit_pct = ((rda - current) / rda) * 100 if rda > 0 else 100
            deficits.append({
                "type": "fatty_acid",
                "nutrient": fa_name,
                "current": current,
                "rda": rda,
                "deficit_percent": deficit_pct,
                "foods": FATTY_ACID_RICH_FOODS.get(fa_name, [])
            })
    
    # Sort by deficit percentage (highest deficit first)
    deficits.sort(key=lambda x: x["deficit_percent"], reverse=True)
    
    # Build food suggestions (prioritize variety across nutrients)
    suggestions = []
    seen_foods = set()
    seen_nutrients = set()
    
    # First pass: one food per deficit (variety)
    for deficit in deficits:
        if len(suggestions) >= limit:
            break
        
        nutrient = deficit["nutrient"]
        if nutrient in seen_nutrients:
            continue
            
        for food in deficit["foods"]:
            food_name = food.get("name", "")
            if food_name in seen_foods:
                continue
            
            seen_foods.add(food_name)
            seen_nutrients.add(nutrient)
            
            # Build reason string
            deficit_pct = deficit["deficit_percent"]
            
            if deficit_pct >= 100:
                reason = f"High in {nutrient} (missing from diet)"
            elif deficit_pct >= 50:
                reason = f"Rich in {nutrient} ({int(deficit_pct)}% below RDA)"
            else:
                reason = f"Good source of {nutrient}"
            
            suggestions.append(FoodSuggestion(
                food=food_name,
                fdc_id=food.get("fdc_id", ""),
                reason=reason,
                nutrient=nutrient,
                deficit_percent=round(deficit_pct, 1),
                protein_per_100g=food.get("protein", 0)
            ))
            break  # Move to next deficit
    
    # Second pass: fill remaining slots with more options
    if len(suggestions) < limit:
        for deficit in deficits:
            if len(suggestions) >= limit:
                break
                
            for food in deficit["foods"]:
                if len(suggestions) >= limit:
                    break
                    
                food_name = food.get("name", "")
                if food_name in seen_foods:
                    continue
                
                seen_foods.add(food_name)
                deficit_pct = deficit["deficit_percent"]
                nutrient = deficit["nutrient"]
                
                if deficit_pct >= 100:
                    reason = f"High in {nutrient} (missing from diet)"
                elif deficit_pct >= 50:
                    reason = f"Rich in {nutrient} ({int(deficit_pct)}% below RDA)"
                else:
                    reason = f"Good source of {nutrient}"
                
                suggestions.append(FoodSuggestion(
                    food=food_name,
                    fdc_id=food.get("fdc_id", ""),
                    reason=reason,
                    nutrient=nutrient,
                    deficit_percent=round(deficit_pct, 1),
                    protein_per_100g=food.get("protein", 0)
                ))
    
    # Generate tip based on deficits
    if len(deficits) == 0:
        tip = "Great job! Your amino acid and fatty acid intake looks complete for today."
    elif len(deficits) <= 2:
        tip = "Almost there! A few small additions will complete your nutrient profile."
    elif len(deficits) <= 5:
        tip = "Consider adding protein-rich foods to meet your amino acid targets."
    else:
        tip = "Focus on complete proteins like eggs, chicken, or fish to cover multiple amino acids."
    
    return DailySuggestionsResponse(
        date=date,
        suggestions=suggestions,
        profile_complete=len(deficits) == 0,
        total_deficits=len(deficits),
        tip=tip
    )

@router.get("/amino-acids", response_model=AminoAcidSuggestionsResponse)
async def get_suggestions(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    suggestions = await get_amino_acid_suggestions(current_user["id"], date)
    return suggestions

@router.get("/fatty-acids", response_model=FattyAcidSuggestionsResponse)
async def get_fatty_acid_suggestions_endpoint(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Get fatty acid intake analysis and food suggestions"""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    suggestions = await get_fatty_acid_suggestions(current_user["id"], date)
    return suggestions

@router.get("/omega-rich-foods")
async def get_omega_rich_foods(
    omega_type: int = Query(3, description="Omega type: 3 or 6"),
    current_user: dict = Depends(get_current_user)
):
    """Get keto-friendly foods rich in omega-3 or omega-6"""
    foods = []
    for fa_name, fa_info in ESSENTIAL_FATTY_ACIDS.items():
        if fa_info.get("omega") == omega_type:
            food_list = FATTY_ACID_RICH_FOODS.get(fa_name, [])
            for food in food_list:
                food_with_source = {**food, "fatty_acid": fa_name}
                if food_with_source not in foods:
                    foods.append(food_with_source)
    
    return {
        "omega_type": omega_type,
        "foods": foods,
        "tip": f"Foods rich in Omega-{omega_type} fatty acids. Lower omega-6:omega-3 ratio is better for inflammation."
    }

@router.get("/complete-protein")
async def get_complete_protein_foods(
    keto_only: bool = Query(True, description="Show only keto-friendly options"),
    current_user: dict = Depends(get_current_user)
):
    return {
        "complete_protein_foods": KETO_COMPLETE_PROTEINS,
        "tip": "All foods shown are keto-friendly with less than 5g carbs per 100g. Ultra-low means under 2g carbs."
    }

@router.get("/keto-meals")
async def get_keto_meal_combos(current_user: dict = Depends(get_current_user)):
    return {
        "meal_combos": KETO_MEAL_COMBOS,
        "tip": "These meal combinations provide all 9 essential amino acids while staying under 5g net carbs per meal."
    }
