from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class DailyStats(BaseModel):
    date: str
    total_protein: float
    total_calories: float
    total_carbs: float
    total_fat: float
    total_fiber: float
    amino_acid_totals: Dict[str, float]
    protein_goal: float
    protein_goal_percentage: float
    logs_count: int

class AminoAcidSuggestion(BaseModel):
    amino_acid: str
    current_intake: float
    recommended_intake: float
    deficit: float
    suggested_foods: List[Dict[str, Any]]

class FattyAcidSuggestion(BaseModel):
    fatty_acid: str
    omega_type: int
    current_intake: float
    recommended_intake: float
    deficit: float
    suggested_foods: List[Dict[str, Any]]

class AminoAcidSuggestionsResponse(BaseModel):
    date: str
    missing_amino_acids: List[str]
    low_amino_acids: List[AminoAcidSuggestion]
    complete_profile: bool

class FattyAcidSuggestionsResponse(BaseModel):
    date: str
    omega3_total: float
    omega6_total: float
    omega_ratio: str
    ideal_ratio: str
    low_fatty_acids: List[FattyAcidSuggestion]
    complete_profile: bool

class KetoScore(BaseModel):
    date: str
    net_carbs: float
    carb_limit: float
    carbs_remaining: float
    score: int
    status: str
    color: str
    message: str
