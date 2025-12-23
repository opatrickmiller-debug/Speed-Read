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
