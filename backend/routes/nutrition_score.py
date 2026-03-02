from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
from core.constants import ESSENTIAL_AMINO_ACIDS, ESSENTIAL_FATTY_ACIDS
from pydantic import BaseModel
from typing import Dict, List

router = APIRouter(prefix="/nutrition-score", tags=["Nutrition Score"])

class NutritionScoreBreakdown(BaseModel):
    amino_acid_score: int
    amino_acid_details: Dict[str, float]
    omega_score: int
    omega_ratio: float
    omega_status: str
    protein_score: int
    protein_percentage: float
    total_score: int
    grade: str
    color: str
    message: str
    tips: List[str]

@router.get("", response_model=NutritionScoreBreakdown)
async def get_nutrition_score(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate a combined Nutrition Score based on:
    - Amino acid completeness (40% weight)
    - Omega-3:Omega-6 ratio quality (30% weight)
    - Protein goal progress (30% weight)
    """
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    
    # Get user settings
    body_weight_kg = current_user.get("body_weight_kg", 70.0)
    protein_goal = current_user.get("protein_goal", 150.0)
    
    # Fetch food logs for the day
    logs = await db.food_logs.find({
        "user_id": current_user["id"],
        "logged_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    # Calculate totals
    amino_totals = {}
    fatty_totals = {}
    total_protein = 0
    
    for log in logs:
        servings = log.get("servings", 1)
        total_protein += log.get("protein", 0) * servings
        
        for aa in log.get("amino_acids", []):
            name = aa.get("name", "")
            value = aa.get("value", 0) * servings
            amino_totals[name] = amino_totals.get(name, 0) + value
        
        for fa in log.get("fatty_acids", []):
            name = fa.get("name", "")
            value = fa.get("value", 0) * servings
            fatty_totals[name] = fatty_totals.get(name, 0) + value
    
    # ========== AMINO ACID SCORE (40% weight) ==========
    amino_acid_details = {}
    amino_acids_met = 0
    
    for aa_name, aa_info in ESSENTIAL_AMINO_ACIDS.items():
        current = amino_totals.get(aa_name, 0)
        rda_grams = (aa_info["rda_mg_per_kg"] * body_weight_kg) / 1000
        percentage = (current / rda_grams * 100) if rda_grams > 0 else 0
        amino_acid_details[aa_name] = min(percentage, 100)  # Cap at 100%
        
        if percentage >= 80:  # Consider adequate at 80% or more
            amino_acids_met += 1
    
    # Score: percentage of essential amino acids at adequate levels
    amino_acid_score = int((amino_acids_met / 9) * 100)
    
    # ========== OMEGA RATIO SCORE (30% weight) ==========
    omega3_total = sum(
        fatty_totals.get(fa_name, 0) 
        for fa_name, fa_info in ESSENTIAL_FATTY_ACIDS.items() 
        if fa_info.get("omega") == 3
    )
    omega6_total = sum(
        fatty_totals.get(fa_name, 0) 
        for fa_name, fa_info in ESSENTIAL_FATTY_ACIDS.items() 
        if fa_info.get("omega") == 6
    )
    
    if omega3_total > 0 and omega6_total > 0:
        omega_ratio = omega6_total / omega3_total
        # Ideal ratio is 1:1 to 4:1 (omega6:omega3)
        # Score decreases as ratio increases beyond 4:1
        if omega_ratio <= 1:
            omega_score = 100  # Perfect
            omega_status = "optimal"
        elif omega_ratio <= 4:
            omega_score = 100 - int((omega_ratio - 1) * 10)  # 90-100
            omega_status = "good"
        elif omega_ratio <= 10:
            omega_score = 70 - int((omega_ratio - 4) * 5)  # 40-70
            omega_status = "moderate"
        else:
            omega_score = max(0, 40 - int((omega_ratio - 10) * 2))  # 0-40
            omega_status = "poor"
    elif omega3_total > 0:
        omega_ratio = 0
        omega_score = 100  # All omega-3, no omega-6 is great
        omega_status = "optimal"
    elif omega6_total > 0:
        omega_ratio = float('inf')
        omega_score = 20  # Only omega-6 is not ideal
        omega_status = "poor"
    else:
        omega_ratio = 0
        omega_score = 50  # No data, neutral score
        omega_status = "no_data"
    
    # ========== PROTEIN GOAL SCORE (30% weight) ==========
    protein_percentage = (total_protein / protein_goal * 100) if protein_goal > 0 else 0
    if protein_percentage >= 100:
        protein_score = 100
    elif protein_percentage >= 80:
        protein_score = int(protein_percentage)
    else:
        protein_score = int(protein_percentage * 0.9)  # Penalize slightly for low protein
    
    # ========== TOTAL SCORE ==========
    # Weighted average: 40% amino, 30% omega, 30% protein
    total_score = int(
        amino_acid_score * 0.40 +
        omega_score * 0.30 +
        protein_score * 0.30
    )
    
    # Determine grade and color
    if total_score >= 90:
        grade = "A+"
        color = "emerald"
        message = "Exceptional nutrition! You're hitting all your targets."
    elif total_score >= 80:
        grade = "A"
        color = "emerald"
        message = "Excellent nutrition! Great amino acid and fatty acid balance."
    elif total_score >= 70:
        grade = "B"
        color = "cyan"
        message = "Good nutrition. A few areas could use improvement."
    elif total_score >= 60:
        grade = "C"
        color = "amber"
        message = "Fair nutrition. Consider diversifying your protein sources."
    elif total_score >= 50:
        grade = "D"
        color = "orange"
        message = "Needs improvement. Focus on complete proteins and omega-3 foods."
    else:
        grade = "F"
        color = "red"
        message = "Poor nutrition today. Log some protein-rich and fatty fish to improve."
    
    # Generate tips
    tips = []
    if amino_acid_score < 80:
        missing_count = 9 - amino_acids_met
        tips.append(f"Add complete proteins (eggs, chicken, fish) to cover {missing_count} missing amino acids")
    if omega_status in ["moderate", "poor"]:
        tips.append("Add fatty fish (salmon, mackerel) or flax seeds for better omega-3 balance")
    if protein_score < 80:
        remaining = protein_goal - total_protein
        tips.append(f"You need {remaining:.0f}g more protein to hit your goal")
    if not tips:
        tips.append("Keep up the great work! Your nutrition is on point.")
    
    return NutritionScoreBreakdown(
        amino_acid_score=amino_acid_score,
        amino_acid_details={k: round(v, 1) for k, v in amino_acid_details.items()},
        omega_score=omega_score,
        omega_ratio=round(omega_ratio, 2) if omega_ratio != float('inf') else 999,
        omega_status=omega_status,
        protein_score=protein_score,
        protein_percentage=round(protein_percentage, 1),
        total_score=total_score,
        grade=grade,
        color=color,
        message=message,
        tips=tips
    )
