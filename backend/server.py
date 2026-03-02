from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from pydantic_settings import BaseSettings
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import asyncio
from jose import JWTError, jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Settings
class Settings(BaseSettings):
    mongo_url: str = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name: str = os.environ.get('DB_NAME', 'test_database')
    fdc_api_key: str = os.environ.get('FDC_API_KEY', '')
    fdc_base_url: str = "https://api.nal.usda.gov/fdc/v1"
    jwt_secret: str = os.environ.get('JWT_SECRET', 'keto-tracker-super-secret-key-2024')
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

settings = Settings()

# MongoDB connection
client = AsyncIOMotorClient(settings.mongo_url)
db = client[settings.db_name]

# Create the main app
app = FastAPI(title="Keto Nutrition Tracker API")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Essential Amino Acids data (USDA FDC nutrient IDs)
ESSENTIAL_AMINO_ACIDS = {
    "Tryptophan": {"id": 1210, "rda_mg_per_kg": 5},
    "Threonine": {"id": 1211, "rda_mg_per_kg": 20},
    "Isoleucine": {"id": 1212, "rda_mg_per_kg": 19},
    "Leucine": {"id": 1213, "rda_mg_per_kg": 42},
    "Lysine": {"id": 1214, "rda_mg_per_kg": 38},
    "Methionine": {"id": 1215, "rda_mg_per_kg": 19},
    "Phenylalanine": {"id": 1217, "rda_mg_per_kg": 33},
    "Valine": {"id": 1219, "rda_mg_per_kg": 24},
    "Histidine": {"id": 1221, "rda_mg_per_kg": 14}
}

ALL_AMINO_ACIDS = {
    **ESSENTIAL_AMINO_ACIDS,
    "Cystine": {"id": 1216, "essential": False},
    "Tyrosine": {"id": 1218, "essential": False},
    "Arginine": {"id": 1220, "essential": False},
    "Alanine": {"id": 1222, "essential": False},
    "Aspartic acid": {"id": 1223, "essential": False},
    "Glutamic acid": {"id": 1224, "essential": False},
    "Glycine": {"id": 1225, "essential": False},
    "Proline": {"id": 1226, "essential": False},
    "Serine": {"id": 1227, "essential": False},
    "Hydroxyproline": {"id": 1228, "essential": False}
}

# Foods high in specific amino acids (for suggestions) - KETO FRIENDLY with carb data
AMINO_ACID_RICH_FOODS = {
    "Tryptophan": [
        {"name": "Turkey breast", "fdc_id": "171082", "per_100g": 0.31, "carbs": 0, "protein": 29, "keto": "ultra_low"},
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 0.29, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Salmon", "fdc_id": "175168", "per_100g": 0.25, "carbs": 0, "protein": 25, "keto": "ultra_low"},
        {"name": "Eggs", "fdc_id": "173424", "per_100g": 0.17, "carbs": 0.7, "protein": 13, "keto": "ultra_low"},
        {"name": "Cheese (cheddar)", "fdc_id": "173414", "per_100g": 0.32, "carbs": 1.3, "protein": 25, "keto": "ultra_low"}
    ],
    "Threonine": [
        {"name": "Beef (grass-fed)", "fdc_id": "174032", "per_100g": 1.1, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 1.0, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Pork tenderloin", "fdc_id": "167820", "per_100g": 0.9, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Greek yogurt (full fat)", "fdc_id": "170903", "per_100g": 0.4, "carbs": 4, "protein": 10, "keto": "low"},
        {"name": "Parmesan cheese", "fdc_id": "173420", "per_100g": 1.2, "carbs": 3.2, "protein": 38, "keto": "low"}
    ],
    "Isoleucine": [
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 1.4, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Beef ribeye", "fdc_id": "174032", "per_100g": 1.2, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 1.3, "carbs": 0, "protein": 30, "keto": "ultra_low"},
        {"name": "Eggs", "fdc_id": "173424", "per_100g": 0.7, "carbs": 0.7, "protein": 13, "keto": "ultra_low"},
        {"name": "Cottage cheese", "fdc_id": "173417", "per_100g": 0.6, "carbs": 3.4, "protein": 11, "keto": "low"}
    ],
    "Leucine": [
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 2.1, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Beef sirloin", "fdc_id": "174032", "per_100g": 2.0, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 2.0, "carbs": 0, "protein": 30, "keto": "ultra_low"},
        {"name": "Salmon", "fdc_id": "175168", "per_100g": 1.8, "carbs": 0, "protein": 25, "keto": "ultra_low"},
        {"name": "Pork chop", "fdc_id": "167820", "per_100g": 1.9, "carbs": 0, "protein": 26, "keto": "ultra_low"}
    ],
    "Lysine": [
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 2.4, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Beef", "fdc_id": "174032", "per_100g": 2.1, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Pork", "fdc_id": "167820", "per_100g": 2.0, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 2.3, "carbs": 0, "protein": 30, "keto": "ultra_low"},
        {"name": "Shrimp", "fdc_id": "175180", "per_100g": 2.0, "carbs": 0.2, "protein": 24, "keto": "ultra_low"}
    ],
    "Methionine": [
        {"name": "Eggs", "fdc_id": "173424", "per_100g": 0.4, "carbs": 0.7, "protein": 13, "keto": "ultra_low"},
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 0.7, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Brazil nuts", "fdc_id": "170569", "per_100g": 1.1, "carbs": 4, "protein": 14, "keto": "low"},
        {"name": "Beef", "fdc_id": "174032", "per_100g": 0.6, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 0.8, "carbs": 0, "protein": 30, "keto": "ultra_low"}
    ],
    "Phenylalanine": [
        {"name": "Beef", "fdc_id": "174032", "per_100g": 1.0, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 1.0, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Parmesan cheese", "fdc_id": "173420", "per_100g": 1.9, "carbs": 3.2, "protein": 38, "keto": "low"},
        {"name": "Eggs", "fdc_id": "173424", "per_100g": 0.7, "carbs": 0.7, "protein": 13, "keto": "ultra_low"},
        {"name": "Pork", "fdc_id": "167820", "per_100g": 0.9, "carbs": 0, "protein": 26, "keto": "ultra_low"}
    ],
    "Valine": [
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 1.3, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Beef", "fdc_id": "174032", "per_100g": 1.3, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Cottage cheese", "fdc_id": "173417", "per_100g": 0.8, "carbs": 3.4, "protein": 11, "keto": "low"},
        {"name": "Eggs", "fdc_id": "173424", "per_100g": 0.9, "carbs": 0.7, "protein": 13, "keto": "ultra_low"},
        {"name": "Turkey", "fdc_id": "171082", "per_100g": 1.2, "carbs": 0, "protein": 29, "keto": "ultra_low"}
    ],
    "Histidine": [
        {"name": "Beef", "fdc_id": "174032", "per_100g": 1.0, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Chicken breast", "fdc_id": "171534", "per_100g": 0.9, "carbs": 0, "protein": 31, "keto": "ultra_low"},
        {"name": "Tuna", "fdc_id": "175159", "per_100g": 1.5, "carbs": 0, "protein": 30, "keto": "ultra_low"},
        {"name": "Pork", "fdc_id": "167820", "per_100g": 1.0, "carbs": 0, "protein": 26, "keto": "ultra_low"},
        {"name": "Salmon", "fdc_id": "175168", "per_100g": 0.9, "carbs": 0, "protein": 25, "keto": "ultra_low"}
    ]
}

