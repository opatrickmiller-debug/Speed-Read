# Instructor & Driving School Models
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class InstructorRole(str, Enum):
    INSTRUCTOR = "instructor"
    SCHOOL_ADMIN = "school_admin"


class InstructorCreate(BaseModel):
    """Create instructor account"""
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    school_name: Optional[str] = None
    license_number: Optional[str] = None


class Instructor(BaseModel):
    """Instructor profile"""
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    school_name: Optional[str] = None
    license_number: Optional[str] = None
    role: InstructorRole = InstructorRole.INSTRUCTOR
    is_verified: bool = False
    student_count: int = 0
    created_at: datetime
    last_login: Optional[datetime] = None


class InstructorLogin(BaseModel):
    """Instructor login"""
    email: EmailStr
    password: str


class StudentLink(BaseModel):
    """Link a student to an instructor"""
    instructor_id: str
    student_device_id: str
    student_name: str
    student_email: Optional[str] = None
    permit_date: Optional[str] = None  # When they got their permit
    target_test_date: Optional[str] = None  # Target license test date
    notes: Optional[str] = None


class StudentRecord(BaseModel):
    """Student record in instructor's roster"""
    id: str
    instructor_id: str
    device_id: str
    name: str
    email: Optional[str] = None
    permit_date: Optional[str] = None
    target_test_date: Optional[str] = None
    notes: Optional[str] = None
    # Aggregated stats
    total_hours: float = 0
    total_sessions: int = 0
    safety_score: int = 100
    last_session_date: Optional[datetime] = None
    state_requirement_met: bool = False
    created_at: datetime
    updated_at: datetime


class StudentProgress(BaseModel):
    """Detailed student progress for instructor view"""
    student: StudentRecord
    practice_hours: dict  # PracticeHoursSummary as dict
    recent_trips: List[dict]
    recent_incidents: List[dict]
    weekly_score_trend: List[int]


class InstructorDashboard(BaseModel):
    """Instructor dashboard summary"""
    instructor: Instructor
    total_students: int
    active_students: int  # Drove in last 7 days
    students_meeting_requirements: int
    average_student_score: float
    total_hours_supervised: float
    students: List[StudentRecord]
