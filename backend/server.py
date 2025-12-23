from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import httpx
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Collections
trips_collection = db.trips

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Models
class SpeedLimitRequest(BaseModel):
    lat: float
    lon: float

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

class StartTripRequest(BaseModel):
    start_lat: float
    start_lon: float
    speed_unit: str = "mph"

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

@api_router.get("/")
async def root():
    return {"message": "Speed Alert API"}

@api_router.get("/speed-limit")
async def get_speed_limit(lat: float, lon: float):
    """
    Fetch speed limit for a given location using OpenStreetMap Overpass API.
    Returns speed limit in the road's native unit (mph for US/UK, km/h elsewhere).
    """
    # Overpass QL query to find nearby roads with speed limits
    # Search within 30 meters of the given coordinates
    query = f"""
    [out:json][timeout:10];
    way(around:30,{lat},{lon})["highway"]["maxspeed"];
    out body;
    """
    
    # Retry logic for API calls
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
                    # Get the first road with speed limit
                    road = data["elements"][0]
                    tags = road.get("tags", {})
                    maxspeed = tags.get("maxspeed", "")
                    road_name = tags.get("name") or tags.get("ref") or "Unknown Road"
                    
                    # Parse speed limit - handle various formats
                    speed_limit = None
                    unit = "mph"  # Default to mph
                    
                    if maxspeed:
                        # Handle "30 mph", "50", "60 km/h" formats
                        maxspeed_clean = maxspeed.lower().strip()
                        
                        if "mph" in maxspeed_clean:
                            speed_limit = int(''.join(filter(str.isdigit, maxspeed_clean)))
                            unit = "mph"
                        elif "km/h" in maxspeed_clean or "kmh" in maxspeed_clean:
                            speed_limit = int(''.join(filter(str.isdigit, maxspeed_clean)))
                            unit = "km/h"
                        elif maxspeed_clean.isdigit():
                            speed_limit = int(maxspeed_clean)
                            # Assume km/h for plain numbers (EU standard)
                            unit = "km/h"
                        else:
                            # Try to extract number
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
                
                # No speed limit data found
                return SpeedLimitResponse(
                    speed_limit=None,
                    unit="mph",
                    road_name=None,
                    source="openstreetmap"
                )
                
        except httpx.TimeoutException as e:
            last_error = e
            logger.warning(f"Timeout fetching speed limit (attempt {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                continue
        except httpx.HTTPStatusError as e:
            last_error = e
            logger.warning(f"HTTP error {e.response.status_code} (attempt {attempt + 1}/{max_retries})")
            if attempt < max_retries - 1:
                continue
        except Exception as e:
            last_error = e
            logger.error(f"Error fetching speed limit: {e}")
            break
    
    # All retries failed - return fallback for demo purposes
    # Common US speed limits by area type (rough heuristic based on coordinates)
    logger.warning(f"All retries failed for {lat}, {lon}: {last_error}")
    return SpeedLimitResponse(
        speed_limit=None,
        unit="mph",
        road_name=None,
        source="error"
    )

# ==================== TRIP HISTORY ENDPOINTS ====================

@api_router.post("/trips/start")
async def start_trip(request: StartTripRequest):
    """Start a new trip recording session."""
    trip = {
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": None,
        "start_lat": request.start_lat,
        "start_lon": request.start_lon,
        "end_lat": None,
        "end_lon": None,
        "speed_unit": request.speed_unit,
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
async def add_data_point(request: AddDataPointRequest):
    """Add a data point to an active trip."""
    try:
        trip_id = ObjectId(request.trip_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trip ID")
    
    trip = await trips_collection.find_one({"_id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if not trip.get("is_active"):
        raise HTTPException(status_code=400, detail="Trip is not active")
    
    data_point = request.data_point.model_dump()
    
    # Update trip statistics
    update = {
        "$push": {"data_points": data_point},
        "$inc": {
            "speed_count": 1,
            "total_speed": data_point["speed"],
            "total_alerts": 1 if data_point["is_speeding"] else 0
        }
    }
    
    # Update max speed if needed
    if data_point["speed"] > trip.get("max_speed", 0):
        update["$set"] = {"max_speed": data_point["speed"]}
    
    await trips_collection.update_one({"_id": trip_id}, update)
    
    return {"message": "Data point added"}

@api_router.post("/trips/end")
async def end_trip(request: EndTripRequest):
    """End an active trip."""
    try:
        trip_id = ObjectId(request.trip_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trip ID")
    
    trip = await trips_collection.find_one({"_id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    end_time = datetime.now(timezone.utc)
    start_time = datetime.fromisoformat(trip["start_time"].replace('Z', '+00:00'))
    duration_minutes = (end_time - start_time).total_seconds() / 60
    
    # Calculate average speed
    avg_speed = 0
    if trip.get("speed_count", 0) > 0:
        avg_speed = trip.get("total_speed", 0) / trip["speed_count"]
    
    # Calculate distance (rough estimate from data points)
    distance_miles = 0
    data_points = trip.get("data_points", [])
    if len(data_points) > 1:
        for i in range(1, len(data_points)):
            p1 = data_points[i-1]
            p2 = data_points[i]
            # Haversine distance
            from math import radians, sin, cos, sqrt, atan2
            R = 3959  # Earth radius in miles
            lat1, lon1 = radians(p1["lat"]), radians(p1["lon"])
            lat2, lon2 = radians(p2["lat"]), radians(p2["lon"])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            distance_miles += R * c
    
    update = {
        "$set": {
            "end_time": end_time.isoformat(),
            "end_lat": request.end_lat,
            "end_lon": request.end_lon,
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
async def get_trips(limit: int = 20, skip: int = 0):
    """Get trip history list."""
    cursor = trips_collection.find(
        {},
        {"data_points": 0}  # Exclude data points for list view
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
    
    total = await trips_collection.count_documents({})
    
    return {
        "trips": trips,
        "total": total,
        "limit": limit,
        "skip": skip
    }

@api_router.get("/trips/{trip_id}")
async def get_trip_detail(trip_id: str):
    """Get detailed trip information including data points."""
    try:
        oid = ObjectId(trip_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trip ID")
    
    trip = await trips_collection.find_one({"_id": oid})
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
async def delete_trip(trip_id: str):
    """Delete a trip."""
    try:
        oid = ObjectId(trip_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid trip ID")
    
    result = await trips_collection.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    return {"message": "Trip deleted"}

# Include the router in the main app
app.include_router(api_router)

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
