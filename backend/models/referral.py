# Referral System Models
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ReferralStatus(str, Enum):
    PENDING = "pending"      # Referral link shared but not used
    COMPLETED = "completed"  # Referee signed up
    REWARDED = "rewarded"    # Both parties received rewards


class ReferralCreate(BaseModel):
    """Create a referral code for a user"""
    device_id: str
    email: Optional[str] = None


class Referral(BaseModel):
    """Referral record"""
    id: str
    referrer_device_id: str
    referrer_email: Optional[str] = None
    referral_code: str  # 8-char unique code
    referee_device_id: Optional[str] = None
    referee_email: Optional[str] = None
    status: ReferralStatus
    referrer_rewarded: bool = False
    referee_rewarded: bool = False
    created_at: datetime
    completed_at: Optional[datetime] = None


class ReferralStats(BaseModel):
    """User's referral statistics"""
    device_id: str
    referral_code: str
    total_referrals: int = 0
    completed_referrals: int = 0
    pending_referrals: int = 0
    total_rewards_earned: int = 0  # Free months earned
    referral_link: str


class ReferralReward(BaseModel):
    """Reward record"""
    id: str
    device_id: str
    reward_type: str  # "free_month", "premium_feature"
    reward_value: int  # Number of months or days
    source: str  # "referral_sent", "referral_received"
    referral_id: str
    applied: bool = False
    created_at: datetime
    expires_at: Optional[datetime] = None


class ApplyReferralCode(BaseModel):
    """Apply a referral code when signing up"""
    device_id: str
    referral_code: str
    email: Optional[str] = None
