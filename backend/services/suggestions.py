from datetime import datetime, timezone, timedelta
from core.database import db
from core.constants import ESSENTIAL_AMINO_ACIDS, AMINO_ACID_RICH_FOODS, ESSENTIAL_FATTY_ACIDS, FATTY_ACID_RICH_FOODS
from models.stats import AminoAcidSuggestion, AminoAcidSuggestionsResponse, FattyAcidSuggestion, FattyAcidSuggestionsResponse

async def get_amino_acid_suggestions(user_id: str, date: str) -> AminoAcidSuggestionsResponse:
    start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    body_weight_kg = user.get("body_weight", 70) if user else 70
    
    logs = await db.food_logs.find({
        "user_id": user_id,
        "logged_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    amino_totals = {}
    for log in logs:
        servings = log.get("servings", 1)
        for aa in log.get("amino_acids", []):
            name = aa.get("name", "")
            value = aa.get("value", 0) * servings
            amino_totals[name] = amino_totals.get(name, 0) + value
    
    missing_amino_acids = []
    low_amino_acids = []
    
    for aa_name, aa_info in ESSENTIAL_AMINO_ACIDS.items():
        current_intake = amino_totals.get(aa_name, 0)
        rda_grams = (aa_info["rda_mg_per_kg"] * body_weight_kg) / 1000
        
        if current_intake == 0:
            missing_amino_acids.append(aa_name)
            suggestions = AMINO_ACID_RICH_FOODS.get(aa_name, [])[:3]
            low_amino_acids.append(AminoAcidSuggestion(
                amino_acid=aa_name,
                current_intake=0,
                recommended_intake=round(rda_grams, 2),
                deficit=round(rda_grams, 2),
                suggested_foods=suggestions
            ))
        elif current_intake < rda_grams * 0.8:
            deficit = rda_grams - current_intake
            suggestions = AMINO_ACID_RICH_FOODS.get(aa_name, [])[:3]
            low_amino_acids.append(AminoAcidSuggestion(
                amino_acid=aa_name,
                current_intake=round(current_intake, 3),
                recommended_intake=round(rda_grams, 2),
                deficit=round(deficit, 3),
                suggested_foods=suggestions
            ))
    
    low_amino_acids.sort(key=lambda x: x.deficit, reverse=True)
    
    return AminoAcidSuggestionsResponse(
        date=date,
        missing_amino_acids=missing_amino_acids,
        low_amino_acids=low_amino_acids,
        complete_profile=len(low_amino_acids) == 0
    )


async def get_fatty_acid_suggestions(user_id: str, date: str) -> FattyAcidSuggestionsResponse:
    start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    
    logs = await db.food_logs.find({
        "user_id": user_id,
        "logged_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    fatty_totals = {}
    for log in logs:
        servings = log.get("servings", 1)
        for fa in log.get("fatty_acids", []):
            name = fa.get("name", "")
            value = fa.get("value", 0) * servings
            fatty_totals[name] = fatty_totals.get(name, 0) + value
    
    low_fatty_acids = []
    omega3_total = 0
    omega6_total = 0
    
    for fa_name, fa_info in ESSENTIAL_FATTY_ACIDS.items():
        current_intake = fatty_totals.get(fa_name, 0)
        rda_grams = fa_info["rda_g"]
        omega_type = fa_info["omega"]
        
        if omega_type == 3:
            omega3_total += current_intake
        else:
            omega6_total += current_intake
        
        if current_intake < rda_grams * 0.8:
            deficit = rda_grams - current_intake
            suggestions = FATTY_ACID_RICH_FOODS.get(fa_name, [])[:3]
            low_fatty_acids.append(FattyAcidSuggestion(
                fatty_acid=fa_name,
                omega_type=omega_type,
                current_intake=round(current_intake, 3),
                recommended_intake=round(rda_grams, 2),
                deficit=round(deficit, 3),
                suggested_foods=suggestions
            ))
    
    low_fatty_acids.sort(key=lambda x: x.deficit, reverse=True)
    
    # Calculate omega ratio
    if omega3_total > 0 and omega6_total > 0:
        ratio_value = omega6_total / omega3_total
        omega_ratio = f"1:{ratio_value:.1f}"
    elif omega3_total > 0:
        omega_ratio = "All Omega-3"
    elif omega6_total > 0:
        omega_ratio = "All Omega-6"
    else:
        omega_ratio = "No data"
    
    return FattyAcidSuggestionsResponse(
        date=date,
        omega3_total=round(omega3_total, 3),
        omega6_total=round(omega6_total, 3),
        omega_ratio=omega_ratio,
        ideal_ratio="1:4 (Omega-3:Omega-6)",
        low_fatty_acids=low_fatty_acids,
        complete_profile=len(low_fatty_acids) == 0
    )
