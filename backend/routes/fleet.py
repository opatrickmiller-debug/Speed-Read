# Fleet & Telematics API Routes
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import logging

from models.fleet import (
    TripCreate, TripEnd, TripSummary, TripDetail, TripListResponse, TripStatus,
    SpeedingIncidentCreate, SpeedingIncidentEnd, SpeedingIncident,
    DrivingEventCreate, DrivingEvent, EventType,
    DailySummary, ScoreResponse, LocationUpdate,
    calculate_speeding_severity, calculate_event_severity, calculate_safety_score
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/fleet", tags=["fleet"])

# Database reference - will be set from server.py
db = None

def set_db(database):
    global db
    db = database

# ============ TRIP ENDPOINTS ============

@router.post("/trips/start", response_model=dict)
async def start_trip(trip_data: TripCreate):
    """Start a new trip"""
    trip_id = str(uuid4())
    now = datetime.now(timezone.utc)
    
    trip = {
        "id": trip_id,
        "device_id": trip_data.device_id,
        "status": TripStatus.ACTIVE.value,
        "start_time": now,
        "end_time": None,
        "duration_minutes": 0,
        "start_location": trip_data.start_location.model_dump(),
        "end_location": None,
        "distance_miles": 0,
        "max_speed_mph": 0,
        "avg_speed_mph": 0,
        "speeding_incidents_count": 0,
        "speeding_duration_seconds": 0,
        "hard_brake_count": 0,
        "hard_accel_count": 0,
        "hard_corner_count": 0,
        "safety_score": 100,
        "road_type_breakdown": {},
        "path": [],
        "speed_samples": [],
        "created_at": now,
        "updated_at": now
    }
    
    await db.trips.insert_one(trip)
    logger.info(f"Started trip {trip_id} for device {trip_data.device_id}")
    
    return {"trip_id": trip_id, "status": "active", "start_time": now.isoformat()}

@router.post("/trips/{trip_id}/end", response_model=TripSummary)
async def end_trip(trip_id: str, end_data: TripEnd):
    """End an active trip and calculate final stats"""
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip["status"] != TripStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="Trip is not active")
    
    now = datetime.now(timezone.utc)
    start_time = trip["start_time"]
    
    # Handle both string and datetime objects
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
    elif start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    
    duration_minutes = (now - start_time).total_seconds() / 60
    
    # Calculate distance from path
    path = trip.get("path", [])
    distance_miles = calculate_distance_from_path(path)
    
    # Calculate average speed
    speed_samples = trip.get("speed_samples", [])
    avg_speed = sum(speed_samples) / len(speed_samples) if speed_samples else 0
    
    # Get incidents and events for this trip
    incidents = await db.speeding_incidents.find({"trip_id": trip_id}, {"_id": 0}).to_list(1000)
    events = await db.driving_events.find({"trip_id": trip_id}, {"_id": 0}).to_list(1000)
    
    # Calculate final safety score
    clean_trip = len(incidents) == 0 and len(events) == 0
    safety_score = calculate_safety_score(100, incidents, events, clean_trip)
    
    # Update trip
    update_data = {
        "status": TripStatus.COMPLETED.value,
        "end_time": now,
        "end_location": end_data.end_location.model_dump(),
        "duration_minutes": round(duration_minutes, 1),
        "distance_miles": round(distance_miles, 2),
        "avg_speed_mph": round(avg_speed, 1),
        "safety_score": safety_score,
        "updated_at": now
    }
    
    await db.trips.update_one({"id": trip_id}, {"$set": update_data})
    
    # Update daily summary
    await update_daily_summary(trip["device_id"], now.date().isoformat())
    
    # Return updated trip
    trip.update(update_data)
    logger.info(f"Ended trip {trip_id} - Score: {safety_score}, Distance: {distance_miles}mi")
    
    return TripSummary(**trip)

