#!/usr/bin/env python3
"""
Debug DriveCoach API Issues
"""

import requests
import time

base_url = "https://road-mentor.preview.emergentagent.com"

def test_instructor_registration_and_login():
    """Test instructor registration and login with detailed debugging"""
    
    # Use a fixed timestamp for consistent testing
    timestamp = int(time.time())
    email = f"debug_instructor_{timestamp}@drivingschool.com"
    password = "DebugPass123!"
    
    print(f"Testing with email: {email}")
    print(f"Testing with password: {password}")
    
    # 1. Register instructor
    print("\n1. Registering instructor...")
    register_data = {
        "email": email,
        "password": password,
        "name": "Debug Instructor",
        "phone": "+1-555-0123",
        "school_name": "Debug Driving School",
        "license_number": "DEBUG123"
    }
    
    register_response = requests.post(f"{base_url}/api/instructor/register", json=register_data, timeout=10)
    print(f"Register Status: {register_response.status_code}")
    print(f"Register Response: {register_response.text}")
    
    if register_response.status_code != 200:
        print("❌ Registration failed, cannot test login")
        return
    
    register_data = register_response.json()
    instructor_id = register_data.get('instructor', {}).get('id')
    print(f"Instructor ID: {instructor_id}")
    
    # 2. Try to login with same credentials
    print("\n2. Attempting login...")
    login_data = {
        "email": email,
        "password": password
    }
    
    login_response = requests.post(f"{base_url}/api/instructor/login", json=login_data, timeout=10)
    print(f"Login Status: {login_response.status_code}")
    print(f"Login Response: {login_response.text}")
    
    # 3. Try duplicate registration
    print("\n3. Testing duplicate registration...")
    duplicate_response = requests.post(f"{base_url}/api/instructor/register", json=register_data, timeout=10)
    print(f"Duplicate Status: {duplicate_response.status_code}")
    print(f"Duplicate Response: {duplicate_response.text}")

if __name__ == "__main__":
    test_instructor_registration_and_login()