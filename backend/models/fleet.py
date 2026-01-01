# Fleet & Telematics Models
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum

class TripStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class IncidentSeverity(str, Enum):
    MINOR = "minor"           # 1-5 mph over
    MODERATE = "moderate"     # 6-15 mph over
    SEVERE = "severe"         # 16-25 mph over
    EXTREME = "extreme"       # 25+ mph over

class EventType(str, Enum):
    HARD_BRAKE = "hard_brake"
    HARD_ACCEL = "hard_accel"
    HARD_CORNER = "hard_corner"

class Location(BaseModel):
    lat: float
    lon: float
    address: Optional[str] = None

class LocationPoint(BaseModel):
    lat: float
    lon: float
    speed: float
    heading: Optional[float] = None
    timestamp: datetime

# Trip Models
class TripCreate(BaseModel):
    device_id: str
    start_location: Location

class TripEnd(BaseModel):
    end_location: Location

class TripSummary(BaseModel):
    id: str
    device_id: str
    status: TripStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[float] = None
    start_location: Location
    end_location: Optional[Location] = None
    distance_miles: float = 0
    max_speed_mph: float = 0
    avg_speed_mph: float = 0
    speeding_incidents_count: int = 0
    speeding_duration_seconds: int = 0
    hard_brake_count: int = 0
    hard_accel_count: int = 0
    safety_score: int = 100

class TripDetail(TripSummary):
    road_type_breakdown: Dict[str, float] = {}
    path: List[LocationPoint] = []

class TripListResponse(BaseModel):
    trips: List[TripSummary]
    total: int
    page: int
    limit: int

# Speeding Incident Models
class SpeedingIncidentCreate(BaseModel):
    trip_id: str
    device_id: str
    start_time: datetime
    start_location: Location
    posted_limit: int
    threshold_used: int
    max_speed: float
    road_name: Optional[str] = None
    road_type: Optional[str] = None

class SpeedingIncidentEnd(BaseModel):
    end_time: datetime
    end_location: Location
    avg_speed: float
    duration_seconds: int

class SpeedingIncident(BaseModel):
    id: str
    trip_id: str
    device_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int = 0
    start_location: Location
    end_location: Optional[Location] = None
    road_name: Optional[str] = None
    road_type: Optional[str] = None
    posted_limit: int
    threshold_used: int
    max_speed: float
    avg_speed: float = 0
    speed_over_limit: float = 0
    severity: IncidentSeverity
    score_impact: int

# Driving Event Models
class DrivingEventCreate(BaseModel):
    trip_id: str
    device_id: str
    event_type: EventType
    timestamp: datetime
    location: Location
    intensity_g: float
    speed_before: float
    speed_after: float
    duration_ms: int
    road_name: Optional[str] = None
    road_type: Optional[str] = None

class DrivingEvent(BaseModel):
    id: str
    trip_id: str
    device_id: str
    event_type: EventType
    timestamp: datetime
    location: Location
    intensity_g: float
    speed_before: float
    speed_after: float
    duration_ms: int
    road_name: Optional[str] = None
    road_type: Optional[str] = None
    severity: IncidentSeverity
    score_impact: int

# Daily Summary Models
class DailySummary(BaseModel):
    device_id: str
    date: str  # YYYY-MM-DD
    trips_count: int = 0
    total_distance_miles: float = 0
    total_duration_minutes: float = 0
    speeding_incidents_count: int = 0
    speeding_duration_seconds: int = 0
    hard_brake_count: int = 0
    hard_accel_count: int = 0
    max_speed_recorded: float = 0
    avg_speed: float = 0
    daily_score: int = 100
    score_change: int = 0

# Score Models
class ScoreResponse(BaseModel):
    device_id: str
    trip_score: Optional[int] = None
    daily_score: int = 100
    weekly_score: int = 100
    monthly_score: int = 100
    lifetime_score: int = 100
    trend: str = "stable"  # improving, stable, declining
    total_trips: int = 0
    total_miles: float = 0

# Location Update (for real-time tracking)
class LocationUpdate(BaseModel):
    trip_id: str
    device_id: str
    lat: float
    lon: float
    speed: float
    heading: Optional[float] = None
    timestamp: datetime

# Helper functions for severity calculation
def calculate_speeding_severity(speed_over_limit: float) -> tuple[IncidentSeverity, int]:
    """Calculate severity and score impact based on how much over the limit"""
    if speed_over_limit <= 5:
        return IncidentSeverity.MINOR, -2
    elif speed_over_limit <= 15:
        return IncidentSeverity.MODERATE, -5
    elif speed_over_limit <= 25:
        return IncidentSeverity.SEVERE, -10
    else:
        return IncidentSeverity.EXTREME, -20

def calculate_event_severity(intensity_g: float, event_type: EventType) -> tuple[IncidentSeverity, int]:
    """Calculate severity and score impact for driving events"""
    if event_type == EventType.HARD_BRAKE:
        if intensity_g < 0.4:
            return IncidentSeverity.MINOR, -2
        elif intensity_g < 0.5:
            return IncidentSeverity.MODERATE, -3
        else:
            return IncidentSeverity.SEVERE, -5
    elif event_type == EventType.HARD_ACCEL:
        if intensity_g < 0.45:
            return IncidentSeverity.MINOR, -1
        elif intensity_g < 0.55:
            return IncidentSeverity.MODERATE, -2
        else:
            return IncidentSeverity.SEVERE, -3
    else:  # HARD_CORNER
        if intensity_g < 0.35:
            return IncidentSeverity.MINOR, -1
        elif intensity_g < 0.45:
            return IncidentSeverity.MODERATE, -2
        else:
            return IncidentSeverity.SEVERE, -3

def calculate_safety_score(
    base_score: int,
    speeding_incidents: List[dict],
    driving_events: List[dict],
    clean_trip_bonus: bool = False
) -> int:
    """Calculate safety score based on incidents and events"""
    score = base_score
    
    # Deduct for speeding incidents
    for incident in speeding_incidents:
        score += incident.get('score_impact', 0)
    
    # Deduct for driving events
    for event in driving_events:
        score += event.get('score_impact', 0)
    
    # Bonus for clean trip
    if clean_trip_bonus and len(speeding_incidents) == 0 and len(driving_events) == 0:
        score = min(100, score + 2)
    
    return max(0, min(100, score))