# Keto-friendly complete protein foods with carb data
KETO_COMPLETE_PROTEINS = [
    {
        "name": "Eggs, whole",
        "fdc_id": "173424",
        "protein_per_100g": 12.6,
        "carbs_per_100g": 0.7,
        "fat_per_100g": 9.5,
        "keto_tier": "ultra_low",
        "description": "Perfect keto food - all 9 essential amino acids, virtually zero carbs"
    },
    {
        "name": "Chicken breast",
        "fdc_id": "171534",
        "protein_per_100g": 31.0,
        "carbs_per_100g": 0,
        "fat_per_100g": 3.6,
        "keto_tier": "ultra_low",
        "description": "Zero carb complete protein, lean and versatile"
    },
    {
        "name": "Beef ribeye",
        "fdc_id": "174032",
        "protein_per_100g": 26.0,
        "carbs_per_100g": 0,
        "fat_per_100g": 18.0,
        "keto_tier": "ultra_low",
        "description": "Zero carb, high fat - ideal keto macro ratio"
    },
    {
        "name": "Salmon, Atlantic",
        "fdc_id": "175168",
        "protein_per_100g": 25.4,
        "carbs_per_100g": 0,
        "fat_per_100g": 13.0,
        "keto_tier": "ultra_low",
        "description": "Zero carb with omega-3s, excellent for keto"
    },
    {
        "name": "Pork belly",
        "fdc_id": "167820",
        "protein_per_100g": 9.3,
        "carbs_per_100g": 0,
        "fat_per_100g": 53.0,
        "keto_tier": "ultra_low",
        "description": "Ultra high fat, zero carb - keto staple"
    },
    {
        "name": "Bacon",
        "fdc_id": "168322",
        "protein_per_100g": 37.0,
        "carbs_per_100g": 1.4,
        "fat_per_100g": 42.0,
        "keto_tier": "ultra_low",
        "description": "High protein, high fat, minimal carbs"
    },
    {
        "name": "Cheddar cheese",
        "fdc_id": "173414",
        "protein_per_100g": 25.0,
        "carbs_per_100g": 1.3,
        "fat_per_100g": 33.0,
        "keto_tier": "ultra_low",
        "description": "Complete protein with excellent fat content"
    },
    {
        "name": "Greek yogurt (full fat)",
        "fdc_id": "170903",
        "protein_per_100g": 10.0,
        "carbs_per_100g": 4.0,
        "fat_per_100g": 5.0,
        "keto_tier": "low",
        "description": "Low carb option - watch portions on strict keto"
    }
]

