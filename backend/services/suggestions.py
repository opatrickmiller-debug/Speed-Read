from datetime import datetime, timezone, timedelta
from core.database import db
from core.constants import ESSENTIAL_AMINO_ACIDS, AMINO_ACID_RICH_FOODS
from models.stats import AminoAcidSuggestion, AminoAcidSuggestionsResponse

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
