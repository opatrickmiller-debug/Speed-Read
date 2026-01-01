# Practice Hours & Share Access Models
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class SessionType(str, Enum):
    DAY = "day"
    NIGHT = "night"


class PracticeSessionCreate(BaseModel):
    """Create a practice session (manual entry)"""
    device_id: str
    session_type: SessionType
    duration_minutes: float = Field(gt=0, le=480)  # Max 8 hours per session
    date: str  # YYYY-MM-DD format
    notes: Optional[str] = None
    supervisor_name: Optional[str] = None


class PracticeSession(BaseModel):
    """Stored practice session"""
    id: str
    device_id: str
    session_type: SessionType
    duration_minutes: float
    date: str
    notes: Optional[str] = None
    supervisor_name: Optional[str] = None
    source: str = "manual"  # manual or auto (from trips)
    trip_id: Optional[str] = None  # If auto-generated from a trip
    created_at: datetime


class PracticeHoursSummary(BaseModel):
    """Summary of practice hours"""
    device_id: str
    total_hours: float
    day_hours: float
    night_hours: float
    total_sessions: int
    selected_state: str
    state_requirement_total: int
    state_requirement_night: int
    total_progress_percent: float
    night_progress_percent: float
    requirements_met: bool


class UserSettings(BaseModel):
    """User settings including state selection"""
    device_id: str
    selected_state: str = "CA"
    updated_at: datetime


# ============ SHARE ACCESS MODELS ============

class ShareAccessCreate(BaseModel):
    """Create a share access link"""
    device_id: str
    recipient_name: str
    recipient_email: Optional[str] = None
    expires_days: int = Field(default=30, ge=1, le=365)


class ShareAccess(BaseModel):
    """Share access record"""
    id: str
    device_id: str
    share_code: str  # 8-character code
    recipient_name: str
    recipient_email: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    last_accessed: Optional[datetime] = None
    access_count: int = 0
    is_active: bool = True


class ShareAccessResponse(BaseModel):
    """Response when creating share access"""
    share_code: str
    share_url: str
    expires_at: datetime


class SharedProgressData(BaseModel):
    """Data returned when viewing shared progress"""
    student_name: Optional[str] = None
    practice_hours: PracticeHoursSummary
    safety_score: int
    total_trips: int
    total_miles: float
    recent_trips: List[dict]
    trend: str
    generated_at: datetime
