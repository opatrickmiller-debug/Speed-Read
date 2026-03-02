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

# Essential Amino Acids data
ESSENTIAL_AMINO_ACIDS = {
    "Histidine": {"id": 512, "rda_mg_per_kg": 14},
    "Isoleucine": {"id": 503, "rda_mg_per_kg": 19},
    "Leucine": {"id": 504, "rda_mg_per_kg": 42},
    "Lysine": {"id": 505, "rda_mg_per_kg": 38},
    "Methionine": {"id": 506, "rda_mg_per_kg": 19},
    "Phenylalanine": {"id": 508, "rda_mg_per_kg": 33},
    "Threonine": {"id": 502, "rda_mg_per_kg": 20},
    "Tryptophan": {"id": 501, "rda_mg_per_kg": 5},
    "Valine": {"id": 510, "rda_mg_per_kg": 24}
}

ALL_AMINO_ACIDS = {
    **ESSENTIAL_AMINO_ACIDS,
    "Alanine": {"id": 513, "essential": False},
    "Arginine": {"id": 511, "essential": False},
    "Aspartic acid": {"id": 514, "essential": False},
    "Cystine": {"id": 507, "essential": False},
    "Glutamic acid": {"id": 515, "essential": False},
    "Glycine": {"id": 516, "essential": False},
    "Proline": {"id": 517, "essential": False},
    "Serine": {"id": 518, "essential": False},
    "Tyrosine": {"id": 509, "essential": False}
}

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
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

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
        created_at=created_at
    )

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
