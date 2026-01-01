# Practice Hours & Share Access API Routes
from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import secrets
import logging

from models.practice import (
    PracticeSessionCreate, PracticeSession, PracticeHoursSummary,
    ShareAccessCreate, ShareAccess, ShareAccessResponse, SharedProgressData,
    UserSettings, SessionType
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/practice", tags=["practice"])

# Database reference - will be set from server.py
db = None

def set_db(database):
    global db
    db = database

# US State Practice Hour Requirements
STATE_REQUIREMENTS = {
    "AL": {"total": 50, "night": 10}, "AK": {"total": 40, "night": 10}, "AZ": {"total": 30, "night": 0},
    "AR": {"total": 60, "night": 10}, "CA": {"total": 50, "night": 10}, "CO": {"total": 50, "night": 10},
    "CT": {"total": 40, "night": 0}, "DE": {"total": 50, "night": 10}, "FL": {"total": 50, "night": 10},
    "GA": {"total": 40, "night": 6}, "HI": {"total": 50, "night": 10}, "ID": {"total": 50, "night": 10},
    "IL": {"total": 50, "night": 10}, "IN": {"total": 50, "night": 10}, "IA": {"total": 20, "night": 0},
    "KS": {"total": 50, "night": 10}, "KY": {"total": 60, "night": 10}, "LA": {"total": 50, "night": 15},
    "ME": {"total": 70, "night": 10}, "MD": {"total": 60, "night": 10}, "MA": {"total": 40, "night": 0},
    "MI": {"total": 50, "night": 10}, "MN": {"total": 50, "night": 15}, "MS": {"total": 30, "night": 0},
    "MO": {"total": 40, "night": 10}, "MT": {"total": 50, "night": 10}, "NE": {"total": 50, "night": 10},
    "NV": {"total": 50, "night": 10}, "NH": {"total": 40, "night": 10}, "NJ": {"total": 6, "night": 0},
    "NM": {"total": 50, "night": 10}, "NY": {"total": 50, "night": 15}, "NC": {"total": 60, "night": 10},
    "ND": {"total": 50, "night": 10}, "OH": {"total": 50, "night": 10}, "OK": {"total": 50, "night": 10},
    "OR": {"total": 100, "night": 10}, "PA": {"total": 65, "night": 10}, "RI": {"total": 50, "night": 10},
    "SC": {"total": 40, "night": 10}, "SD": {"total": 50, "night": 0}, "TN": {"total": 50, "night": 10},
    "TX": {"total": 30, "night": 10}, "UT": {"total": 40, "night": 10}, "VT": {"total": 40, "night": 10},
    "VA": {"total": 45, "night": 15}, "WA": {"total": 50, "night": 10}, "WV": {"total": 50, "night": 10},
    "WI": {"total": 30, "night": 10}, "WY": {"total": 50, "night": 10}, "DC": {"total": 40, "night": 10},
}


# ============ PRACTICE HOURS ENDPOINTS ============

@router.post("/sessions", response_model=dict)
async def add_practice_session(session: PracticeSessionCreate):
    """Add a manual practice session"""
    session_id = str(uuid4())
    now = datetime.now(timezone.utc)
    
    session_data = {
        "id": session_id,
        "device_id": session.device_id,
        "session_type": session.session_type.value,
        "duration_minutes": session.duration_minutes,
        "date": session.date,
        "notes": session.notes,
        "supervisor_name": session.supervisor_name,
        "source": "manual",
        "trip_id": None,
        "created_at": now
    }
    
    await db.practice_sessions.insert_one(session_data)
    logger.info(f"Added practice session {session_id} for device {session.device_id}")
    
    return {"session_id": session_id, "status": "created"}


@router.get("/sessions", response_model=List[dict])
async def get_practice_sessions(
    device_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200)
):
    """Get practice sessions for a device"""
    query = {"device_id": device_id}
    
    if from_date:
        query["date"] = {"$gte": from_date}
    if to_date:
        if "date" in query:
            query["date"]["$lte"] = to_date
        else:
            query["date"] = {"$lte": to_date}
    
    sessions = await db.practice_sessions.find(query, {"_id": 0}) \
        .sort("date", -1) \
        .limit(limit) \
        .to_list(limit)
    
    return sessions