# Keto meal combinations for complete amino acid profiles
KETO_MEAL_COMBOS = [
    {
        "name": "Steak & Eggs",
        "foods": ["Beef ribeye", "Eggs"],
        "total_protein": 38.6,
        "total_carbs": 0.7,
        "description": "Classic keto combo - complete amino acids, near-zero carbs",
        "amino_profile": "complete"
    },
    {
        "name": "Salmon & Avocado",
        "foods": ["Salmon", "Avocado"],
        "total_protein": 27.4,
        "total_carbs": 1.8,
        "description": "Omega-3 rich with healthy fats, complete protein",
        "amino_profile": "complete"
    },
    {
        "name": "Bacon & Cheese Omelette",
        "foods": ["Bacon", "Eggs", "Cheddar cheese"],
        "total_protein": 40.0,
        "total_carbs": 2.4,
        "description": "High fat, high protein breakfast - all amino acids covered",
        "amino_profile": "complete"
    },
    {
        "name": "Chicken & Cheese Plate",
        "foods": ["Chicken breast", "Parmesan"],
        "total_protein": 56.0,
        "total_carbs": 3.2,
        "description": "Ultra high protein, low carb - muscle building combo",
        "amino_profile": "complete"
    },
    {
        "name": "Tuna Salad (no bread)",
        "foods": ["Tuna", "Eggs", "Mayonnaise"],
        "total_protein": 43.0,
        "total_carbs": 0.8,
        "description": "Quick keto lunch - complete protein, minimal carbs",
        "amino_profile": "complete"
    },
    {
        "name": "Pork Chops & Butter",
        "foods": ["Pork chop", "Butter"],
        "total_protein": 26.0,
        "total_carbs": 0,
        "description": "Zero carb meal with all essential amino acids",
        "amino_profile": "complete"
    }
]

# ============== Models ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    protein_goal: float = 150.0
    daily_carb_limit: float = 20.0
    body_weight_kg: float = 70.0
    body_fat_percentage: float = 20.0
    protein_per_kg_lbm: float = 2.0
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class UserSettingsUpdate(BaseModel):
    protein_goal: Optional[float] = Field(None, gt=0)
    daily_carb_limit: Optional[float] = Field(None, ge=0)
    body_weight_kg: Optional[float] = Field(None, gt=0)
    body_fat_percentage: Optional[float] = Field(None, ge=0, le=100)
    protein_per_kg_lbm: Optional[float] = Field(None, gt=0)

class ProteinGoalUpdate(BaseModel):
    protein_goal: float = Field(gt=0)

class AminoAcid(BaseModel):
    name: str
    value: float
    unit: str = "g"
    is_essential: bool

class FoodSearchResult(BaseModel):
    fdc_id: str
    description: str
    brand_owner: Optional[str] = None
    data_type: str
    protein_per_100g: float = 0

class FoodDetail(BaseModel):
    fdc_id: str
    description: str
    brand_owner: Optional[str] = None
    serving_size: float = 100
    serving_unit: str = "g"
    calories: float = 0
    protein: float = 0
    fat: float = 0
    carbs: float = 0
    fiber: float = 0
    amino_acids: List[AminoAcid] = []
    is_complete_protein: bool = False
    missing_amino_acids: List[str] = []
    protein_quality_score: float = 0

class FoodLogCreate(BaseModel):
    fdc_id: str
    description: str
    serving_size: float
    serving_unit: str = "g"
    servings: float = 1
    calories: float = 0
    protein: float = 0
    fat: float = 0
    carbs: float = 0
    fiber: float = 0
    amino_acids: List[Dict[str, Any]] = []
    meal_type: str = "snack"  # breakfast, lunch, dinner, snack
    logged_at: Optional[datetime] = None

class FoodLogResponse(BaseModel):
    id: str
    user_id: str
    fdc_id: str
    description: str
    serving_size: float
    serving_unit: str
    servings: float
    calories: float
    protein: float
    fat: float
    carbs: float
    fiber: float
    amino_acids: List[Dict[str, Any]]
    meal_type: str
    logged_at: datetime
    created_at: datetime

class MealPlanCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    foods: List[Dict[str, Any]]

class MealPlanResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str
    foods: List[Dict[str, Any]]
    total_protein: float
    total_calories: float
    created_at: datetime

class FavoriteCreate(BaseModel):
    fdc_id: str
    description: str
    protein_per_100g: float = 0
    is_complete_protein: bool = False

class FavoriteResponse(BaseModel):
    id: str
    user_id: str
    fdc_id: str
    description: str
    protein_per_100g: float
    is_complete_protein: bool
    created_at: datetime

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

class BarcodeProduct(BaseModel):
    barcode: str
    product_name: Optional[str] = None
    brand: Optional[str] = None
    protein_per_100g: float = 0
    calories_per_100g: float = 0
    fat_per_100g: float = 0
    carbs_per_100g: float = 0
    fiber_per_100g: float = 0
    image_url: Optional[str] = None
    source: str = "open_food_facts"

class AminoAcidSuggestion(BaseModel):
    amino_acid: str
    current_intake: float
    recommended_intake: float
    deficit: float
    suggested_foods: List[Dict[str, Any]]

class AminoAcidSuggestionsResponse(BaseModel):
    date: str
    missing_amino_acids: List[str]
    low_amino_acids: List[AminoAcidSuggestion]
    complete_profile: bool

class KetoScore(BaseModel):
    date: str
    net_carbs: float
    carb_limit: float
    carbs_remaining: float
    score: int  # 0-100
    status: str  # "ketosis", "borderline", "over_limit"
    color: str  # "emerald", "amber", "red"
    message: str

class CustomMealCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    foods: List[Dict[str, Any]]

class CustomMealResponse(BaseModel):
    id: str
    user_id: str
    name: str
    description: str
    foods: List[Dict[str, Any]]
    total_protein: float
    total_carbs: float
    total_fat: float
    total_calories: float
    is_complete_protein: bool
    keto_tier: str
    created_at: datetime

