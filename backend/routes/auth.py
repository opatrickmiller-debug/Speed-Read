from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
import uuid
from core.database import db
from core.security import hash_password, verify_password, create_access_token, get_current_user
from models.user import UserCreate, UserLogin, UserResponse, TokenResponse, UserSettingsUpdate, ProteinGoalUpdate

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password": hash_password(user_data.password),
        "protein_goal": 150.0,
        "daily_carb_limit": 20.0,
        "body_weight_kg": 70.0,
        "body_fat_percentage": 20.0,
        "protein_per_kg_lbm": 2.0,
        "unit_system": "imperial",
        "created_at": now.isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_access_token({"sub": user_id})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            name=user_data.name,
            protein_goal=150.0,
            daily_carb_limit=20.0,
            body_weight_kg=70.0,
            body_fat_percentage=20.0,
            protein_per_kg_lbm=2.0,
            unit_system="imperial",
            created_at=now
        )
    )

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user["id"]})
    
    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    else:
        created_at = datetime.now(timezone.utc)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            protein_goal=user.get("protein_goal", 150.0),
            daily_carb_limit=user.get("daily_carb_limit", 20.0),
            body_weight_kg=user.get("body_weight_kg", 70.0),
            body_fat_percentage=user.get("body_fat_percentage", 20.0),
            protein_per_kg_lbm=user.get("protein_per_kg_lbm", 2.0),
            unit_system=user.get("unit_system", "metric"),
            created_at=created_at
        )
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    created_at = current_user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    else:
        created_at = datetime.now(timezone.utc)
    
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        protein_goal=current_user.get("protein_goal", 150.0),
        daily_carb_limit=current_user.get("daily_carb_limit", 20.0),
        body_weight_kg=current_user.get("body_weight_kg", 70.0),
        body_fat_percentage=current_user.get("body_fat_percentage", 20.0),
        protein_per_kg_lbm=current_user.get("protein_per_kg_lbm", 2.0),
        unit_system=current_user.get("unit_system", "metric"),
        created_at=created_at
    )

@router.put("/settings", response_model=UserResponse)
async def update_user_settings(data: UserSettingsUpdate, current_user: dict = Depends(get_current_user)):
    update_fields = {}
    
    if data.protein_goal is not None:
        update_fields["protein_goal"] = data.protein_goal
    if data.daily_carb_limit is not None:
        update_fields["daily_carb_limit"] = data.daily_carb_limit
    if data.body_weight_kg is not None:
        update_fields["body_weight_kg"] = data.body_weight_kg
    if data.body_fat_percentage is not None:
        update_fields["body_fat_percentage"] = data.body_fat_percentage
    if data.protein_per_kg_lbm is not None:
        update_fields["protein_per_kg_lbm"] = data.protein_per_kg_lbm
    if data.unit_system is not None:
        update_fields["unit_system"] = data.unit_system
    
    if update_fields:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": update_fields}
        )
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    
    created_at = updated_user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    else:
        created_at = datetime.now(timezone.utc)
    
    return UserResponse(
        id=updated_user["id"],
        email=updated_user["email"],
        name=updated_user["name"],
        protein_goal=updated_user.get("protein_goal", 150.0),
        daily_carb_limit=updated_user.get("daily_carb_limit", 20.0),
        body_weight_kg=updated_user.get("body_weight_kg", 70.0),
        body_fat_percentage=updated_user.get("body_fat_percentage", 20.0),
        protein_per_kg_lbm=updated_user.get("protein_per_kg_lbm", 2.0),
        unit_system=updated_user.get("unit_system", "metric"),
        created_at=created_at
    )

@router.get("/calculate-protein-goal")
async def calculate_protein_goal(current_user: dict = Depends(get_current_user)):
    body_weight = current_user.get("body_weight_kg", 70.0)
    body_fat_pct = current_user.get("body_fat_percentage", 20.0)
    protein_multiplier = current_user.get("protein_per_kg_lbm", 2.0)
    
    lean_body_mass = body_weight * (1 - body_fat_pct / 100)
    recommended_protein = lean_body_mass * protein_multiplier
    
    return {
        "body_weight_kg": body_weight,
        "body_fat_percentage": body_fat_pct,
        "lean_body_mass_kg": round(lean_body_mass, 1),
        "protein_per_kg_lbm": protein_multiplier,
        "recommended_protein_goal": round(recommended_protein, 0),
        "formula": f"{lean_body_mass:.1f}kg LBM x {protein_multiplier}g/kg = {recommended_protein:.0f}g protein"
    }

@router.put("/protein-goal", response_model=UserResponse)
async def update_protein_goal(data: ProteinGoalUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"protein_goal": data.protein_goal}}
    )
    
    created_at = current_user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    else:
        created_at = datetime.now(timezone.utc)
    
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        protein_goal=data.protein_goal,
        daily_carb_limit=current_user.get("daily_carb_limit", 20.0),
        body_weight_kg=current_user.get("body_weight_kg", 70.0),
        body_fat_percentage=current_user.get("body_fat_percentage", 20.0),
        protein_per_kg_lbm=current_user.get("protein_per_kg_lbm", 2.0),
        created_at=created_at
    )