@router.delete("/sessions/{session_id}")
async def delete_practice_session(session_id: str, device_id: str):
    """Delete a manual practice session"""
    result = await db.practice_sessions.delete_one({
        "id": session_id,
        "device_id": device_id,
        "source": "manual"  # Can only delete manual sessions
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found or cannot be deleted")
    
    return {"status": "deleted"}


@router.get("/summary", response_model=PracticeHoursSummary)
async def get_practice_summary(device_id: str):
    """Get practice hours summary including auto-tracked trips"""
    
    # Get user's selected state
    settings = await db.user_settings.find_one({"device_id": device_id}, {"_id": 0})
    selected_state = settings["selected_state"] if settings else "CA"
    requirements = STATE_REQUIREMENTS.get(selected_state, {"total": 50, "night": 10})
    
    # Get manual sessions
    manual_sessions = await db.practice_sessions.find(
        {"device_id": device_id},
        {"_id": 0}
    ).to_list(1000)
    
    manual_day_mins = sum(s["duration_minutes"] for s in manual_sessions if s["session_type"] == "day")
    manual_night_mins = sum(s["duration_minutes"] for s in manual_sessions if s["session_type"] == "night")
    manual_count = len(manual_sessions)
    
    # Get auto-tracked trips
    trips = await db.trips.find(
        {"device_id": device_id, "status": "completed"},
        {"_id": 0, "duration_minutes": 1, "start_time": 1}
    ).to_list(1000)
    
    auto_day_mins = 0
    auto_night_mins = 0
    
    for trip in trips:
        start_time = trip.get("start_time")
        duration = trip.get("duration_minutes", 0)
        
        # Determine if night driving (9pm - 6am)
        if start_time:
            if isinstance(start_time, str):
                start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            hour = start_time.hour
            is_night = hour >= 21 or hour < 6
            
            if is_night:
                auto_night_mins += duration
            else:
                auto_day_mins += duration
    
    auto_count = len(trips)
    
    # Calculate totals
    total_day_hours = (manual_day_mins + auto_day_mins) / 60
    total_night_hours = (manual_night_mins + auto_night_mins) / 60
    total_hours = total_day_hours + total_night_hours
    
    # Calculate progress
    total_progress = min(100, (total_hours / requirements["total"]) * 100) if requirements["total"] > 0 else 100
    night_progress = min(100, (total_night_hours / requirements["night"]) * 100) if requirements["night"] > 0 else 100
    
    requirements_met = total_hours >= requirements["total"] and total_night_hours >= requirements["night"]
    
    return PracticeHoursSummary(
        device_id=device_id,
        total_hours=round(total_hours, 1),
        day_hours=round(total_day_hours, 1),
        night_hours=round(total_night_hours, 1),
        total_sessions=manual_count + auto_count,
        selected_state=selected_state,
        state_requirement_total=requirements["total"],
        state_requirement_night=requirements["night"],
        total_progress_percent=round(total_progress, 1),
        night_progress_percent=round(night_progress, 1),
        requirements_met=requirements_met
    )


@router.post("/settings")
async def save_user_settings(device_id: str, state: str):
    """Save user settings (selected state)"""
    if state not in STATE_REQUIREMENTS:
        raise HTTPException(status_code=400, detail="Invalid state code")
    
    now = datetime.now(timezone.utc)
    
    await db.user_settings.update_one(
        {"device_id": device_id},
        {"$set": {"device_id": device_id, "selected_state": state, "updated_at": now}},
        upsert=True
    )
    
    return {"status": "saved", "state": state}


@router.get("/settings")
async def get_user_settings(device_id: str):
    """Get user settings"""
    settings = await db.user_settings.find_one({"device_id": device_id}, {"_id": 0})
    
    if not settings:
        return {"device_id": device_id, "selected_state": "CA"}
    
    return settings


# ============ SHARE ACCESS ENDPOINTS ============

def generate_share_code() -> str:
    """Generate an 8-character share code"""
    return secrets.token_urlsafe(6)[:8].upper()


@router.post("/share", response_model=ShareAccessResponse)
async def create_share_access(request: Request, share_data: ShareAccessCreate):
    """Create a share access link for parent/instructor"""
    share_id = str(uuid4())
    share_code = generate_share_code()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=share_data.expires_days)
    
    # Get base URL from request
    base_url = str(request.base_url).rstrip('/')
    # Use frontend URL pattern
    share_url = f"{base_url.replace('/api', '')}/progress/{share_code}"
    
    share_record = {
        "id": share_id,
        "device_id": share_data.device_id,
        "share_code": share_code,
        "recipient_name": share_data.recipient_name,
        "recipient_email": share_data.recipient_email,
        "created_at": now,
        "expires_at": expires_at,
        "last_accessed": None,
        "access_count": 0,
        "is_active": True
    }
    
    await db.share_access.insert_one(share_record)
    logger.info(f"Created share access {share_code} for device {share_data.device_id}")
    
    return ShareAccessResponse(
        share_code=share_code,
        share_url=share_url,
        expires_at=expires_at
    )


@router.get("/share/list")
async def list_share_access(device_id: str):
    """List all share access links for a device"""
    shares = await db.share_access.find(
        {"device_id": device_id, "is_active": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Filter out expired shares
    now = datetime.now(timezone.utc)
    active_shares = []
    for share in shares:
        expires_at = share.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        if expires_at and expires_at > now:
            active_shares.append(share)
    
    return active_shares


@router.delete("/share/{share_code}")
async def revoke_share_access(share_code: str, device_id: str):
    """Revoke a share access link"""
    result = await db.share_access.update_one(
        {"share_code": share_code, "device_id": device_id},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    return {"status": "revoked"}


@router.get("/shared/{share_code}", response_model=SharedProgressData)
async def get_shared_progress(share_code: str):
    """Get shared progress data (public endpoint for parents/instructors)"""
    
    # Find the share access record
    share = await db.share_access.find_one(
        {"share_code": share_code, "is_active": True},
        {"_id": 0}
    )
    
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found or expired")
    
    # Check expiration
    expires_at = share.get("expires_at")
    now = datetime.now(timezone.utc)
    
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        elif expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < now:
            raise HTTPException(status_code=410, detail="Share link has expired")
    
    device_id = share["device_id"]
    
    # Update access stats
    await db.share_access.update_one(
        {"share_code": share_code},
        {"$set": {"last_accessed": now}, "$inc": {"access_count": 1}}
    )
    
    # Get practice hours summary
    practice_summary = await get_practice_summary(device_id)
    
    # Get safety scores from fleet module
    from routes.fleet import get_scores
    try:
        scores = await get_scores(device_id)
        safety_score = scores.weekly_score
        trend = scores.trend
        total_trips = scores.total_trips
        total_miles = scores.total_miles
    except Exception:
        safety_score = 100
        trend = "stable"
        total_trips = 0
        total_miles = 0
    
    # Get recent trips (limited info for privacy)
    trips = await db.trips.find(
        {"device_id": device_id, "status": "completed"},
        {"_id": 0, "path": 0, "speed_samples": 0}  # Exclude detailed path data
    ).sort("start_time", -1).limit(10).to_list(10)
    
    # Sanitize trip data for sharing
    recent_trips = []
    for trip in trips:
        recent_trips.append({
            "date": trip.get("start_time"),
            "duration_minutes": trip.get("duration_minutes", 0),
            "distance_miles": trip.get("distance_miles", 0),
            "safety_score": trip.get("safety_score", 100),
            "speeding_incidents": trip.get("speeding_incidents_count", 0)
        })
    
    return SharedProgressData(
        student_name=None,  # Don't expose name for privacy
        practice_hours=practice_summary,
        safety_score=safety_score,
        total_trips=total_trips,
        total_miles=total_miles,
        recent_trips=recent_trips,
        trend=trend,
        generated_at=now
    )


@router.get("/requirements")
async def get_state_requirements():
    """Get all state practice hour requirements"""
    return STATE_REQUIREMENTS
