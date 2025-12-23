from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import os
import logging
import secrets
import re
from pathlib import Path
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import httpx
from bson import ObjectId
from jose import JWTError, jwt
from passlib.context import CryptContext

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ==================== SECURITY CONFIGURATION ====================

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Rate limiting - using SlowAPIMiddleware for proper router support  
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# Security scheme
security = HTTPBearer(auto_error=False)

# Allowed origins for CORS (must be set in environment)
ALLOWED_ORIGINS = os.environ.get('CORS_ORIGINS', '').split(',')
if not ALLOWED_ORIGINS or ALLOWED_ORIGINS == ['']:
    ALLOWED_ORIGINS = ['http://localhost:3000']  # Fallback for local dev only

# ==================== DATABASE ====================

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Collections
trips_collection = db.trips
users_collection = db.users
speed_traps_collection = db.speed_traps
families_collection = db.families
badges_collection = db.badges
stats_collection = db.user_stats

# Create the main app
app = FastAPI(
    title="Speed Alert API",
    docs_url="/api/docs" if os.environ.get('DEBUG') else None,  # Disable docs in production
    redoc_url=None
)

# Add rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging (less verbose in production)
log_level = logging.DEBUG if os.environ.get('DEBUG') else logging.WARNING
logging.basicConfig(
    level=log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== SECURITY HELPERS ====================

def sanitize_string(value: str, max_length: int = 200) -> str:
    """Sanitize string input to prevent XSS and injection."""
    if not value:
        return value
    # Remove potentially dangerous characters
    sanitized = re.sub(r'[<>"\';\\]', '', value)
    # Limit length
    return sanitized[:max_length].strip()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[dict]:
    """Get current user from JWT token. Returns None if no valid token."""
    if not credentials:
        return None
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
        return user
    except (JWTError, Exception):
        return None

async def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Require valid authentication. Raises 401 if not authenticated."""
    user = await get_current_user(credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# ==================== MODELS ====================

class UserRegister(BaseModel):
    email: str
    password: str
    
    @validator('email')
    def validate_email(cls, v):
        if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', v):
            raise ValueError('Invalid email format')
        return v.lower().strip()
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v

class UserLogin(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str

class SpeedLimitResponse(BaseModel):
    speed_limit: int | None
    unit: str
    road_name: str | None
    source: str

class TripDataPoint(BaseModel):
    timestamp: str
    lat: float
    lon: float
    speed: float
    speed_limit: Optional[int] = None
    is_speeding: bool = False
    
    @validator('lat')
    def validate_lat(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('Latitude must be between -90 and 90')
        return v
    
    @validator('lon')
    def validate_lon(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('Longitude must be between -180 and 180')
        return v
    
    @validator('speed')
    def validate_speed(cls, v):
        if v < 0 or v > 500:
            raise ValueError('Speed must be between 0 and 500')
        return v

class StartTripRequest(BaseModel):
    start_lat: float
    start_lon: float
    speed_unit: str = "mph"
    
    @validator('speed_unit')
    def validate_unit(cls, v):
        if v not in ['mph', 'km/h']:
            raise ValueError('Speed unit must be mph or km/h')
        return v

class EndTripRequest(BaseModel):
    trip_id: str
    end_lat: float
    end_lon: float

class AddDataPointRequest(BaseModel):
    trip_id: str
    data_point: TripDataPoint

class TripResponse(BaseModel):
    id: str
    start_time: str
    end_time: Optional[str] = None
    duration_minutes: Optional[float] = None
    max_speed: float = 0
    avg_speed: float = 0
    total_alerts: int = 0
    speed_unit: str = "mph"
    distance_miles: Optional[float] = None
    start_location: Optional[str] = None
    is_active: bool = True

class TripDetailResponse(TripResponse):
    data_points: List[TripDataPoint] = []

# OpenStreetMap Overpass API for speed limits
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=TokenResponse)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserRegister):
    """Register a new user."""
    # Check if user exists
    existing = await users_collection.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = {
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await users_collection.insert_one(user)
    user_id = str(result.inserted_id)
    
    # Generate token
    token = create_access_token({"sub": user_id})
    
    return TokenResponse(
        access_token=token,
        user_id=user_id,
        email=user_data.email
    )

@api_router.post("/auth/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, user_data: UserLogin):
    """Login and get access token."""
    user = await users_collection.find_one({"email": user_data.email.lower().strip()})
    
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    token = create_access_token({"sub": user_id})
    
    return TokenResponse(
        access_token=token,
        user_id=user_id,
        email=user["email"]
    )

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(require_auth)):
    """Get current user info."""
    return {
        "user_id": str(user["_id"]),
        "email": user["email"],
        "created_at": user.get("created_at")
    }

# ==================== PUBLIC ENDPOINTS ====================

@api_router.get("/")
@limiter.limit("100/minute")
async def root(request: Request):
    return {"message": "Speed Alert API", "version": "1.0.0"}

@api_router.get("/speed-limit")
@limiter.limit("30/minute")
async def get_speed_limit(request: Request, lat: float, lon: float):
    """
    Fetch speed limit for a given location using OpenStreetMap Overpass API.
    """
    # Validate coordinates
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    query = f"""
    [out:json][timeout:10];
    way(around:30,{lat},{lon})["highway"]["maxspeed"];
    out body;
    """
    
    max_retries = 2
    last_error = None
    
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                response = await http_client.post(
                    OVERPASS_URL,
                    data={"data": query},
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                response.raise_for_status()
                data = response.json()
                
                if data.get("elements") and len(data["elements"]) > 0:
                    road = data["elements"][0]
                    tags = road.get("tags", {})
                    maxspeed = tags.get("maxspeed", "")
                    road_name = tags.get("name") or tags.get("ref") or "Unknown Road"
                    
                    # Sanitize road name
                    road_name = sanitize_string(road_name, 100)
                    
                    speed_limit = None
                    unit = "mph"
                    
                    if maxspeed:
                        maxspeed_clean = maxspeed.lower().strip()
                        
                        if "mph" in maxspeed_clean:
                            speed_limit = int(''.join(filter(str.isdigit, maxspeed_clean)))
                            unit = "mph"
                        elif "km/h" in maxspeed_clean or "kmh" in maxspeed_clean:
                            speed_limit = int(''.join(filter(str.isdigit, maxspeed_clean)))
                            unit = "km/h"
                        elif maxspeed_clean.isdigit():
                            speed_limit = int(maxspeed_clean)
                            unit = "km/h"
                        else:
                            digits = ''.join(filter(str.isdigit, maxspeed_clean))
                            if digits:
                                speed_limit = int(digits)
                                unit = "km/h"
                    
                    return SpeedLimitResponse(
                        speed_limit=speed_limit,
                        unit=unit,
                        road_name=road_name,
                        source="openstreetmap"
                    )
                
                return SpeedLimitResponse(
                    speed_limit=None,
                    unit="mph",
                    road_name=None,
                    source="openstreetmap"
                )
                
        except httpx.TimeoutException as e:
            last_error = e
            if attempt < max_retries - 1:
                continue
        except httpx.HTTPStatusError as e:
            last_error = e
            if attempt < max_retries - 1:
                continue
        except Exception as e:
            last_error = e
            break
    
    logger.warning(f"Speed limit fetch failed for {lat}, {lon}")
    return SpeedLimitResponse(
        speed_limit=None,
        unit="mph",
        road_name=None,
        source="error"
    )

# ==================== PROTECTED TRIP ENDPOINTS ====================

@api_router.post("/trips/start")
@limiter.limit("20/minute")
async def start_trip(request: Request, trip_request: StartTripRequest, user: dict = Depends(require_auth)):
    """Start a new trip recording session. Requires authentication."""
    trip = {
        "user_id": str(user["_id"]),
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": None,
        "start_lat": trip_request.start_lat,
        "start_lon": trip_request.start_lon,
        "end_lat": None,
        "end_lon": None,
        "speed_unit": trip_request.speed_unit,
        "max_speed": 0,
        "total_speed": 0,
        "speed_count": 0,
        "total_alerts": 0,
        "data_points": [],
        "is_active": True
    }
    
    result = await trips_collection.insert_one(trip)
    
    return {
        "trip_id": str(result.inserted_id),
        "start_time": trip["start_time"],
        "message": "Trip started"
    }

@api_router.post("/trips/data-point")
@limiter.limit("60/minute")
async def add_data_point(request: Request, dp_request: AddDataPointRequest, user: dict = Depends(require_auth)):
    """Add a data point to an active trip. Requires authentication."""
    try:
        trip_id = ObjectId(dp_request.trip_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trip ID")
    
    # Find trip and verify ownership
    trip = await trips_collection.find_one({
        "_id": trip_id,
        "user_id": str(user["_id"])  # User isolation
    })
    
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if not trip.get("is_active"):
        raise HTTPException(status_code=400, detail="Trip is not active")
    
    data_point = dp_request.data_point.model_dump()
    
    update = {
        "$push": {"data_points": data_point},
        "$inc": {
            "speed_count": 1,
            "total_speed": data_point["speed"],
            "total_alerts": 1 if data_point["is_speeding"] else 0
        }
    }
    
    if data_point["speed"] > trip.get("max_speed", 0):
        update["$set"] = {"max_speed": data_point["speed"]}
    
    await trips_collection.update_one({"_id": trip_id}, update)
    
    return {"message": "Data point added"}

@api_router.post("/trips/end")
@limiter.limit("20/minute")
async def end_trip(request: Request, end_request: EndTripRequest, user: dict = Depends(require_auth)):
    """End an active trip. Requires authentication."""
    try:
        trip_id = ObjectId(end_request.trip_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trip ID")
    
    # Find trip and verify ownership
    trip = await trips_collection.find_one({
        "_id": trip_id,
        "user_id": str(user["_id"])
    })
    
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    end_time = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(trip["start_time"].replace('Z', '+00:00'))
    duration_minutes = (end_time - start_time).total_seconds() / 60
    
    avg_speed = 0
    if trip.get("speed_count", 0) > 0:
        avg_speed = trip.get("total_speed", 0) / trip["speed_count"]
    
    distance_miles = 0
    data_points = trip.get("data_points", [])
    if len(data_points) > 1:
        from math import radians, sin, cos, sqrt, atan2
        R = 3959
        for i in range(1, len(data_points)):
            p1, p2 = data_points[i-1], data_points[i]
            lat1, lon1 = radians(p1["lat"]), radians(p1["lon"])
            lat2, lon2 = radians(p2["lat"]), radians(p2["lon"])
            dlat, dlon = lat2 - lat1, lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            distance_miles += R * c
    
    update = {
        "$set": {
            "end_time": end_time.isoformat(),
            "end_lat": end_request.end_lat,
            "end_lon": end_request.end_lon,
            "duration_minutes": round(duration_minutes, 1),
            "avg_speed": round(avg_speed, 1),
            "distance_miles": round(distance_miles, 2),
            "is_active": False
        }
    }
    
    await trips_collection.update_one({"_id": trip_id}, update)
    
    return {
        "message": "Trip ended",
        "duration_minutes": round(duration_minutes, 1),
        "max_speed": trip.get("max_speed", 0),
        "avg_speed": round(avg_speed, 1),
        "total_alerts": trip.get("total_alerts", 0),
        "distance_miles": round(distance_miles, 2)
    }

@api_router.get("/trips")
@limiter.limit("30/minute")
async def get_trips(request: Request, limit: int = 20, skip: int = 0, user: dict = Depends(require_auth)):
    """Get trip history list. Only returns user's own trips."""
    # Validate pagination
    limit = min(max(1, limit), 100)
    skip = max(0, skip)
    
    cursor = trips_collection.find(
        {"user_id": str(user["_id"])},  # User isolation
        {"data_points": 0}
    ).sort("start_time", -1).skip(skip).limit(limit)
    
    trips = []
    async for trip in cursor:
        trips.append(TripResponse(
            id=str(trip["_id"]),
            start_time=trip["start_time"],
            end_time=trip.get("end_time"),
            duration_minutes=trip.get("duration_minutes"),
            max_speed=trip.get("max_speed", 0),
            avg_speed=trip.get("avg_speed", 0),
            total_alerts=trip.get("total_alerts", 0),
            speed_unit=trip.get("speed_unit", "mph"),
            distance_miles=trip.get("distance_miles"),
            is_active=trip.get("is_active", False)
        ))
    
    total = await trips_collection.count_documents({"user_id": str(user["_id"])})
    
    return {
        "trips": trips,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/trips/{trip_id}")
@limiter.limit("30/minute")
async def get_trip_detail(request: Request, trip_id: str, user: dict = Depends(require_auth)):
    """Get detailed trip information. Only accessible by trip owner."""
    try:
        oid = ObjectId(trip_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trip ID")
    
    trip = await trips_collection.find_one({
        "_id": oid,
        "user_id": str(user["_id"])
    })
    
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    return TripDetailResponse(
        id=str(trip["_id"]),
        start_time=trip["start_time"],
        end_time=trip.get("end_time"),
        duration_minutes=trip.get("duration_minutes"),
        max_speed=trip.get("max_speed", 0),
        avg_speed=trip.get("avg_speed", 0),
        total_alerts=trip.get("total_alerts", 0),
        speed_unit=trip.get("speed_unit", "mph"),
        distance_miles=trip.get("distance_miles"),
        is_active=trip.get("is_active", False),
        data_points=[TripDataPoint(**dp) for dp in trip.get("data_points", [])]
    )

@api_router.delete("/trips/{trip_id}")
@limiter.limit("20/minute")
async def delete_trip(request: Request, trip_id: str, user: dict = Depends(require_auth)):
    """Delete a trip. Only accessible by trip owner."""
    try:
        oid = ObjectId(trip_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trip ID")
    
    result = await trips_collection.delete_one({
        "_id": oid,
        "user_id": str(user["_id"])
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    return {"message": "Trip deleted"}

# ==================== GAMIFICATION ENDPOINTS ====================

BADGES = {
    "first_trip": {"name": "First Trip", "description": "Complete your first trip", "icon": "🚗"},
    "safe_week": {"name": "Safe Week", "description": "7 days without speeding alerts", "icon": "🛡️"},
    "road_warrior": {"name": "Road Warrior", "description": "Complete 50 trips", "icon": "🏆"},
    "speed_demon_reformed": {"name": "Reformed", "description": "Reduce alerts by 50% week over week", "icon": "😇"},
    "night_owl": {"name": "Night Owl", "description": "Complete 10 trips after 10 PM", "icon": "🦉"},
    "early_bird": {"name": "Early Bird", "description": "Complete 10 trips before 7 AM", "icon": "🐦"},
    "marathon_driver": {"name": "Marathon Driver", "description": "Drive 100 miles in one trip", "icon": "🏃"},
    "consistent": {"name": "Consistent", "description": "Record trips 7 days in a row", "icon": "📅"},
    "explorer": {"name": "Explorer", "description": "Drive in 10 different speed limit zones", "icon": "🗺️"},
    "perfect_trip": {"name": "Perfect Trip", "description": "Complete a trip with zero alerts", "icon": "⭐"},
}

class UserStatsResponse(BaseModel):
    total_trips: int = 0
    total_distance: float = 0
    total_alerts: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    avg_speed: float = 0
    safe_trip_percentage: float = 0
    badges: List[str] = []
    weekly_stats: dict = {}

@api_router.get("/stats")
@limiter.limit("30/minute")
async def get_user_stats(request: Request, user: dict = Depends(require_auth)):
    """Get user's gamification stats and badges."""
    user_id = str(user["_id"])
    
    # Get all user trips (exclude data_points for performance)
    trips = await trips_collection.find(
        {"user_id": user_id, "is_active": False},
        {"data_points": 0, "_id": 0}
    ).to_list(length=500)
    
    if not trips:
        return UserStatsResponse()
    
    # Calculate stats
    total_trips = len(trips)
    total_distance = sum(t.get("distance_miles", 0) or 0 for t in trips)
    total_alerts = sum(t.get("total_alerts", 0) for t in trips)
    total_speed = sum(t.get("avg_speed", 0) for t in trips)
    avg_speed = total_speed / total_trips if total_trips > 0 else 0
    
    safe_trips = sum(1 for t in trips if t.get("total_alerts", 0) == 0)
    safe_trip_percentage = (safe_trips / total_trips * 100) if total_trips > 0 else 0
    
    # Calculate streaks (consecutive days with trips and no alerts)
    trip_dates = sorted(set(
        datetime.fromisoformat(t["start_time"].replace('Z', '+00:00')).date()
        for t in trips if t.get("total_alerts", 0) == 0
    ))
    
    current_streak = 0
    longest_streak = 0
    if trip_dates:
        today = datetime.now(timezone.utc).date()
        streak = 0
        for i, date in enumerate(reversed(trip_dates)):
            expected_date = today - timedelta(days=i)
            if date == expected_date:
                streak += 1
            else:
                break
        current_streak = streak
        
        # Calculate longest streak
        streak = 1
        for i in range(1, len(trip_dates)):
            if (trip_dates[i] - trip_dates[i-1]).days == 1:
                streak += 1
                longest_streak = max(longest_streak, streak)
            else:
                streak = 1
        longest_streak = max(longest_streak, streak)
    
    # Weekly stats (last 4 weeks)
    weekly_stats = {}
    now = datetime.now(timezone.utc)
    for week in range(4):
        week_start = now - timedelta(days=now.weekday() + 7 * week)
        week_end = week_start + timedelta(days=7)
        week_trips = [t for t in trips if week_start.isoformat() <= t["start_time"] < week_end.isoformat()]
        weekly_stats[f"week_{week}"] = {
            "trips": len(week_trips),
            "distance": sum(t.get("distance_miles", 0) or 0 for t in week_trips),
            "alerts": sum(t.get("total_alerts", 0) for t in week_trips)
        }
    
    # Check and award badges
    earned_badges = []
    
    if total_trips >= 1:
        earned_badges.append("first_trip")
    if total_trips >= 50:
        earned_badges.append("road_warrior")
    if current_streak >= 7:
        earned_badges.append("safe_week")
    if safe_trips >= 1:
        earned_badges.append("perfect_trip")
    if any(t.get("distance_miles", 0) and t["distance_miles"] >= 100 for t in trips):
        earned_badges.append("marathon_driver")
    
    # Store badges
    await stats_collection.update_one(
        {"user_id": user_id},
        {"$set": {"badges": earned_badges, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return UserStatsResponse(
        total_trips=total_trips,
        total_distance=round(total_distance, 1),
        total_alerts=total_alerts,
        current_streak=current_streak,
        longest_streak=longest_streak,
        avg_speed=round(avg_speed, 1),
        safe_trip_percentage=round(safe_trip_percentage, 1),
        badges=earned_badges,
        weekly_stats=weekly_stats
    )

@api_router.get("/badges")
async def get_all_badges():
    """Get all available badges."""
    return {"badges": BADGES}

# ==================== EXPORT REPORTS ENDPOINTS ====================

class ReportRequest(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    format: str = "json"  # json or summary

@api_router.post("/reports/generate")
@limiter.limit("10/minute")
async def generate_report(request: Request, report_req: ReportRequest, user: dict = Depends(require_auth)):
    """Generate a driving report for insurance or personal use."""
    user_id = str(user["_id"])
    
    # Build query
    query = {"user_id": user_id, "is_active": False}
    
    if report_req.start_date:
        query["start_time"] = {"$gte": report_req.start_date}
    if report_req.end_date:
        if "start_time" in query:
            query["start_time"]["$lte"] = report_req.end_date
        else:
            query["start_time"] = {"$lte": report_req.end_date}
    
    trips = await trips_collection.find(query, {"data_points": 0, "_id": 0}).to_list(length=200)
    
    if not trips:
        return {"error": "No trips found for the specified period"}
    
    # Calculate report metrics
    total_trips = len(trips)
    total_distance = sum(t.get("distance_miles", 0) or 0 for t in trips)
    total_duration = sum(t.get("duration_minutes", 0) or 0 for t in trips)
    total_alerts = sum(t.get("total_alerts", 0) for t in trips)
    safe_trips = sum(1 for t in trips if t.get("total_alerts", 0) == 0)
    max_speed_recorded = max(t.get("max_speed", 0) for t in trips)
    avg_speed = sum(t.get("avg_speed", 0) for t in trips) / total_trips if total_trips > 0 else 0
    
    # Safety score (0-100)
    safety_score = max(0, 100 - (total_alerts / max(total_trips, 1)) * 20)
    safety_score = min(100, safety_score)
    
    report = {
        "report_id": secrets.token_hex(8),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "user_email": user.get("email"),
        "period": {
            "start": report_req.start_date or trips[-1]["start_time"] if trips else None,
            "end": report_req.end_date or trips[0]["start_time"] if trips else None
        },
        "summary": {
            "total_trips": total_trips,
            "total_distance_miles": round(total_distance, 1),
            "total_duration_hours": round(total_duration / 60, 1),
            "total_alerts": total_alerts,
            "safe_trips": safe_trips,
            "safe_trip_percentage": round((safe_trips / total_trips * 100) if total_trips > 0 else 0, 1),
            "max_speed_recorded": round(max_speed_recorded, 1),
            "average_speed": round(avg_speed, 1),
            "safety_score": round(safety_score, 1)
        },
        "rating": "Excellent" if safety_score >= 90 else "Good" if safety_score >= 70 else "Fair" if safety_score >= 50 else "Needs Improvement",
        "trips": [
            {
                "date": t["start_time"],
                "duration_minutes": t.get("duration_minutes", 0),
                "distance_miles": t.get("distance_miles", 0),
                "max_speed": t.get("max_speed", 0),
                "alerts": t.get("total_alerts", 0)
            }
            for t in trips[:50]  # Limit to 50 trips in detail
        ] if report_req.format == "json" else []
    }
    
    return report

# ==================== FAMILY MODE ENDPOINTS ====================

class CreateFamilyRequest(BaseModel):
    name: str
    
    @validator('name')
    def validate_name(cls, v):
        if len(v) < 2 or len(v) > 50:
            raise ValueError('Family name must be 2-50 characters')
        return sanitize_string(v, 50)

class InviteMemberRequest(BaseModel):
    email: str

class FamilyResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    members: List[dict]
    invite_code: str
    created_at: str

@api_router.post("/family/create")
@limiter.limit("5/minute")
async def create_family(request: Request, family_req: CreateFamilyRequest, user: dict = Depends(require_auth)):
    """Create a new family group."""
    user_id = str(user["_id"])
    
    # Check if user already owns a family
    existing = await families_collection.find_one({"owner_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="You already own a family group")
    
    invite_code = secrets.token_urlsafe(8)
    
    family = {
        "name": family_req.name,
        "owner_id": user_id,
        "members": [{"user_id": user_id, "email": user["email"], "role": "owner", "joined_at": datetime.now(timezone.utc).isoformat()}],
        "invite_code": invite_code,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await families_collection.insert_one(family)
    
    return {
        "family_id": str(result.inserted_id),
        "name": family_req.name,
        "invite_code": invite_code,
        "message": "Family created successfully"
    }

@api_router.post("/family/join/{invite_code}")
@limiter.limit("10/minute")
async def join_family(request: Request, invite_code: str, user: dict = Depends(require_auth)):
    """Join a family using invite code."""
    user_id = str(user["_id"])
    
    family = await families_collection.find_one({"invite_code": invite_code})
    if not family:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    # Check if already a member
    if any(m["user_id"] == user_id for m in family.get("members", [])):
        raise HTTPException(status_code=400, detail="You are already a member of this family")
    
    # Check member limit (max 10)
    if len(family.get("members", [])) >= 10:
        raise HTTPException(status_code=400, detail="Family has reached maximum members")
    
    # Add member
    new_member = {
        "user_id": user_id,
        "email": user["email"],
        "role": "member",
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await families_collection.update_one(
        {"_id": family["_id"]},
        {"$push": {"members": new_member}}
    )
    
    return {"message": f"Successfully joined {family['name']}"}

@api_router.get("/family")
@limiter.limit("30/minute")
async def get_my_family(request: Request, user: dict = Depends(require_auth)):
    """Get user's family group and member stats."""
    user_id = str(user["_id"])
    
    # Find family where user is a member
    family = await families_collection.find_one({"members.user_id": user_id})
    
    if not family:
        return {"family": None}
    
    # Get all member IDs for batch query (fixes N+1 problem)
    member_ids = [m["user_id"] for m in family.get("members", [])]
    
    # Batch fetch all trips for all members (single query)
    all_trips = await trips_collection.find(
        {"user_id": {"$in": member_ids}, "is_active": False},
        {"data_points": 0, "_id": 0}
    ).to_list(length=1000)
    
    # Group trips by user_id
    trips_by_user = {}
    for trip in all_trips:
        uid = trip["user_id"]
        if uid not in trips_by_user:
            trips_by_user[uid] = []
        trips_by_user[uid].append(trip)
    
    # Calculate stats for each member
    member_stats = []
    week_start = datetime.now(timezone.utc) - timedelta(days=datetime.now(timezone.utc).weekday())
    
    for member in family.get("members", []):
        member_trips = trips_by_user.get(member["user_id"], [])
        
        total_trips = len(member_trips)
        total_alerts = sum(t.get("total_alerts", 0) for t in member_trips)
        total_distance = sum(t.get("distance_miles", 0) or 0 for t in member_trips)
        safe_trips = sum(1 for t in member_trips if t.get("total_alerts", 0) == 0)
        
        # This week's trips
        week_trips = [t for t in member_trips if t.get("start_time", "") >= week_start.isoformat()]
        
        member_stats.append({
            "user_id": member["user_id"],
            "email": member["email"],
            "role": member["role"],
            "total_trips": total_trips,
            "total_distance": round(total_distance, 1),
            "total_alerts": total_alerts,
            "safe_trip_percentage": round((safe_trips / total_trips * 100) if total_trips > 0 else 0, 1),
            "trips_this_week": len(week_trips),
            "alerts_this_week": sum(t.get("total_alerts", 0) for t in week_trips)
        })
    
    return {
        "family": {
            "id": str(family["_id"]),
            "name": family["name"],
            "owner_id": family["owner_id"],
            "invite_code": family["invite_code"] if family["owner_id"] == user_id else None,
            "member_count": len(family.get("members", [])),
            "created_at": family["created_at"]
        },
        "members": member_stats,
        "is_owner": family["owner_id"] == user_id
    }

@api_router.delete("/family/leave")
async def leave_family(request: Request, user: dict = Depends(require_auth)):
    """Leave current family group."""
    user_id = str(user["_id"])
    
    family = await families_collection.find_one({"members.user_id": user_id})
    if not family:
        raise HTTPException(status_code=404, detail="You are not in a family")
    
    if family["owner_id"] == user_id:
        # Owner leaving - delete the family
        await families_collection.delete_one({"_id": family["_id"]})
        return {"message": "Family deleted"}
    else:
        # Member leaving
        await families_collection.update_one(
            {"_id": family["_id"]},
            {"$pull": {"members": {"user_id": user_id}}}
        )
        return {"message": "Left family successfully"}

# ==================== SPEED TRAP CROWDSOURCING ENDPOINTS ====================

class ReportTrapRequest(BaseModel):
    lat: float
    lon: float
    trap_type: str = "speed_camera"  # speed_camera, police, speed_bump, school_zone
    description: Optional[str] = None
    
    @validator('lat')
    def validate_lat(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('Invalid latitude')
        return v
    
    @validator('lon')
    def validate_lon(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('Invalid longitude')
        return v
    
    @validator('trap_type')
    def validate_type(cls, v):
        valid_types = ["speed_camera", "police", "speed_bump", "school_zone", "construction"]
        if v not in valid_types:
            raise ValueError(f'Type must be one of: {valid_types}')
        return v

class SpeedTrapResponse(BaseModel):
    id: str
    lat: float
    lon: float
    trap_type: str
    description: Optional[str]
    reporter_count: int
    last_confirmed: str
    distance_miles: Optional[float] = None

@api_router.post("/traps/report")
@limiter.limit("20/minute")
async def report_speed_trap(request: Request, trap: ReportTrapRequest, user: dict = Depends(require_auth)):
    """Report a speed trap location."""
    user_id = str(user["_id"])
    
    # Check for nearby existing trap (within ~500 meters)
    # Simple approximation: 0.005 degrees ≈ 500m
    nearby = await speed_traps_collection.find_one({
        "lat": {"$gte": trap.lat - 0.005, "$lte": trap.lat + 0.005},
        "lon": {"$gte": trap.lon - 0.005, "$lte": trap.lon + 0.005},
        "trap_type": trap.trap_type,
        "active": True
    })
    
    if nearby:
        # Confirm existing trap
        await speed_traps_collection.update_one(
            {"_id": nearby["_id"]},
            {
                "$inc": {"reporter_count": 1},
                "$set": {"last_confirmed": datetime.now(timezone.utc).isoformat()},
                "$addToSet": {"reporters": user_id}
            }
        )
        return {"message": "Speed trap confirmed", "trap_id": str(nearby["_id"]), "new": False}
    
    # Create new trap
    new_trap = {
        "lat": trap.lat,
        "lon": trap.lon,
        "trap_type": trap.trap_type,
        "description": sanitize_string(trap.description, 200) if trap.description else None,
        "reporter_count": 1,
        "reporters": [user_id],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_confirmed": datetime.now(timezone.utc).isoformat(),
        "active": True,
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()  # Traps expire after 24h without confirmation
    }
    
    result = await speed_traps_collection.insert_one(new_trap)
    
    return {"message": "Speed trap reported", "trap_id": str(result.inserted_id), "new": True}

@api_router.get("/traps/nearby")
@limiter.limit("60/minute")
async def get_nearby_traps(request: Request, lat: float, lon: float, radius_miles: float = 5):
    """Get speed traps near a location."""
    # Convert radius to degrees (rough approximation)
    # 1 degree ≈ 69 miles at equator
    radius_deg = radius_miles / 69
    
    # Find active traps within radius
    traps = await speed_traps_collection.find({
        "lat": {"$gte": lat - radius_deg, "$lte": lat + radius_deg},
        "lon": {"$gte": lon - radius_deg, "$lte": lon + radius_deg},
        "active": True,
        "last_confirmed": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
    }).to_list(length=50)
    
    # Calculate distance and sort
    from math import radians, sin, cos, sqrt, atan2
    
    def calc_distance(trap_lat, trap_lon):
        R = 3959  # Earth radius in miles
        lat1, lon1 = radians(lat), radians(lon)
        lat2, lon2 = radians(trap_lat), radians(trap_lon)
        dlat, dlon = lat2 - lat1, lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        return R * c
    
    result = []
    for trap in traps:
        dist = calc_distance(trap["lat"], trap["lon"])
        if dist <= radius_miles:
            result.append(SpeedTrapResponse(
                id=str(trap["_id"]),
                lat=trap["lat"],
                lon=trap["lon"],
                trap_type=trap["trap_type"],
                description=trap.get("description"),
                reporter_count=trap.get("reporter_count", 1),
                last_confirmed=trap["last_confirmed"],
                distance_miles=round(dist, 2)
            ))
    
    # Sort by distance
    result.sort(key=lambda x: x.distance_miles or 999)
    
    return {"traps": result, "count": len(result)}

@api_router.post("/traps/{trap_id}/dismiss")
@limiter.limit("30/minute")
async def dismiss_trap(request: Request, trap_id: str, user: dict = Depends(require_auth)):
    """Report that a trap is no longer present."""
    try:
        oid = ObjectId(trap_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trap ID")
    
    trap = await speed_traps_collection.find_one({"_id": oid})
    if not trap:
        raise HTTPException(status_code=404, detail="Trap not found")
    
    # Decrease reporter count or deactivate
    if trap.get("reporter_count", 1) <= 1:
        await speed_traps_collection.update_one(
            {"_id": oid},
            {"$set": {"active": False}}
        )
        return {"message": "Trap dismissed and deactivated"}
    else:
        await speed_traps_collection.update_one(
            {"_id": oid},
            {"$inc": {"reporter_count": -1}}
        )
        return {"message": "Trap dismissal recorded"}

# ==================== APP CONFIGURATION ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE", "PUT"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