# ============== Auth Helpers ==============

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============== USDA FDC API Client ==============

class FDCClient:
    def __init__(self):
        self.base_url = settings.fdc_base_url
        self.api_key = settings.fdc_api_key
        self.semaphore = asyncio.Semaphore(5)
    
    async def search_foods(self, query: str, page_size: int = 25, page: int = 1, data_type: Optional[str] = None) -> Dict:
        async with self.semaphore:
            async with httpx.AsyncClient(timeout=30.0) as client:
                json_body = {
                    "query": query,
                    "pageSize": page_size,
                    "pageNumber": page - 1
                }
                if data_type:
                    json_body["dataType"] = [data_type]
                
                try:
                    response = await client.post(
                        f"{self.base_url}/foods/search",
                        params={"api_key": self.api_key},
                        json=json_body
                    )
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPError as e:
                    logger.error(f"FDC search error: {e}")
                    return {"foods": [], "totalHits": 0}
    
    async def get_food_details(self, fdc_id: str) -> Optional[Dict]:
        async with self.semaphore:
            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    response = await client.get(
                        f"{self.base_url}/food/{fdc_id}",
                        params={"api_key": self.api_key}
                    )
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPError as e:
                    logger.error(f"FDC details error: {e}")
                    return None
    
    def extract_nutrient(self, food_data: Dict, nutrient_id: int) -> float:
        """Extract a nutrient value from food data."""
        nutrients = food_data.get("foodNutrients", [])
        for nutrient in nutrients:
            n_info = nutrient.get("nutrient", {})
            if n_info.get("id") == nutrient_id:
                return nutrient.get("amount", 0) or 0
        return 0
    
    def extract_amino_acids(self, food_data: Dict) -> List[AminoAcid]:
        """Extract all amino acids from food data."""
        amino_acids = []
        nutrients = food_data.get("foodNutrients", [])
        
        for aa_name, aa_info in ALL_AMINO_ACIDS.items():
            aa_id = aa_info.get("id")
            is_essential = aa_name in ESSENTIAL_AMINO_ACIDS
            
            for nutrient in nutrients:
                n_info = nutrient.get("nutrient", {})
                if n_info.get("id") == aa_id:
                    value = nutrient.get("amount", 0) or 0
                    if value > 0:
                        amino_acids.append(AminoAcid(
                            name=aa_name,
                            value=round(value, 3),
                            unit="g",
                            is_essential=is_essential
                        ))
                    break
        
        return amino_acids
    
    def analyze_protein_completeness(self, amino_acids: List[AminoAcid]) -> tuple:
        """Analyze if protein is complete and identify missing amino acids."""
        present_essential = {aa.name for aa in amino_acids if aa.is_essential and aa.value > 0}
        all_essential = set(ESSENTIAL_AMINO_ACIDS.keys())
        missing = list(all_essential - present_essential)
        is_complete = len(missing) == 0
        
        # Calculate protein quality score (0-100)
        if not present_essential:
            quality_score = 0
        else:
            quality_score = (len(present_essential) / len(all_essential)) * 100
        
        return is_complete, missing, round(quality_score, 1)
    
    def parse_food_detail(self, food_data: Dict) -> FoodDetail:
        """Parse FDC food data into FoodDetail model."""
        amino_acids = self.extract_amino_acids(food_data)
        is_complete, missing, quality_score = self.analyze_protein_completeness(amino_acids)
        
        return FoodDetail(
            fdc_id=str(food_data.get("fdcId", "")),
            description=food_data.get("description", ""),
            brand_owner=food_data.get("brandOwner"),
            serving_size=100,
            serving_unit="g",
            calories=self.extract_nutrient(food_data, 1008),  # Energy
            protein=self.extract_nutrient(food_data, 1003),   # Protein
            fat=self.extract_nutrient(food_data, 1004),       # Total lipid (fat)
            carbs=self.extract_nutrient(food_data, 1005),     # Carbohydrate
            fiber=self.extract_nutrient(food_data, 1079),     # Fiber
            amino_acids=amino_acids,
            is_complete_protein=is_complete,
            missing_amino_acids=missing,
            protein_quality_score=quality_score
        )

fdc_client = FDCClient()

# ============== Open Food Facts Client (Barcode Lookup) ==============

