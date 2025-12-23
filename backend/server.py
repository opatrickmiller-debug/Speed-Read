from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
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

# Rate limiting - using a simpler approach for APIRouter compatibility
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# Security scheme
security = HTTPBearer(auto_error=False)

# Allowed origins for CORS (restrict in production)
ALLOWED_ORIGINS = os.environ.get('CORS_ORIGINS', 'https://pace-guardian.preview.emergentagent.com,http://localhost:3000').split(',')

# ==================== DATABASE ====================

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Collections
trips_collection = db.trips
users_collection = db.users

# Create the main app
app = FastAPI(
    title="Speed Alert API",
    docs_url="/api/docs" if os.environ.get('DEBUG') else None,  # Disable docs in production
    redoc_url=None
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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

# ==================== APP CONFIGURATION ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
