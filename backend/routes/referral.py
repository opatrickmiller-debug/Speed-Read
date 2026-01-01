# Referral System API Routes
from fastapi import APIRouter, HTTPException, Request
from typing import Optional, List
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import secrets
import logging

from models.referral import (
    ReferralCreate, Referral, ReferralStats, ReferralReward,
    ApplyReferralCode, ReferralStatus
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/referral", tags=["referral"])

# Database reference
db = None

def set_db(database):
    global db
    db = database


def generate_referral_code() -> str:
    """Generate a unique 8-character referral code"""
    return secrets.token_urlsafe(6)[:8].upper()


# ============ REFERRAL CODE MANAGEMENT ============

@router.post("/code", response_model=dict)
async def get_or_create_referral_code(request: Request, data: ReferralCreate):
    """Get existing or create new referral code for a user"""
    
    # Check if user already has a referral code
    existing = await db.referral_codes.find_one(
        {"device_id": data.device_id},
        {"_id": 0}
    )
    
    if existing:
        base_url = str(request.base_url).rstrip('/')
        return {
            "referral_code": existing["referral_code"],
            "referral_link": f"{base_url}/?ref={existing['referral_code']}",
            "created_at": existing["created_at"]
        }
    
    # Create new referral code
    referral_code = generate_referral_code()
    now = datetime.now(timezone.utc)
    
    # Ensure code is unique
    while await db.referral_codes.find_one({"referral_code": referral_code}):
        referral_code = generate_referral_code()
    
    code_record = {
        "id": str(uuid4()),
        "device_id": data.device_id,
        "email": data.email,
        "referral_code": referral_code,
        "created_at": now
    }
    
    await db.referral_codes.insert_one(code_record)
    
    base_url = str(request.base_url).rstrip('/')
    logger.info(f"Created referral code {referral_code} for device {data.device_id}")
    
    return {
        "referral_code": referral_code,
        "referral_link": f"{base_url}/?ref={referral_code}",
        "created_at": now
    }


@router.post("/apply", response_model=dict)
async def apply_referral_code(data: ApplyReferralCode):
    """Apply a referral code when a new user signs up"""
    
    # Find the referral code
    code_record = await db.referral_codes.find_one(
        {"referral_code": data.referral_code.upper()},
        {"_id": 0}
    )
    
    if not code_record:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    # Can't refer yourself
    if code_record["device_id"] == data.device_id:
        raise HTTPException(status_code=400, detail="Cannot use your own referral code")
    
    # Check if this device already used a referral code
    existing_referral = await db.referrals.find_one(
        {"referee_device_id": data.device_id},
        {"_id": 0}
    )
    
    if existing_referral:
        raise HTTPException(status_code=400, detail="You have already used a referral code")
    
    now = datetime.now(timezone.utc)
    referral_id = str(uuid4())
    
    # Create referral record
    referral = {
        "id": referral_id,
        "referrer_device_id": code_record["device_id"],
        "referrer_email": code_record.get("email"),
        "referral_code": data.referral_code.upper(),
        "referee_device_id": data.device_id,
        "referee_email": data.email,
        "status": ReferralStatus.COMPLETED.value,
        "referrer_rewarded": False,
        "referee_rewarded": False,
        "created_at": now,
        "completed_at": now
    }
    
    await db.referrals.insert_one(referral)
    
    # Create rewards for both parties
    reward_expiry = now + timedelta(days=365)
    
    # Reward for referrer (1 free month)
    referrer_reward = {
        "id": str(uuid4()),
        "device_id": code_record["device_id"],
        "reward_type": "free_month",
        "reward_value": 1,
        "source": "referral_sent",
        "referral_id": referral_id,
        "applied": False,
        "created_at": now,
        "expires_at": reward_expiry
    }
    
    # Reward for referee (1 free month)
    referee_reward = {
        "id": str(uuid4()),
        "device_id": data.device_id,
        "reward_type": "free_month",
        "reward_value": 1,
        "source": "referral_received",
        "referral_id": referral_id,
        "applied": False,
        "created_at": now,
        "expires_at": reward_expiry
    }
    
    await db.referral_rewards.insert_many([referrer_reward, referee_reward])
    
    # Update referral as rewarded
    await db.referrals.update_one(
        {"id": referral_id},
        {"$set": {"referrer_rewarded": True, "referee_rewarded": True}}
    )
    
    logger.info(f"Referral code {data.referral_code} applied by {data.device_id}")
    
    return {
        "success": True,
        "message": "Referral code applied! You both earned 1 free month.",
        "reward": {
            "type": "free_month",
            "value": 1
        }
    }


@router.get("/stats", response_model=ReferralStats)
async def get_referral_stats(request: Request, device_id: str):
    """Get referral statistics for a user"""
    
    # Get or create referral code
    code_record = await db.referral_codes.find_one(
        {"device_id": device_id},
        {"_id": 0}
    )
    
    if not code_record:
        # Create one if doesn't exist
        code_response = await get_or_create_referral_code(
            request,
            ReferralCreate(device_id=device_id)
        )
        referral_code = code_response["referral_code"]
    else:
        referral_code = code_record["referral_code"]
    
    # Count referrals
    total = await db.referrals.count_documents({"referrer_device_id": device_id})
    completed = await db.referrals.count_documents({
        "referrer_device_id": device_id,
        "status": ReferralStatus.COMPLETED.value
    })
    pending = total - completed
    
    # Count rewards
    rewards = await db.referral_rewards.find(
        {"device_id": device_id, "source": "referral_sent"},
        {"_id": 0}
    ).to_list(100)
    total_rewards = sum(r.get("reward_value", 0) for r in rewards)
    
    base_url = str(request.base_url).rstrip('/')
    
    return ReferralStats(
        device_id=device_id,
        referral_code=referral_code,
        total_referrals=total,
        completed_referrals=completed,
        pending_referrals=pending,
        total_rewards_earned=total_rewards,
        referral_link=f"{base_url}/?ref={referral_code}"
    )


@router.get("/rewards", response_model=List[dict])
async def get_rewards(device_id: str):
    """Get all rewards for a user"""
    rewards = await db.referral_rewards.find(
        {"device_id": device_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return rewards


@router.get("/history", response_model=List[dict])
async def get_referral_history(device_id: str):
    """Get referral history (people you've referred)"""
    referrals = await db.referrals.find(
        {"referrer_device_id": device_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Mask email addresses for privacy
    for ref in referrals:
        if ref.get("referee_email"):
            email = ref["referee_email"]
            if "@" in email:
                parts = email.split("@")
                ref["referee_email"] = f"{parts[0][:2]}***@{parts[1]}"
    
    return referrals


@router.get("/validate/{code}")
async def validate_referral_code(code: str):
    """Check if a referral code is valid"""
    code_record = await db.referral_codes.find_one(
        {"referral_code": code.upper()},
        {"_id": 0}
    )
    
    if not code_record:
        return {"valid": False, "message": "Invalid referral code"}
    
    return {"valid": True, "message": "Valid referral code - you'll both get 1 free month!"}