class OpenFoodFactsClient:
    """Client for Open Food Facts barcode lookup API"""
    
    def __init__(self):
        self.base_url = "https://world.openfoodfacts.org/api/v2"
        self.user_agent = "IsotopeNutritionTracker/1.0 (contact@isotope.app)"
        self.semaphore = asyncio.Semaphore(3)
    
    async def lookup_barcode(self, barcode: str) -> Optional[BarcodeProduct]:
        """Look up a product by barcode/UPC"""
        async with self.semaphore:
            async with httpx.AsyncClient(timeout=15.0) as client:
                try:
                    url = f"{self.base_url}/product/{barcode}"
                    params = {
                        "fields": "code,product_name,brands,nutriments,image_url"
                    }
                    headers = {
                        "User-Agent": self.user_agent,
                        "Accept": "application/json"
                    }
                    
                    response = await client.get(url, params=params, headers=headers)
                    
                    if response.status_code == 404:
                        return None
                    
                    response.raise_for_status()
                    data = response.json()
                    
                    if data.get("status") != 1:
                        return None
                    
                    product = data.get("product", {})
                    nutriments = product.get("nutriments", {})
                    
                    return BarcodeProduct(
                        barcode=barcode,
                        product_name=product.get("product_name"),
                        brand=product.get("brands"),
                        protein_per_100g=nutriments.get("proteins_100g", 0) or 0,
                        calories_per_100g=nutriments.get("energy-kcal_100g", 0) or 0,
                        fat_per_100g=nutriments.get("fat_100g", 0) or 0,
                        carbs_per_100g=nutriments.get("carbohydrates_100g", 0) or 0,
                        fiber_per_100g=nutriments.get("fiber_100g", 0) or 0,
                        image_url=product.get("image_url"),
                        source="open_food_facts"
                    )
                    
                except httpx.HTTPError as e:
                    logger.error(f"Open Food Facts lookup error: {e}")
                    return None
                except Exception as e:
                    logger.error(f"Unexpected error in barcode lookup: {e}")
                    return None

off_client = OpenFoodFactsClient()

# ============== Amino Acid Suggestions Helper ==============

async def get_amino_acid_suggestions(user_id: str, date: str) -> AminoAcidSuggestionsResponse:
    """Analyze daily amino acid intake and suggest foods to complete the profile"""
    
    start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    
    # Get user's body weight estimate (default 70kg for RDA calculations)
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    body_weight_kg = user.get("body_weight", 70) if user else 70
    
    # Get today's food logs
    logs = await db.food_logs.find({
        "user_id": user_id,
        "logged_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    # Calculate amino acid totals
    amino_totals = {}
    for log in logs:
        servings = log.get("servings", 1)
        for aa in log.get("amino_acids", []):
            name = aa.get("name", "")
            value = aa.get("value", 0) * servings
            amino_totals[name] = amino_totals.get(name, 0) + value
    
    # Calculate RDAs and identify deficiencies
    missing_amino_acids = []
    low_amino_acids = []
    
    for aa_name, aa_info in ESSENTIAL_AMINO_ACIDS.items():
        current_intake = amino_totals.get(aa_name, 0)
        # RDA in grams (convert from mg/kg * kg)
        rda_grams = (aa_info["rda_mg_per_kg"] * body_weight_kg) / 1000
        
        if current_intake == 0:
            missing_amino_acids.append(aa_name)
            # Get suggested foods for this amino acid
            suggestions = AMINO_ACID_RICH_FOODS.get(aa_name, [])[:3]
            low_amino_acids.append(AminoAcidSuggestion(
                amino_acid=aa_name,
                current_intake=0,
                recommended_intake=round(rda_grams, 2),
                deficit=round(rda_grams, 2),
                suggested_foods=suggestions
            ))
        elif current_intake < rda_grams * 0.8:  # Less than 80% of RDA
            deficit = rda_grams - current_intake
            suggestions = AMINO_ACID_RICH_FOODS.get(aa_name, [])[:3]
            low_amino_acids.append(AminoAcidSuggestion(
                amino_acid=aa_name,
                current_intake=round(current_intake, 3),
                recommended_intake=round(rda_grams, 2),
                deficit=round(deficit, 3),
                suggested_foods=suggestions
            ))
    
    # Sort by deficit (largest first)
    low_amino_acids.sort(key=lambda x: x.deficit, reverse=True)
    
    return AminoAcidSuggestionsResponse(
        date=date,
        missing_amino_acids=missing_amino_acids,
        low_amino_acids=low_amino_acids,
        complete_profile=len(low_amino_acids) == 0
    )

# ============== Auth Routes ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password": hash_password(user_data.password),
        "protein_goal": 150.0,
        "daily_carb_limit": 20.0,
        "body_weight_kg": 70.0,
        "body_fat_percentage": 20.0,
        "protein_per_kg_lbm": 2.0,
        "created_at": now.isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_access_token({"sub": user_id})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            protein_goal=150.0,
            daily_carb_limit=20.0,
            body_weight_kg=70.0,
            body_fat_percentage=20.0,
            protein_per_kg_lbm=2.0,
            created_at=now
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user["id"]})
    
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    else:
        created_at = datetime.now(timezone.utc)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            protein_goal=user.get("protein_goal", 150.0),
            daily_carb_limit=user.get("daily_carb_limit", 20.0),
            body_weight_kg=user.get("body_weight_kg", 70.0),
            body_fat_percentage=user.get("body_fat_percentage", 20.0),
            protein_per_kg_lbm=user.get("protein_per_kg_lbm", 2.0),
            created_at=created_at
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    created_at = current_user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    else:
        created_at = datetime.now(timezone.utc)
    
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        protein_goal=current_user.get("protein_goal", 150.0),
        daily_carb_limit=current_user.get("daily_carb_limit", 20.0),
        body_weight_kg=current_user.get("body_weight_kg", 70.0),
        body_fat_percentage=current_user.get("body_fat_percentage", 20.0),
        protein_per_kg_lbm=current_user.get("protein_per_kg_lbm", 2.0),
        created_at=created_at
    )