@router.post("/trips/{trip_id}/location", response_model=dict)
async def update_trip_location(trip_id: str, location: LocationUpdate):
    """Update trip with new location point"""
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    if trip["status"] != TripStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="Trip is not active")
    
    # Create location point
    point = {
        "lat": location.lat,
        "lon": location.lon,
        "speed": location.speed,
        "heading": location.heading,
        "timestamp": location.timestamp.isoformat()
    }
    
    # Update max speed
    max_speed = max(trip.get("max_speed_mph", 0), location.speed)
    
    # Add to path and speed samples
    await db.trips.update_one(
        {"id": trip_id},
        {
            "$push": {
                "path": point,
                "speed_samples": location.speed
            },
            "$set": {
                "max_speed_mph": max_speed,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"status": "updated", "max_speed": max_speed}

@router.get("/trips", response_model=TripListResponse)
async def list_trips(
    device_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """List trips for a device with optional filters"""
    query = {"device_id": device_id}
    
    if status:
        query["status"] = status
    
    if from_date:
        query["start_time"] = {"$gte": datetime.fromisoformat(from_date)}
    
    if to_date:
        if "start_time" in query:
            query["start_time"]["$lte"] = datetime.fromisoformat(to_date)
        else:
            query["start_time"] = {"$lte": datetime.fromisoformat(to_date)}
    
    # Get total count
    total = await db.trips.count_documents(query)
    
    # Get paginated trips
    skip = (page - 1) * limit
    trips = await db.trips.find(query, {"_id": 0, "path": 0, "speed_samples": 0}) \
        .sort("start_time", -1) \
        .skip(skip) \
        .limit(limit) \
        .to_list(limit)
    
    return TripListResponse(trips=trips, total=total, page=page, limit=limit)

@router.get("/trips/{trip_id}", response_model=TripDetail)
async def get_trip(trip_id: str):
    """Get detailed trip information including path"""
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    
    # Get incidents for this trip
    incidents = await db.speeding_incidents.find({"trip_id": trip_id}, {"_id": 0}).to_list(1000)
    trip["incidents"] = incidents
    
    # Get events for this trip
    events = await db.driving_events.find({"trip_id": trip_id}, {"_id": 0}).to_list(1000)
    trip["events"] = events
    
    return TripDetail(**trip)

@router.get("/trips/{trip_id}/incidents", response_model=List[SpeedingIncident])
async def get_trip_incidents(trip_id: str):
    """Get all speeding incidents for a trip"""
    incidents = await db.speeding_incidents.find({"trip_id": trip_id}, {"_id": 0}).to_list(1000)
    return incidents

# ============ INCIDENT ENDPOINTS ============

@router.post("/incidents/speeding/start", response_model=dict)
async def start_speeding_incident(incident_data: SpeedingIncidentCreate):
    """Start logging a speeding incident"""
    incident_id = str(uuid4())
    
    speed_over = incident_data.max_speed - incident_data.posted_limit
    severity, score_impact = calculate_speeding_severity(speed_over)
    
    incident = {
        "id": incident_id,
        "trip_id": incident_data.trip_id,
        "device_id": incident_data.device_id,
        "start_time": incident_data.start_time,
        "end_time": None,
        "duration_seconds": 0,
        "start_location": incident_data.start_location.model_dump(),
        "end_location": None,
        "road_name": incident_data.road_name,
        "road_type": incident_data.road_type,
        "posted_limit": incident_data.posted_limit,
        "threshold_used": incident_data.threshold_used,
        "max_speed": incident_data.max_speed,
        "avg_speed": incident_data.max_speed,
        "speed_over_limit": speed_over,
        "severity": severity.value,
        "score_impact": score_impact,
        "path": [],
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.speeding_incidents.insert_one(incident)
    
    # Update trip incident count
    await db.trips.update_one(
        {"id": incident_data.trip_id},
        {"$inc": {"speeding_incidents_count": 1}}
    )
    
    logger.info(f"Started speeding incident {incident_id} - {speed_over} mph over")
    
    return {
        "incident_id": incident_id,
        "severity": severity.value,
        "score_impact": score_impact
    }

@router.post("/incidents/speeding/{incident_id}/end", response_model=SpeedingIncident)
async def end_speeding_incident(incident_id: str, end_data: SpeedingIncidentEnd):
    """End a speeding incident"""
    incident = await db.speeding_incidents.find_one({"id": incident_id}, {"_id": 0})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Recalculate severity based on final max speed
    speed_over = incident["max_speed"] - incident["posted_limit"]
    severity, score_impact = calculate_speeding_severity(speed_over)
    
    update_data = {
        "end_time": end_data.end_time,
        "end_location": end_data.end_location.model_dump(),
        "duration_seconds": end_data.duration_seconds,
        "avg_speed": end_data.avg_speed,
        "severity": severity.value,
        "score_impact": score_impact
    }
    
    await db.speeding_incidents.update_one({"id": incident_id}, {"$set": update_data})
    
    # Update trip speeding duration
    await db.trips.update_one(
        {"id": incident["trip_id"]},
        {"$inc": {"speeding_duration_seconds": end_data.duration_seconds}}
    )
    
    incident.update(update_data)
    return SpeedingIncident(**incident)

@router.post("/incidents/speeding/{incident_id}/update", response_model=dict)
async def update_speeding_incident(incident_id: str, max_speed: float):
    """Update max speed during an ongoing incident"""
    result = await db.speeding_incidents.update_one(
        {"id": incident_id, "max_speed": {"$lt": max_speed}},
        {"$set": {"max_speed": max_speed}}
    )
    return {"updated": result.modified_count > 0}

# ============ DRIVING EVENTS ============

@router.post("/incidents/event", response_model=DrivingEvent)
async def log_driving_event(event_data: DrivingEventCreate):
    """Log a driving event (hard brake, accel, corner)"""
    event_id = str(uuid4())
    
    severity, score_impact = calculate_event_severity(event_data.intensity_g, event_data.event_type)
    
    event = {
        "id": event_id,
        "trip_id": event_data.trip_id,
        "device_id": event_data.device_id,
        "event_type": event_data.event_type.value,
        "timestamp": event_data.timestamp,
        "location": event_data.location.model_dump(),
        "intensity_g": event_data.intensity_g,
        "speed_before": event_data.speed_before,
        "speed_after": event_data.speed_after,
        "duration_ms": event_data.duration_ms,
        "road_name": event_data.road_name,
        "road_type": event_data.road_type,
        "severity": severity.value,
        "score_impact": score_impact,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.driving_events.insert_one(event)
    
    # Update trip event counts
    count_field = f"{event_data.event_type.value}_count"
    await db.trips.update_one(
        {"id": event_data.trip_id},
        {"$inc": {count_field: 1}}
    )
    
    logger.info(f"Logged {event_data.event_type.value} event - {event_data.intensity_g}g")
    
    return DrivingEvent(**event)

# ============ SCORES & REPORTS ============

@router.get("/scores", response_model=ScoreResponse)
async def get_scores(device_id: str):
    """Get current safety scores for a device"""
    now = datetime.now(timezone.utc)
    
    # Get daily score (today)
    today = now.date().isoformat()
    daily_summary = await db.daily_summaries.find_one(
        {"device_id": device_id, "date": today},
        {"_id": 0}
    )
    daily_score = daily_summary["daily_score"] if daily_summary else 100
    
    # Get weekly score (last 7 days)
    week_ago = (now - timedelta(days=7)).date().isoformat()
    weekly_summaries = await db.daily_summaries.find(
        {"device_id": device_id, "date": {"$gte": week_ago}},
        {"_id": 0}
    ).to_list(7)
    
    if weekly_summaries:
        weekly_score = round(sum(s["daily_score"] for s in weekly_summaries) / len(weekly_summaries))
    else:
        weekly_score = 100
    
    # Get monthly score (last 30 days)
    month_ago = (now - timedelta(days=30)).date().isoformat()
    monthly_summaries = await db.daily_summaries.find(
        {"device_id": device_id, "date": {"$gte": month_ago}},
        {"_id": 0}
    ).to_list(30)
    
    if monthly_summaries:
        monthly_score = round(sum(s["daily_score"] for s in monthly_summaries) / len(monthly_summaries))
    else:
        monthly_score = 100
    
    # Calculate trend
    if len(weekly_summaries) >= 3:
        recent_avg = sum(s["daily_score"] for s in weekly_summaries[:3]) / 3
        older_avg = sum(s["daily_score"] for s in weekly_summaries[-3:]) / min(3, len(weekly_summaries[-3:]))
        if recent_avg > older_avg + 2:
            trend = "improving"
        elif recent_avg < older_avg - 2:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "stable"
    
    # Get totals
    pipeline = [
        {"$match": {"device_id": device_id, "status": "completed"}},
        {"$group": {
            "_id": None,
            "total_trips": {"$sum": 1},
            "total_miles": {"$sum": "$distance_miles"}
        }}
    ]
    totals = await db.trips.aggregate(pipeline).to_list(1)
    total_trips = totals[0]["total_trips"] if totals else 0
    total_miles = totals[0]["total_miles"] if totals else 0
    
    # Get most recent trip score
    recent_trip = await db.trips.find_one(
        {"device_id": device_id, "status": "completed"},
        {"_id": 0, "safety_score": 1},
        sort=[("end_time", -1)]
    )
    trip_score = recent_trip["safety_score"] if recent_trip else None
    
    return ScoreResponse(
        device_id=device_id,
        trip_score=trip_score,
        daily_score=daily_score,
        weekly_score=weekly_score,
        monthly_score=monthly_score,
        lifetime_score=monthly_score,  # Use monthly as proxy for now
        trend=trend,
        total_trips=total_trips,
        total_miles=round(total_miles, 1)
    )

@router.get("/reports/daily", response_model=DailySummary)
async def get_daily_report(device_id: str, date: str):
    """Get daily driving summary"""
    summary = await db.daily_summaries.find_one(
        {"device_id": device_id, "date": date},
        {"_id": 0}
    )
    
    if not summary:
        # Generate summary if it doesn't exist
        summary = await generate_daily_summary(device_id, date)
    
    return DailySummary(**summary)

@router.get("/reports/weekly", response_model=List[DailySummary])
async def get_weekly_report(device_id: str, week_start: str):
    """Get weekly driving summary (7 days starting from week_start)"""
    start_date = datetime.fromisoformat(week_start)
    end_date = start_date + timedelta(days=7)
    
    summaries = await db.daily_summaries.find(
        {
            "device_id": device_id,
            "date": {
                "$gte": week_start,
                "$lt": end_date.date().isoformat()
            }
        },
        {"_id": 0}
    ).sort("date", 1).to_list(7)
    
    return summaries

@router.get("/incidents", response_model=List[SpeedingIncident])
async def list_incidents(
    device_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200)
):
    """List speeding incidents with filters"""
    query = {"device_id": device_id}
    
    if severity:
        query["severity"] = severity
    
    if from_date:
        query["start_time"] = {"$gte": datetime.fromisoformat(from_date)}
    
    if to_date:
        if "start_time" in query:
            query["start_time"]["$lte"] = datetime.fromisoformat(to_date)
        else:
            query["start_time"] = {"$lte": datetime.fromisoformat(to_date)}
    
    incidents = await db.speeding_incidents.find(query, {"_id": 0}) \
        .sort("start_time", -1) \
        .limit(limit) \
        .to_list(limit)
    
    return incidents

# ============ HELPER FUNCTIONS ============

def calculate_distance_from_path(path: List[dict]) -> float:
    """Calculate total distance in miles from path points"""
    if len(path) < 2:
        return 0
    
    total_distance = 0
    from math import radians, sin, cos, sqrt, atan2
    
    for i in range(1, len(path)):
        lat1, lon1 = radians(path[i-1]["lat"]), radians(path[i-1]["lon"])
        lat2, lon2 = radians(path[i]["lat"]), radians(path[i]["lon"])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        # Earth's radius in miles
        total_distance += 3959 * c
    
    return total_distance

async def update_daily_summary(device_id: str, date: str):
    """Update or create daily summary for a device"""
    summary = await generate_daily_summary(device_id, date)
    
    await db.daily_summaries.update_one(
        {"device_id": device_id, "date": date},
        {"$set": summary},
        upsert=True
    )

async def generate_daily_summary(device_id: str, date: str) -> dict:
    """Generate daily summary from trips"""
    date_start = datetime.fromisoformat(date)
    date_end = date_start + timedelta(days=1)
    
    # Get all trips for this day
    trips = await db.trips.find({
        "device_id": device_id,
        "status": "completed",
        "start_time": {"$gte": date_start, "$lt": date_end}
    }, {"_id": 0}).to_list(100)
    
    if not trips:
        return {
            "device_id": device_id,
            "date": date,
            "trips_count": 0,
            "total_distance_miles": 0,
            "total_duration_minutes": 0,
            "speeding_incidents_count": 0,
            "speeding_duration_seconds": 0,
            "hard_brake_count": 0,
            "hard_accel_count": 0,
            "max_speed_recorded": 0,
            "avg_speed": 0,
            "daily_score": 100,
            "score_change": 0
        }
    
    # Aggregate stats
    total_distance = sum(t.get("distance_miles", 0) for t in trips)
    total_duration = sum(t.get("duration_minutes", 0) for t in trips)
    speeding_incidents = sum(t.get("speeding_incidents_count", 0) for t in trips)
    speeding_duration = sum(t.get("speeding_duration_seconds", 0) for t in trips)
    hard_brakes = sum(t.get("hard_brake_count", 0) for t in trips)
    hard_accels = sum(t.get("hard_accel_count", 0) for t in trips)
    max_speed = max(t.get("max_speed_mph", 0) for t in trips)
    
    # Calculate average speed weighted by duration
    if total_duration > 0:
        avg_speed = sum(t.get("avg_speed_mph", 0) * t.get("duration_minutes", 0) for t in trips) / total_duration
    else:
        avg_speed = 0
    
    # Calculate daily score (average of trip scores)
    trip_scores = [t.get("safety_score", 100) for t in trips]
    daily_score = round(sum(trip_scores) / len(trip_scores)) if trip_scores else 100
    
    # Get yesterday's score for comparison
    yesterday = (date_start - timedelta(days=1)).date().isoformat()
    yesterday_summary = await db.daily_summaries.find_one(
        {"device_id": device_id, "date": yesterday},
        {"_id": 0, "daily_score": 1}
    )
    yesterday_score = yesterday_summary["daily_score"] if yesterday_summary else 100
    score_change = daily_score - yesterday_score
    
    return {
        "device_id": device_id,
        "date": date,
        "trips_count": len(trips),
        "total_distance_miles": round(total_distance, 2),
        "total_duration_minutes": round(total_duration, 1),
        "speeding_incidents_count": speeding_incidents,
        "speeding_duration_seconds": speeding_duration,
        "hard_brake_count": hard_brakes,
        "hard_accel_count": hard_accels,
        "max_speed_recorded": max_speed,
        "avg_speed": round(avg_speed, 1),
        "daily_score": daily_score,
        "score_change": score_change
    }
