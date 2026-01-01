#!/usr/bin/env python3
"""
Debug Referral Code Application
"""

import requests
import time

base_url = "https://road-mentor.preview.emergentagent.com"

def debug_referral_flow():
    """Debug the complete referral flow"""
    
    # 1. Create referral code for user A
    print("1. Creating referral code for User A...")
    data_a = {
        "device_id": "debug_user_a_001",
        "email": "debug_user_a@example.com"
    }
    response_a = requests.post(f"{base_url}/api/referral/code", json=data_a, timeout=10)
    print(f"User A Status: {response_a.status_code}")
    print(f"User A Response: {response_a.text}")
    
    if response_a.status_code != 200:
        print("❌ Failed to create referral code for User A")
        return
    
    user_a_data = response_a.json()
    referral_code = user_a_data.get('referral_code')
    print(f"User A Referral Code: {referral_code}")
    
    # 2. Create referral code for user B
    print("\n2. Creating referral code for User B...")
    data_b = {
        "device_id": "debug_user_b_002",
        "email": "debug_user_b@example.com"
    }
    response_b = requests.post(f"{base_url}/api/referral/code", json=data_b, timeout=10)
    print(f"User B Status: {response_b.status_code}")
    print(f"User B Response: {response_b.text}")
    
    # 3. User B applies User A's referral code
    print(f"\n3. User B applying User A's referral code ({referral_code})...")
    apply_data = {
        "device_id": "debug_user_b_002",
        "referral_code": referral_code,
        "email": "debug_user_b@example.com"
    }
    apply_response = requests.post(f"{base_url}/api/referral/apply", json=apply_data, timeout=10)
    print(f"Apply Status: {apply_response.status_code}")
    print(f"Apply Response: {apply_response.text}")
    
    # 4. Check stats for User A
    print(f"\n4. Checking stats for User A...")
    stats_response = requests.get(f"{base_url}/api/referral/stats?device_id=debug_user_a_001", timeout=10)
    print(f"Stats Status: {stats_response.status_code}")
    print(f"Stats Response: {stats_response.text}")

if __name__ == "__main__":
    debug_referral_flow()