@api_router.put("/auth/settings", response_model=UserResponse)
async def update_user_settings(data: UserSettingsUpdate, current_user: dict = Depends(get_current_user)):
    """Update user settings including body composition and keto targets"""
    update_fields = {}
    
    if data.protein_goal is not None:
        update_fields["protein_goal"] = data.protein_goal
    if data.daily_carb_limit is not None:
        update_fields["daily_carb_limit"] = data.daily_carb_limit
    if data.body_weight_kg is not None:
        update_fields["body_weight_kg"] = data.body_weight_kg
    if data.body_fat_percentage is not None:
        update_fields["body_fat_percentage"] = data.body_fat_percentage
    if data.protein_per_kg_lbm is not None:
        update_fields["protein_per_kg_lbm"] = data.protein_per_kg_lbm
    
    if update_fields:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_fields}
        )
    
    # Fetch updated user
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    
    created_at = updated_user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    else:
        created_at = datetime.now(timezone.utc)
    
    return UserResponse(
        id=updated_user["id"],
        email=updated_user["email"],
        name=updated_user["name"],
        protein_goal=updated_user.get("protein_goal", 150.0),
        daily_carb_limit=updated_user.get("daily_carb_limit", 20.0),
        body_weight_kg=updated_user.get("body_weight_kg", 70.0),
        body_fat_percentage=updated_user.get("body_fat_percentage", 20.0),
        protein_per_kg_lbm=updated_user.get("protein_per_kg_lbm", 2.0),
        created_at=created_at
    )

@api_router.get("/auth/calculate-protein-goal")
async def calculate_protein_goal(current_user: dict = Depends(get_current_user)):
    """Calculate recommended protein goal based on lean body mass"""
    body_weight = current_user.get("body_weight_kg", 70.0)
    body_fat_pct = current_user.get("body_fat_percentage", 20.0)
    protein_multiplier = current_user.get("protein_per_kg_lbm", 2.0)
    
    lean_body_mass = body_weight * (1 - body_fat_pct / 100)
    recommended_protein = lean_body_mass * protein_multiplier
    
    return {
        "body_weight_kg": body_weight,
        "body_fat_percentage": body_fat_pct,
        "lean_body_mass_kg": round(lean_body_mass, 1),
        "protein_per_kg_lbm": protein_multiplier,
        "recommended_protein_goal": round(recommended_protein, 0),
        "formula": f"{lean_body_mass:.1f}kg LBM × {protein_multiplier}g/kg = {recommended_protein:.0f}g protein"
    }

@api_router.put("/auth/protein-goal", response_model=UserResponse)
async def update_protein_goal(data: ProteinGoalUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"protein_goal": data.protein_goal}}
    )
    
    created_at = current_user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    else:
        created_at = datetime.now(timezone.utc)
    
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        protein_goal=data.protein_goal,
        daily_carb_limit=current_user.get("daily_carb_limit", 20.0),
        body_weight_kg=current_user.get("body_weight_kg", 70.0),
        body_fat_percentage=current_user.get("body_fat_percentage", 20.0),
        protein_per_kg_lbm=current_user.get("protein_per_kg_lbm", 2.0),
        created_at=created_at
    )

# ============== Food Search Routes ==============

