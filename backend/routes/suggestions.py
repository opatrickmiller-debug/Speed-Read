from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
from core.security import get_current_user
from core.constants import KETO_COMPLETE_PROTEINS, KETO_MEAL_COMBOS, ESSENTIAL_AMINO_ACIDS, ESSENTIAL_FATTY_ACIDS, FATTY_ACID_RICH_FOODS
from models.stats import AminoAcidSuggestionsResponse, FattyAcidSuggestionsResponse, KetoScore
from services.fdc_client import fdc_client
from services.suggestions import get_amino_acid_suggestions, get_fatty_acid_suggestions
from core.database import db

router = APIRouter(prefix="/suggestions", tags=["Suggestions"])

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
