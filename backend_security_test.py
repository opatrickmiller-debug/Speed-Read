#!/usr/bin/env python3
"""
Security-focused Backend API Testing for Speed Alert App
Tests JWT authentication, rate limiting, input validation, user isolation, and authorization
"""

import requests
import sys
import json
import time
from datetime import datetime
import threading
from concurrent.futures import ThreadPoolExecutor

class SecurityAPITester:
    def __init__(self, base_url="https://speedalert-5.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.user_tokens = {}  # Store tokens for different users
        self.created_users = []
        self.created_trips = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    # ==================== AUTHENTICATION TESTS ====================
    
    def test_user_registration(self):
        """Test user registration with valid data"""
        try:
            timestamp = int(time.time())
            email = f"test_user_{timestamp}@example.com"
            password = "secure123"
            
            data = {"email": email, "password": password}
            response = requests.post(f"{self.api_url}/auth/register", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                required_fields = ["access_token", "token_type", "user_id", "email"]
                has_all_fields = all(field in response_data for field in required_fields)
                
                if has_all_fields:
                    self.user_tokens[email] = response_data["access_token"]
                    self.created_users.append(email)
                    details += f", User ID: {response_data['user_id']}, Token received"
                else:
                    success = False
                    details += f", Missing fields: {response_data}"
            
            self.log_test("User Registration - Valid Data", success, details)
            return success, email if success else None
        except Exception as e:
            self.log_test("User Registration - Valid Data", False, str(e))
            return False, None

    def test_user_login_valid(self):
        """Test user login with valid credentials"""
        try:
            # Use existing test user
            email = "test@example.com"
            password = "secure123"
            
            data = {"email": email, "password": password}
            response = requests.post(f"{self.api_url}/auth/login", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                required_fields = ["access_token", "token_type", "user_id", "email"]
                has_all_fields = all(field in response_data for field in required_fields)
                
                if has_all_fields:
                    self.user_tokens[email] = response_data["access_token"]
                    details += f", User ID: {response_data['user_id']}, Token received"
                else:
                    success = False
                    details += f", Missing fields: {response_data}"
            
            self.log_test("User Login - Valid Credentials", success, details)
            return success, email if success else None
        except Exception as e:
            self.log_test("User Login - Valid Credentials", False, str(e))
            return False, None

    def test_user_login_invalid(self):
        """Test user login with invalid credentials"""
        try:
            data = {"email": "invalid@example.com", "password": "wrongpassword"}
            response = requests.post(f"{self.api_url}/auth/login", json=data, timeout=10)
            
            success = response.status_code == 401
            details = f"Status: {response.status_code} (expected 401 for invalid credentials)"
            
            self.log_test("User Login - Invalid Credentials", success, details)
            return success
        except Exception as e:
            self.log_test("User Login - Invalid Credentials", False, str(e))
            return False

    def test_get_user_info_with_token(self):
        """Test getting user info with valid token"""
        try:
            # Use a valid token
            if not self.user_tokens:
                self.log_test("Get User Info - Valid Token", False, "No valid tokens available")
                return False
            
            email = list(self.user_tokens.keys())[0]
            token = self.user_tokens[email]
            
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{self.api_url}/auth/me", headers=headers, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                required_fields = ["user_id", "email"]
                has_all_fields = all(field in response_data for field in required_fields)
                
                if has_all_fields:
                    details += f", Email: {response_data['email']}, User ID: {response_data['user_id']}"
                else:
                    success = False
                    details += f", Missing fields: {response_data}"
            
            self.log_test("Get User Info - Valid Token", success, details)
            return success
        except Exception as e:
            self.log_test("Get User Info - Valid Token", False, str(e))
            return False

    # ==================== AUTHORIZATION TESTS ====================
    
    def test_protected_endpoint_without_token(self):
        """Test accessing protected endpoints without token"""
        endpoints = [
            "/trips",
            "/trips/start", 
            "/auth/me"
        ]
        
        for endpoint in endpoints:
            try:
                if endpoint == "/trips/start":
                    response = requests.post(f"{self.api_url}{endpoint}", json={}, timeout=10)
                else:
                    response = requests.get(f"{self.api_url}{endpoint}", timeout=10)
                
                success = response.status_code == 401
                details = f"Status: {response.status_code} (expected 401 for {endpoint})"
                
                self.log_test(f"Protected Endpoint Without Token - {endpoint}", success, details)
            except Exception as e:
                self.log_test(f"Protected Endpoint Without Token - {endpoint}", False, str(e))

    def test_protected_endpoint_invalid_token(self):
        """Test accessing protected endpoints with invalid token"""
        try:
            headers = {"Authorization": "Bearer invalid_token_here"}
            response = requests.get(f"{self.api_url}/trips", headers=headers, timeout=10)
            
            success = response.status_code == 401
            details = f"Status: {response.status_code} (expected 401 for invalid token)"
            
            self.log_test("Protected Endpoint - Invalid Token", success, details)
            return success
        except Exception as e:
            self.log_test("Protected Endpoint - Invalid Token", False, str(e))
            return False

    # ==================== RATE LIMITING TESTS ====================
    
    def test_rate_limit_register(self):
        """Test rate limiting on registration endpoint (5/minute)"""
        try:
            print("Testing registration rate limit (5/minute)...")
            
            # Make 6 rapid requests to exceed limit
            responses = []
            for i in range(6):
                timestamp = int(time.time() * 1000) + i  # Unique timestamp
                data = {
                    "email": f"ratelimit_test_{timestamp}@example.com",
                    "password": "secure123"
                }
                response = requests.post(f"{self.api_url}/auth/register", json=data, timeout=10)
                responses.append(response.status_code)
                time.sleep(0.1)  # Small delay between requests
            
            # Should have at least one 429 (rate limited) response
            rate_limited = any(status == 429 for status in responses)
            success = rate_limited
            details = f"Response codes: {responses}, Rate limited: {rate_limited}"
            
            self.log_test("Rate Limit - Registration (5/minute)", success, details)
            return success
        except Exception as e:
            self.log_test("Rate Limit - Registration (5/minute)", False, str(e))
            return False

    def test_rate_limit_login(self):
        """Test rate limiting on login endpoint (10/minute)"""
        try:
            print("Testing login rate limit (10/minute)...")
            
            # Make 12 rapid requests to exceed limit
            responses = []
            for i in range(12):
                data = {
                    "email": f"ratelimit_test_{i}@example.com",
                    "password": "wrongpassword"
                }
                response = requests.post(f"{self.api_url}/auth/login", json=data, timeout=10)
                responses.append(response.status_code)
                time.sleep(0.1)  # Small delay between requests
            
            # Should have at least one 429 (rate limited) response
            rate_limited = any(status == 429 for status in responses)
            success = rate_limited
            details = f"Response codes: {responses}, Rate limited: {rate_limited}"
            
            self.log_test("Rate Limit - Login (10/minute)", success, details)
            return success
        except Exception as e:
            self.log_test("Rate Limit - Login (10/minute)", False, str(e))
            return False

    def test_rate_limit_speed_limit(self):
        """Test rate limiting on speed-limit endpoint (30/minute)"""
        try:
            print("Testing speed-limit rate limit (30/minute)...")
            
            # Make 35 rapid requests to exceed limit
            responses = []
            for i in range(35):
                params = {"lat": 37.7749, "lon": -122.4194}
                response = requests.get(f"{self.api_url}/speed-limit", params=params, timeout=10)
                responses.append(response.status_code)
                if i % 10 == 0:
                    print(f"  Made {i+1} requests...")
                time.sleep(0.05)  # Small delay between requests
            
            # Should have at least one 429 (rate limited) response
            rate_limited = any(status == 429 for status in responses)
            success = rate_limited
            details = f"Total requests: {len(responses)}, Rate limited: {rate_limited}"
            
            self.log_test("Rate Limit - Speed Limit (30/minute)", success, details)
            return success
        except Exception as e:
            self.log_test("Rate Limit - Speed Limit (30/minute)", False, str(e))
            return False

    # ==================== INPUT VALIDATION TESTS ====================
    
    def test_input_validation_email(self):
        """Test email format validation"""
        invalid_emails = [
            "invalid-email",
            "@example.com",
            "test@",
            "test..test@example.com",
            ""
        ]
        
        for email in invalid_emails:
            try:
                data = {"email": email, "password": "secure123"}
                response = requests.post(f"{self.api_url}/auth/register", json=data, timeout=10)
                
                success = response.status_code == 422
                details = f"Email: '{email}', Status: {response.status_code} (expected 422)"
                
                self.log_test(f"Input Validation - Invalid Email ({email})", success, details)
            except Exception as e:
                self.log_test(f"Input Validation - Invalid Email ({email})", False, str(e))

    def test_input_validation_password(self):
        """Test password length validation"""
        short_passwords = ["", "1", "12", "123", "1234", "12345"]  # Less than 6 characters
        
        for password in short_passwords:
            try:
                timestamp = int(time.time() * 1000)
                data = {
                    "email": f"test_pwd_{timestamp}@example.com",
                    "password": password
                }
                response = requests.post(f"{self.api_url}/auth/register", json=data, timeout=10)
                
                success = response.status_code == 422
                details = f"Password length: {len(password)}, Status: {response.status_code} (expected 422)"
                
                self.log_test(f"Input Validation - Short Password ({len(password)} chars)", success, details)
            except Exception as e:
                self.log_test(f"Input Validation - Short Password ({len(password)} chars)", False, str(e))

    def test_input_validation_coordinates(self):
        """Test coordinate validation"""
        invalid_coords = [
            {"lat": 91, "lon": 0},      # Invalid latitude > 90
            {"lat": -91, "lon": 0},     # Invalid latitude < -90
            {"lat": 0, "lon": 181},     # Invalid longitude > 180
            {"lat": 0, "lon": -181},    # Invalid longitude < -180
        ]
        
        for coords in invalid_coords:
            try:
                response = requests.get(f"{self.api_url}/speed-limit", params=coords, timeout=10)
                
                success = response.status_code == 400
                details = f"Coords: {coords}, Status: {response.status_code} (expected 400)"
                
                self.log_test(f"Input Validation - Invalid Coordinates {coords}", success, details)
            except Exception as e:
                self.log_test(f"Input Validation - Invalid Coordinates {coords}", False, str(e))

    def test_input_validation_speed(self):
        """Test speed validation in trip data points"""
        if not self.user_tokens:
            self.log_test("Input Validation - Speed", False, "No valid tokens available")
            return False
        
        email = list(self.user_tokens.keys())[0]
        token = self.user_tokens[email]
        headers = {"Authorization": f"Bearer {token}"}
        
        # First create a trip
        try:
            trip_data = {
                "start_lat": 37.7749,
                "start_lon": -122.4194,
                "speed_unit": "mph"
            }
            response = requests.post(f"{self.api_url}/trips/start", json=trip_data, headers=headers, timeout=10)
            
            if response.status_code != 200:
                self.log_test("Input Validation - Speed", False, "Could not create trip for speed validation")
                return False
            
            trip_id = response.json()["trip_id"]
            self.created_trips.append(trip_id)
            
            # Test invalid speeds
            invalid_speeds = [-1, 501, 1000]  # Outside 0-500 range
            
            for speed in invalid_speeds:
                data_point_data = {
                    "trip_id": trip_id,
                    "data_point": {
                        "timestamp": datetime.now().isoformat(),
                        "lat": 37.7750,
                        "lon": -122.4195,
                        "speed": speed,
                        "speed_limit": 35,
                        "is_speeding": False
                    }
                }
                response = requests.post(f"{self.api_url}/trips/data-point", json=data_point_data, headers=headers, timeout=10)
                
                success = response.status_code == 422
                details = f"Speed: {speed}, Status: {response.status_code} (expected 422)"
                
                self.log_test(f"Input Validation - Invalid Speed ({speed})", success, details)
                
        except Exception as e:
            self.log_test("Input Validation - Speed", False, str(e))

    # ==================== USER ISOLATION TESTS ====================
    
    def test_user_isolation_trips(self):
        """Test that users can only see their own trips"""
        try:
            # Create two users
            user1_success, user1_email = self.test_user_registration()
            user2_success, user2_email = self.test_user_registration()
            
            if not (user1_success and user2_success):
                self.log_test("User Isolation - Trip Access", False, "Could not create test users")
                return False
            
            user1_token = self.user_tokens[user1_email]
            user2_token = self.user_tokens[user2_email]
            
            # User 1 creates a trip
            headers1 = {"Authorization": f"Bearer {user1_token}"}
            trip_data = {
                "start_lat": 37.7749,
                "start_lon": -122.4194,
                "speed_unit": "mph"
            }
            response = requests.post(f"{self.api_url}/trips/start", json=trip_data, headers=headers1, timeout=10)
            
            if response.status_code != 200:
                self.log_test("User Isolation - Trip Access", False, "Could not create trip for user 1")
                return False
            
            trip_id = response.json()["trip_id"]
            self.created_trips.append(trip_id)
            
            # User 2 tries to access User 1's trip
            headers2 = {"Authorization": f"Bearer {user2_token}"}
            response = requests.get(f"{self.api_url}/trips/{trip_id}", headers=headers2, timeout=10)
            
            success = response.status_code == 404  # Should not find the trip
            details = f"Status: {response.status_code} (expected 404 - trip not found for different user)"
            
            self.log_test("User Isolation - Trip Access", success, details)
            
            # Also test trip list isolation
            response1 = requests.get(f"{self.api_url}/trips", headers=headers1, timeout=10)
            response2 = requests.get(f"{self.api_url}/trips", headers=headers2, timeout=10)
            
            if response1.status_code == 200 and response2.status_code == 200:
                user1_trips = response1.json().get("trips", [])
                user2_trips = response2.json().get("trips", [])
                
                # User 1 should see their trip, User 2 should not
                user1_has_trip = any(trip["id"] == trip_id for trip in user1_trips)
                user2_has_trip = any(trip["id"] == trip_id for trip in user2_trips)
                
                isolation_success = user1_has_trip and not user2_has_trip
                details = f"User1 sees trip: {user1_has_trip}, User2 sees trip: {user2_has_trip}"
                
                self.log_test("User Isolation - Trip List", isolation_success, details)
            
            return success
            
        except Exception as e:
            self.log_test("User Isolation - Trip Access", False, str(e))
            return False

    # ==================== COMPREHENSIVE TEST RUNNER ====================
    
    def run_all_security_tests(self):
        """Run all security-focused tests"""
        print("🔒 Starting Security-focused API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 70)
        
        try:
            # Authentication Tests
            print("\n🔐 Testing Authentication...")
            self.test_user_registration()
            self.test_user_login_valid()
            self.test_user_login_invalid()
            self.test_get_user_info_with_token()
            
            # Authorization Tests
            print("\n🛡️  Testing Authorization...")
            self.test_protected_endpoint_without_token()
            self.test_protected_endpoint_invalid_token()
            
            # Rate Limiting Tests
            print("\n⏱️  Testing Rate Limiting...")
            self.test_rate_limit_register()
            time.sleep(2)  # Brief pause between rate limit tests
            self.test_rate_limit_login()
            time.sleep(2)
            self.test_rate_limit_speed_limit()
            
            # Input Validation Tests
            print("\n✅ Testing Input Validation...")
            self.test_input_validation_email()
            self.test_input_validation_password()
            self.test_input_validation_coordinates()
            self.test_input_validation_speed()
            
            # User Isolation Tests
            print("\n👥 Testing User Isolation...")
            self.test_user_isolation_trips()
            
            # Print summary
            print("=" * 70)
            print(f"📊 Security Test Results: {self.tests_passed}/{self.tests_run} passed")
            success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
            print(f"📈 Success Rate: {success_rate:.1f}%")
            
            return self.tests_passed == self.tests_run
            
        except Exception as e:
            print(f"💥 Unexpected error during security testing: {str(e)}")
            return False

def main():
    tester = SecurityAPITester()
    success = tester.run_all_security_tests()
    
    # Save detailed results
    with open("/app/backend_security_test_results.json", "w") as f:
        json.dump({
            "summary": {
                "total_tests": tester.tests_run,
                "passed_tests": tester.tests_passed,
                "success_rate": (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0,
                "timestamp": datetime.now().isoformat(),
                "test_type": "security_focused"
            },
            "test_results": tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())