@api_router.get("/foods/search")
async def search_foods(
    query: str = Query(..., min_length=1),
    page_size: int = Query(25, ge=1, le=100),
    page: int = Query(1, ge=1),
    data_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    result = await fdc_client.search_foods(query, page_size, page, data_type)
    
    foods = []
    for food in result.get("foods", []):
        protein = 0
        for nutrient in food.get("foodNutrients", []):
            if nutrient.get("nutrientId") == 1003:
                protein = nutrient.get("value", 0) or 0
                break
        
        foods.append({
            "fdc_id": str(food.get("fdcId", "")),
            "description": food.get("description", ""),
            "brand_owner": food.get("brandOwner"),
            "data_type": food.get("dataType", ""),
            "protein_per_100g": round(protein, 2)
        })
    
    return {
        "foods": foods,
        "total_hits": result.get("totalHits", 0),
        "current_page": page,
        "page_size": page_size
    }

@api_router.get("/foods/{fdc_id}")
async def get_food_details(fdc_id: str, current_user: dict = Depends(get_current_user)):
    food_data = await fdc_client.get_food_details(fdc_id)
    if not food_data:
        raise HTTPException(status_code=404, detail="Food not found")
    
    food_detail = fdc_client.parse_food_detail(food_data)
    return food_detail

# ============== Barcode Lookup Routes ==============

@api_router.get("/barcode/{barcode}")
async def lookup_barcode(barcode: str, current_user: dict = Depends(get_current_user)):
    """Look up a product by barcode/UPC using Open Food Facts"""
    # Validate barcode format
    if not barcode.isdigit() or not (8 <= len(barcode) <= 14):
        raise HTTPException(status_code=400, detail="Invalid barcode format. Must be 8-14 digits.")
    
    product = await off_client.lookup_barcode(barcode)
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in Open Food Facts database")
    
    return product

@api_router.post("/barcode/log")
async def log_barcode_product(
    barcode: str = Query(...),
    servings: float = Query(1.0),
    serving_size: float = Query(100.0),
    meal_type: str = Query("snack"),
    current_user: dict = Depends(get_current_user)
):
    """Look up a barcode and add it directly to the food log"""
    product = await off_client.lookup_barcode(barcode)
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Scale nutrition based on serving size
    scale = serving_size / 100.0
    
    log_doc = {
        "id": log_id,
        "user_id": current_user["id"],
        "fdc_id": f"barcode:{barcode}",
        "description": f"{product.product_name or 'Unknown Product'} ({product.brand or 'Unknown Brand'})",
        "serving_size": serving_size,
        "serving_unit": "g",
        "servings": servings,
        "calories": product.calories_per_100g * scale,
        "protein": product.protein_per_100g * scale,
        "fat": product.fat_per_100g * scale,
        "carbs": product.carbs_per_100g * scale,
        "fiber": product.fiber_per_100g * scale,
        "amino_acids": [],  # Open Food Facts doesn't have amino acid data
        "meal_type": meal_type,
        "logged_at": now.isoformat(),
        "created_at": now.isoformat(),
        "barcode": barcode,
        "image_url": product.image_url
    }
    
    await db.food_logs.insert_one(log_doc)
    
    return {
        "message": "Product added to log",
        "log_id": log_id,
        "product": product
    }

# ============== Amino Acid Suggestions Routes ==============

@api_router.get("/suggestions/amino-acids", response_model=AminoAcidSuggestionsResponse)
async def get_suggestions(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Get amino acid intake analysis and food suggestions to complete the profile"""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    suggestions = await get_amino_acid_suggestions(current_user["id"], date)
    return suggestions

@api_router.get("/suggestions/complete-protein")
async def get_complete_protein_foods(
    keto_only: bool = Query(True, description="Show only keto-friendly options"),
    current_user: dict = Depends(get_current_user)
):
    """Get a list of keto-friendly complete protein foods"""
    return {
        "complete_protein_foods": KETO_COMPLETE_PROTEINS,
        "tip": "All foods shown are keto-friendly with less than 5g carbs per 100g. Ultra-low means under 2g carbs."
    }

@api_router.get("/suggestions/keto-meals")
async def get_keto_meal_combos(current_user: dict = Depends(get_current_user)):
    """Get pre-built keto meal combinations with complete amino acid profiles"""
    return {
        "meal_combos": KETO_MEAL_COMBOS,
        "tip": "These meal combinations provide all 9 essential amino acids while staying under 5g net carbs per meal."
    }

@api_router.post("/meal-builder/analyze")
async def analyze_meal_combo(
    food_ids: List[str] = Query(..., description="List of FDC IDs to combine"),
    current_user: dict = Depends(get_current_user)
):
    """Analyze a combination of foods for combined amino acid profile and keto-friendliness"""
    combined_amino_acids = {}
    total_protein = 0
    total_carbs = 0
    total_fat = 0
    total_calories = 0
    foods_data = []
    
    for fdc_id in food_ids[:10]:  # Limit to 10 foods
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
    
    # Check for complete protein
    essential_present = []
    essential_missing = []
    for aa_name in ESSENTIAL_AMINO_ACIDS.keys():
        if combined_amino_acids.get(aa_name, 0) > 0:
            essential_present.append(aa_name)
        else:
            essential_missing.append(aa_name)
    
    is_complete = len(essential_missing) == 0
    
    # Determine keto tier
    if total_carbs <= 2:
        keto_tier = "ultra_low"
        keto_label = "Ultra Low Carb (≤2g)"
    elif total_carbs <= 5:
        keto_tier = "low"
        keto_label = "Low Carb (≤5g)"
    elif total_carbs <= 10:
        keto_tier = "moderate"
        keto_label = "Moderate Carb (≤10g)"
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

# ============== Keto Score Routes ==============

@api_router.get("/keto-score", response_model=KetoScore)
async def get_keto_score(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Calculate the Keto Score for the day based on carb intake vs limit"""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    
    # Get daily logs
    logs = await db.food_logs.find({
        "user_id": current_user["id"],
        "logged_at": {"$gte": start.isoformat(), "$lt": end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    # Calculate net carbs
    total_carbs = sum(log.get("carbs", 0) * log.get("servings", 1) for log in logs)
    total_fiber = sum(log.get("fiber", 0) * log.get("servings", 1) for log in logs)
    net_carbs = max(0, total_carbs - total_fiber)
    
    carb_limit = current_user.get("daily_carb_limit", 20.0)
    carbs_remaining = max(0, carb_limit - net_carbs)
    
    # Calculate score (100 = perfect keto, 0 = way over limit)
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

# ============== Custom Meals Routes ==============

@api_router.post("/custom-meals", response_model=CustomMealResponse)
async def create_custom_meal(meal_data: CustomMealCreate, current_user: dict = Depends(get_current_user)):
    """Save a custom meal combination"""
    meal_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    # Calculate totals
    total_protein = sum(f.get("protein", 0) * f.get("servings", 1) for f in meal_data.foods)
    total_carbs = sum(f.get("carbs", 0) * f.get("servings", 1) for f in meal_data.foods)
    total_fat = sum(f.get("fat", 0) * f.get("servings", 1) for f in meal_data.foods)
    total_calories = sum(f.get("calories", 0) * f.get("servings", 1) for f in meal_data.foods)
    
    # Determine keto tier
    if total_carbs <= 2:
        keto_tier = "ultra_low"
    elif total_carbs <= 5:
        keto_tier = "low"
    elif total_carbs <= 10:
        keto_tier = "moderate"
    else:
        keto_tier = "high"
    
    # Check for complete protein (simplified - based on stored data)
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

@api_router.get("/custom-meals", response_model=List[CustomMealResponse])
async def get_custom_meals(current_user: dict = Depends(get_current_user)):
    """Get all saved custom meals"""
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

@api_router.delete("/custom-meals/{meal_id}")
async def delete_custom_meal(meal_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.custom_meals.delete_one({"id": meal_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom meal not found")
    return {"message": "Custom meal deleted"}

@api_router.post("/custom-meals/{meal_id}/log")
async def log_custom_meal(
    meal_id: str,
    meal_type: str = Query("snack"),
    current_user: dict = Depends(get_current_user)
):
    """Add all foods from a custom meal to today's food log"""
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

# ============== Food Log Routes ==============

@api_router.post("/logs", response_model=FoodLogResponse)
async def create_food_log(log_data: FoodLogCreate, current_user: dict = Depends(get_current_user)):
    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    logged_at = log_data.logged_at or now
    
    log_doc = {
        "id": log_id,
        "user_id": current_user["id"],
        "fdc_id": log_data.fdc_id,
        "description": log_data.description,
        "serving_size": log_data.serving_size,
        "serving_unit": log_data.serving_unit,
        "servings": log_data.servings,
        "calories": log_data.calories,
        "protein": log_data.protein,
        "fat": log_data.fat,
        "carbs": log_data.carbs,
        "fiber": log_data.fiber,
        "amino_acids": log_data.amino_acids,
        "meal_type": log_data.meal_type,
        "logged_at": logged_at.isoformat() if isinstance(logged_at, datetime) else logged_at,
        "created_at": now.isoformat()
    }
    
    await db.food_logs.insert_one(log_doc)
    
    return FoodLogResponse(
        id=log_id,
        user_id=current_user["id"],
        fdc_id=log_data.fdc_id,
        description=log_data.description,
        serving_size=log_data.serving_size,
        serving_unit=log_data.serving_unit,
        servings=log_data.servings,
        calories=log_data.calories,
        protein=log_data.protein,
        fat=log_data.fat,
        carbs=log_data.carbs,
        fiber=log_data.fiber,
        amino_acids=log_data.amino_acids,
        meal_type=log_data.meal_type,
        logged_at=logged_at if isinstance(logged_at, datetime) else datetime.fromisoformat(logged_at),
        created_at=now
    )

@api_router.get("/logs", response_model=List[FoodLogResponse])
async def get_food_logs(
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    
    if date:
        # Filter by date
        start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        query["logged_at"] = {
            "$gte": start.isoformat(),
            "$lt": end.isoformat()
        }
    
    logs = await db.food_logs.find(query, {"_id": 0}).sort("logged_at", -1).to_list(500)
    
    result = []
    for log in logs:
        logged_at = log.get("logged_at")
        created_at = log.get("created_at")
        
        if isinstance(logged_at, str):
            logged_at = datetime.fromisoformat(logged_at)
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        
        result.append(FoodLogResponse(
            id=log["id"],
            user_id=log["user_id"],
            fdc_id=log["fdc_id"],
            description=log["description"],
            serving_size=log["serving_size"],
            serving_unit=log["serving_unit"],
            servings=log["servings"],
            calories=log.get("calories", 0),
            protein=log.get("protein", 0),
            fat=log.get("fat", 0),
            carbs=log.get("carbs", 0),
            fiber=log.get("fiber", 0),
            amino_acids=log.get("amino_acids", []),
            meal_type=log.get("meal_type", "snack"),
            logged_at=logged_at,
            created_at=created_at
        ))
    
    return result

@api_router.delete("/logs/{log_id}")
async def delete_food_log(log_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.food_logs.delete_one({"id": log_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Log not found")
    return {"message": "Log deleted"}

# ============== Daily Stats Routes ==============

@api_router.get("/stats/daily", response_model=DailyStats)
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

@api_router.get("/stats/weekly")
async def get_weekly_stats(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    
    daily_stats = []
    for i in range(7):
        day = week_ago + timedelta(days=i)
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

# ============== Meal Plan Routes ==============

@api_router.post("/meal-plans", response_model=MealPlanResponse)
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

@api_router.get("/meal-plans", response_model=List[MealPlanResponse])
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

@api_router.delete("/meal-plans/{plan_id}")
async def delete_meal_plan(plan_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.meal_plans.delete_one({"id": plan_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    return {"message": "Meal plan deleted"}

# ============== Favorites Routes ==============

@api_router.post("/favorites", response_model=FavoriteResponse)
async def add_favorite(fav_data: FavoriteCreate, current_user: dict = Depends(get_current_user)):
    # Check if already favorited
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

@api_router.get("/favorites", response_model=List[FavoriteResponse])
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

@api_router.delete("/favorites/{fav_id}")
async def remove_favorite(fav_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.favorites.delete_one({"id": fav_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"message": "Favorite removed"}

@api_router.get("/favorites/check/{fdc_id}")
async def check_favorite(fdc_id: str, current_user: dict = Depends(get_current_user)):
    fav = await db.favorites.find_one({
        "user_id": current_user["id"],
        "fdc_id": fdc_id
    }, {"_id": 0})
    return {"is_favorite": fav is not None, "favorite_id": fav.get("id") if fav else None}

# ============== Root Routes ==============

@api_router.get("/")
async def root():
    return {"message": "Keto Nutrition Tracker API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
