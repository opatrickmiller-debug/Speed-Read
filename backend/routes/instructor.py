# Instructor Dashboard API Routes
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import logging
from passlib.context import CryptContext
from jose import jwt
import os

from models.instructor import (
    InstructorCreate, Instructor, InstructorLogin, InstructorRole,
    StudentLink, StudentRecord, StudentProgress, InstructorDashboard
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/instructor", tags=["instructor"])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'instructor-secret-key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 1 week

# Database reference
db = None

def set_db(database):
    global db
    db = database


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_instructor_token(instructor_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": instructor_id,
        "email": email,
        "type": "instructor",
        "exp": expire
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ============ AUTHENTICATION ============

@router.post("/register", response_model=dict)
async def register_instructor(data: InstructorCreate):
    """Register a new instructor account"""
    
    # Check if email already exists
    existing = await db.instructors.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    now = datetime.now(timezone.utc)
    instructor_id = str(uuid4())
    
    instructor = {
        "id": instructor_id,
        "email": data.email.lower(),
        "password_hash": hash_password(data.password),
        "name": data.name,
        "phone": data.phone,
        "school_name": data.school_name,
        "license_number": data.license_number,
        "role": InstructorRole.INSTRUCTOR.value,
        "is_verified": False,
        "student_count": 0,
        "created_at": now,
        "last_login": now
    }
    
    await db.instructors.insert_one(instructor)
    
    token = create_instructor_token(instructor_id, data.email.lower())
    
    logger.info(f"Registered instructor: {data.email}")
    
    return {
        "token": token,
        "instructor": {
            "id": instructor_id,
            "email": data.email.lower(),
            "name": data.name,
            "school_name": data.school_name
        }
    }


@router.post("/login", response_model=dict)
async def login_instructor(data: InstructorLogin):
    """Login as instructor"""
    
    instructor = await db.instructors.find_one(
        {"email": data.email.lower()},
        {"_id": 0}
    )
    
    if not instructor:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(data.password, instructor["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Update last login
    await db.instructors.update_one(
        {"id": instructor["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    token = create_instructor_token(instructor["id"], instructor["email"])
    
    return {
        "token": token,
        "instructor": {
            "id": instructor["id"],
            "email": instructor["email"],
            "name": instructor["name"],
            "school_name": instructor.get("school_name")
        }
    }


@router.get("/profile", response_model=dict)
async def get_instructor_profile(instructor_id: str):
    """Get instructor profile"""
    instructor = await db.instructors.find_one(
        {"id": instructor_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    
    return instructor


# ============ STUDENT MANAGEMENT ============

@router.post("/students", response_model=dict)
async def add_student(data: StudentLink):
    """Add a student to instructor's roster"""
    
    # Verify instructor exists
    instructor = await db.instructors.find_one({"id": data.instructor_id})
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    
    # Check if student already linked to this instructor
    existing = await db.instructor_students.find_one({
        "instructor_id": data.instructor_id,
        "device_id": data.student_device_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Student already in your roster")
    
    now = datetime.now(timezone.utc)
    student_id = str(uuid4())
    
    student_record = {
        "id": student_id,
        "instructor_id": data.instructor_id,
        "device_id": data.student_device_id,
        "name": data.student_name,
        "email": data.student_email,
        "permit_date": data.permit_date,
        "target_test_date": data.target_test_date,
        "notes": data.notes,
        "total_hours": 0,
        "total_sessions": 0,
        "safety_score": 100,
        "last_session_date": None,
        "state_requirement_met": False,
        "created_at": now,
        "updated_at": now
    }
    
    await db.instructor_students.insert_one(student_record)
    
    # Update instructor student count
    await db.instructors.update_one(
        {"id": data.instructor_id},
        {"$inc": {"student_count": 1}}
    )
    
    logger.info(f"Instructor {data.instructor_id} added student {data.student_name}")
    
    return {"student_id": student_id, "status": "added"}


@router.get("/students", response_model=List[dict])
async def list_students(instructor_id: str):
    """List all students for an instructor"""
    
    students = await db.instructor_students.find(
        {"instructor_id": instructor_id},
        {"_id": 0}
    ).sort("name", 1).to_list(500)
    
    # Enrich with latest stats
    for student in students:
        await update_student_stats(student)
    
    return students


async def update_student_stats(student: dict):
    """Update student stats from their driving data"""
    device_id = student["device_id"]
    
    # Get practice summary
    from routes.practice import get_practice_summary
    try:
        summary = await get_practice_summary(device_id)
        student["total_hours"] = summary.total_hours
        student["total_sessions"] = summary.total_sessions
        student["state_requirement_met"] = summary.requirements_met
    except Exception:
        pass
    
    # Get safety score
    try:
        scores = await db.daily_summaries.find(
            {"device_id": device_id},
            {"_id": 0, "daily_score": 1}
        ).sort("date", -1).limit(7).to_list(7)
        
        if scores:
            student["safety_score"] = round(sum(s["daily_score"] for s in scores) / len(scores))
    except Exception:
        pass
    
    # Get last session
    try:
        last_trip = await db.trips.find_one(
            {"device_id": device_id, "status": "completed"},
            {"_id": 0, "end_time": 1},
            sort=[("end_time", -1)]
        )
        if last_trip:
            student["last_session_date"] = last_trip.get("end_time")
    except Exception:
        pass


@router.get("/students/{student_id}", response_model=dict)
async def get_student_detail(instructor_id: str, student_id: str):
    """Get detailed student progress"""
    
    student = await db.instructor_students.find_one(
        {"id": student_id, "instructor_id": instructor_id},
        {"_id": 0}
    )
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    device_id = student["device_id"]
    
    # Get practice summary
    from routes.practice import get_practice_summary
    try:
        practice = await get_practice_summary(device_id)
        practice_data = practice.model_dump()
    except Exception:
        practice_data = {}
    
    # Get recent trips
    trips = await db.trips.find(
        {"device_id": device_id, "status": "completed"},
        {"_id": 0, "path": 0, "speed_samples": 0}
    ).sort("start_time", -1).limit(20).to_list(20)
    
    # Get recent incidents
    incidents = await db.speeding_incidents.find(
        {"device_id": device_id},
        {"_id": 0}
    ).sort("start_time", -1).limit(10).to_list(10)
    
    # Get weekly score trend
    summaries = await db.daily_summaries.find(
        {"device_id": device_id},
        {"_id": 0, "daily_score": 1, "date": 1}
    ).sort("date", -1).limit(7).to_list(7)
    
    weekly_scores = [s["daily_score"] for s in reversed(summaries)]
    
    await update_student_stats(student)
    
    return {
        "student": student,
        "practice_hours": practice_data,
        "recent_trips": trips,
        "recent_incidents": incidents,
        "weekly_score_trend": weekly_scores
    }


@router.delete("/students/{student_id}")
async def remove_student(instructor_id: str, student_id: str):
    """Remove a student from instructor's roster"""
    
    result = await db.instructor_students.delete_one({
        "id": student_id,
        "instructor_id": instructor_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Update instructor student count
    await db.instructors.update_one(
        {"id": instructor_id},
        {"$inc": {"student_count": -1}}
    )
    
    return {"status": "removed"}


@router.put("/students/{student_id}")
async def update_student(instructor_id: str, student_id: str, data: dict):
    """Update student notes or details"""
    
    allowed_fields = ["name", "email", "permit_date", "target_test_date", "notes"]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.instructor_students.update_one(
        {"id": student_id, "instructor_id": instructor_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Student not found")
    
    return {"status": "updated"}


# ============ DASHBOARD ============

@router.get("/dashboard", response_model=dict)
async def get_dashboard(instructor_id: str):
    """Get instructor dashboard summary"""
    
    instructor = await db.instructors.find_one(
        {"id": instructor_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    
    # Get all students
    students = await db.instructor_students.find(
        {"instructor_id": instructor_id},
        {"_id": 0}
    ).to_list(500)
    
    # Update stats for each student
    for student in students:
        await update_student_stats(student)
    
    # Calculate dashboard metrics
    total_students = len(students)
    
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    
    active_students = 0
    meeting_requirements = 0
    total_hours = 0
    total_score = 0
    
    for s in students:
        total_hours += s.get("total_hours", 0)
        total_score += s.get("safety_score", 100)
        
        if s.get("state_requirement_met"):
            meeting_requirements += 1
        
        last_session = s.get("last_session_date")
        if last_session:
            if isinstance(last_session, str):
                last_session = datetime.fromisoformat(last_session.replace('Z', '+00:00'))
            elif last_session.tzinfo is None:
                last_session = last_session.replace(tzinfo=timezone.utc)
            
            if last_session > week_ago:
                active_students += 1
    
    avg_score = round(total_score / total_students) if total_students > 0 else 100
    
    return {
        "instructor": instructor,
        "total_students": total_students,
        "active_students": active_students,
        "students_meeting_requirements": meeting_requirements,
        "average_student_score": avg_score,
        "total_hours_supervised": round(total_hours, 1),
        "students": sorted(students, key=lambda x: x.get("name", ""))
    }


# ============ STUDENT INVITE LINK ============

@router.post("/invite", response_model=dict)
async def create_invite_link(instructor_id: str, request: dict):
    """Create an invite link for a student to join"""
    
    instructor = await db.instructors.find_one({"id": instructor_id})
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    
    invite_code = str(uuid4())[:8].upper()
    now = datetime.now(timezone.utc)
    
    invite = {
        "id": str(uuid4()),
        "instructor_id": instructor_id,
        "instructor_name": instructor["name"],
        "school_name": instructor.get("school_name"),
        "invite_code": invite_code,
        "student_name": request.get("student_name", ""),
        "created_at": now,
        "expires_at": now + timedelta(days=7),
        "used": False
    }
    
    await db.instructor_invites.insert_one(invite)
    
    return {
        "invite_code": invite_code,
        "invite_link": f"drivecoach://join/{invite_code}",
        "expires_at": invite["expires_at"]
    }


@router.get("/invite/{code}")
async def get_invite(code: str):
    """Get invite details (for student to see before joining)"""
    
    invite = await db.instructor_invites.find_one(
        {"invite_code": code.upper(), "used": False},
        {"_id": 0}
    )
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or expired")
    
    # Check expiration
    expires_at = invite.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        elif expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Invite has expired")
    
    return {
        "instructor_name": invite["instructor_name"],
        "school_name": invite.get("school_name"),
        "student_name": invite.get("student_name")
    }


@router.post("/invite/{code}/accept")
async def accept_invite(code: str, device_id: str, student_name: str):
    """Accept an instructor invite"""
    
    invite = await db.instructor_invites.find_one(
        {"invite_code": code.upper(), "used": False},
        {"_id": 0}
    )
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    
    # Create student link
    student_link = StudentLink(
        instructor_id=invite["instructor_id"],
        student_device_id=device_id,
        student_name=student_name or invite.get("student_name", "Student")
    )
    
    await add_student(student_link)
    
    # Mark invite as used
    await db.instructor_invites.update_one(
        {"invite_code": code.upper()},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "success": True,
        "instructor_name": invite["instructor_name"],
        "message": f"You're now connected with {invite['instructor_name']}!"
    }
