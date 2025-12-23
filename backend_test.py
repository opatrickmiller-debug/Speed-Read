#!/usr/bin/env python3
"""
Backend API Testing for Speed Alert App
Tests all endpoints including the 4 differentiation features:
1. Gamification (stats, badges)
2. Export Reports 
3. Family Mode
4. Crowdsourced Speed Traps
"""

import requests
import sys
import json
import time
from datetime import datetime, timedelta

class SpeedAlertAPITester:
    def __init__(self, base_url="https://speedsentry-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_trip_ids = []
        self.auth_token = None
        self.user_email = None
        self.family_id = None
        self.created_trap_ids = []

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

    def get_auth_headers(self):
        """Get authorization headers"""
        if self.auth_token:
            return {"Authorization": f"Bearer {self.auth_token}", "Content-Type": "application/json"}
        return {"Content-Type": "application/json"}

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.base_url}/api/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                data = response.json()
                details += f", Response: {data}"
            self.log_test("API Root Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("API Root Endpoint", False, str(e))
            return False

    def test_speed_limit_valid_location(self):
        """Test speed limit endpoint with valid coordinates (San Francisco)"""
        try:
            # San Francisco coordinates - should have road data
            params = {"lat": 37.7749, "lon": -122.4194}
            response = requests.get(f"{self.base_url}/api/speed-limit", params=params, timeout=15)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                # Check response structure
                required_fields = ["speed_limit", "unit", "road_name", "source"]
                has_all_fields = all(field in data for field in required_fields)
                
                if has_all_fields:
                    details += f", Speed Limit: {data.get('speed_limit')}, Unit: {data.get('unit')}, Road: {data.get('road_name')}, Source: {data.get('source')}"
                else:
                    success = False
                    details += f", Missing fields in response: {data}"
            
            self.log_test("Speed Limit - Valid Location", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Speed Limit - Valid Location", False, str(e))
            return False, {}

    def test_speed_limit_invalid_params(self):
        """Test speed limit endpoint with invalid parameters"""
        try:
            # Test with invalid coordinates
            params = {"lat": "invalid", "lon": "invalid"}
            response = requests.get(f"{self.base_url}/api/speed-limit", params=params, timeout=10)
            
            # Should return 422 for invalid parameters
            success = response.status_code == 422
            details = f"Status: {response.status_code} (expected 422 for invalid params)"
            
            self.log_test("Speed Limit - Invalid Parameters", success, details)
            return success
        except Exception as e:
            self.log_test("Speed Limit - Invalid Parameters", False, str(e))
            return False

    def test_speed_limit_missing_params(self):
        """Test speed limit endpoint with missing parameters"""
        try:
            # Test with missing parameters
            response = requests.get(f"{self.base_url}/api/speed-limit", timeout=10)
            
            # Should return 422 for missing required parameters
            success = response.status_code == 422
            details = f"Status: {response.status_code} (expected 422 for missing params)"
            
            self.log_test("Speed Limit - Missing Parameters", success, details)
            return success
        except Exception as e:
            self.log_test("Speed Limit - Missing Parameters", False, str(e))
            return False

    def test_speed_limit_remote_location(self):
        """Test speed limit endpoint with remote location (ocean coordinates)"""
        try:
            # Ocean coordinates - should return no data
            params = {"lat": 0.0, "lon": 0.0}  # Middle of Atlantic Ocean
            response = requests.get(f"{self.base_url}/api/speed-limit", params=params, timeout=15)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                # Should return null speed_limit for ocean location
                expected_null_limit = data.get("speed_limit") is None
                details += f", Speed Limit: {data.get('speed_limit')} (should be null), Source: {data.get('source')}"
                success = expected_null_limit
            
            self.log_test("Speed Limit - Remote Location", success, details)
            return success
        except Exception as e:
            self.log_test("Speed Limit - Remote Location", False, str(e))
            return False

    def test_api_response_time(self):
        """Test API response time"""
        try:
            import time
            start_time = time.time()
            
            params = {"lat": 37.7749, "lon": -122.4194}
            response = requests.get(f"{self.base_url}/api/speed-limit", params=params, timeout=20)
            
            end_time = time.time()
            response_time = end_time - start_time
            
            # API should respond within 20 seconds (including external API calls)
            success = response.status_code == 200 and response_time < 20
            details = f"Response time: {response_time:.2f}s, Status: {response.status_code}"
            
            self.log_test("API Response Time", success, details)
            return success
        except Exception as e:
            self.log_test("API Response Time", False, str(e))
            return False

    # ==================== AUTHENTICATION TESTS ====================
    
    def test_user_registration(self):
        """Test user registration"""
        try:
            # Generate unique email for testing
            timestamp = int(time.time())
            self.user_email = f"test_user_{timestamp}@example.com"
            
            data = {
                "email": self.user_email,
                "password": "TestPass123!"
            }
            response = requests.post(f"{self.base_url}/api/auth/register", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'access_token' in response_data:
                    self.auth_token = response_data['access_token']
                    details += f", User ID: {response_data.get('user_id')}, Email: {response_data.get('email')}"
                else:
                    success = False
                    details += ", Missing access_token in response"
            
            self.log_test("User Registration", success, details)
            return success
        except Exception as e:
            self.log_test("User Registration", False, str(e))
            return False

    def test_user_login(self):
        """Test user login with registered credentials"""
        try:
            if not self.user_email:
                self.log_test("User Login", False, "No registered user email available")
                return False
                
            data = {
                "email": self.user_email,
                "password": "TestPass123!"
            }
            response = requests.post(f"{self.base_url}/api/auth/login", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'access_token' in response_data:
                    self.auth_token = response_data['access_token']
                    details += f", Token received, User ID: {response_data.get('user_id')}"
                else:
                    success = False
                    details += ", Missing access_token in response"
            
            self.log_test("User Login", success, details)
            return success
        except Exception as e:
            self.log_test("User Login", False, str(e))
            return False

    def test_get_user_profile(self):
        """Test getting current user profile"""
        try:
            headers = self.get_auth_headers()
            response = requests.get(f"{self.base_url}/api/auth/me", headers=headers, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                details += f", User ID: {response_data.get('user_id')}, Email: {response_data.get('email')}"
            
            self.log_test("Get User Profile", success, details)
            return success
        except Exception as e:
            self.log_test("Get User Profile", False, str(e))
            return False

    # ==================== GAMIFICATION TESTS ====================
    
    def test_get_user_stats(self):
        """Test getting user gamification stats"""
        try:
            headers = self.get_auth_headers()
            response = requests.get(f"{self.base_url}/api/stats", headers=headers, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                required_fields = ["total_trips", "total_distance", "total_alerts", "current_streak", "badges"]
                has_all_fields = all(field in response_data for field in required_fields)
                
                if has_all_fields:
                    details += f", Trips: {response_data.get('total_trips')}, Distance: {response_data.get('total_distance')}, Badges: {len(response_data.get('badges', []))}"
                else:
                    success = False
                    details += f", Missing fields in response: {response_data}"
            
            self.log_test("Get User Stats", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Get User Stats", False, str(e))
            return False, {}

    def test_get_all_badges(self):
        """Test getting all available badges (public endpoint)"""
        try:
            response = requests.get(f"{self.base_url}/api/badges", timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'badges' in response_data:
                    badge_count = len(response_data['badges'])
                    details += f", Badge count: {badge_count}"
                    # Check for some expected badges
                    expected_badges = ["first_trip", "safe_week", "road_warrior"]
                    found_badges = [b for b in expected_badges if b in response_data['badges']]
                    details += f", Found expected badges: {found_badges}"
                else:
                    success = False
                    details += ", Missing 'badges' field in response"
            
            self.log_test("Get All Badges", success, details)
            return success
        except Exception as e:
            self.log_test("Get All Badges", False, str(e))
            return False

    # ==================== EXPORT REPORTS TESTS ====================
    
    def test_generate_report(self):
        """Test generating driving report"""
        try:
            headers = self.get_auth_headers()
            
            # Generate report for last 30 days
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            data = {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "format": "json"
            }
            response = requests.post(f"{self.base_url}/api/reports/generate", json=data, headers=headers, timeout=15)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'error' not in response_data:
                    # Check for required report fields
                    required_fields = ["report_id", "generated_at", "summary", "rating"]
                    has_all_fields = all(field in response_data for field in required_fields)
                    
                    if has_all_fields and 'summary' in response_data:
                        summary = response_data['summary']
                        details += f", Report ID: {response_data.get('report_id')}, Rating: {response_data.get('rating')}"
                        details += f", Trips: {summary.get('total_trips')}, Safety Score: {summary.get('safety_score')}"
                    else:
                        success = False
                        details += f", Missing fields in response: {response_data}"
                else:
                    # No trips found is acceptable for new user
                    details += f", {response_data.get('error')}"
            
            self.log_test("Generate Report", success, details)
            return success
        except Exception as e:
            self.log_test("Generate Report", False, str(e))
            return False

    # ==================== FAMILY MODE TESTS ====================
    
    def test_create_family(self):
        """Test creating a family group"""
        try:
            headers = self.get_auth_headers()
            
            data = {
                "name": f"Test Family {int(time.time())}"
            }
            response = requests.post(f"{self.base_url}/api/family/create", json=data, headers=headers, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'family_id' in response_data and 'invite_code' in response_data:
                    self.family_id = response_data['family_id']
                    details += f", Family ID: {response_data.get('family_id')}, Invite Code: {response_data.get('invite_code')}"
                else:
                    success = False
                    details += ", Missing family_id or invite_code in response"
            
            self.log_test("Create Family", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Create Family", False, str(e))
            return False, {}

    def test_get_family(self):
        """Test getting user's family information"""
        try:
            headers = self.get_auth_headers()
            response = requests.get(f"{self.base_url}/api/family", headers=headers, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'family' in response_data:
                    family = response_data.get('family')
                    if family:
                        details += f", Family Name: {family.get('name')}, Members: {family.get('member_count')}"
                        details += f", Is Owner: {response_data.get('is_owner')}"
                    else:
                        details += ", No family found (expected for new user)"
                else:
                    success = False
                    details += ", Missing 'family' field in response"
            
            self.log_test("Get Family", success, details)
            return success
        except Exception as e:
            self.log_test("Get Family", False, str(e))
            return False

    def test_join_family_invalid_code(self):
        """Test joining family with invalid invite code"""
        try:
            headers = self.get_auth_headers()
            response = requests.post(f"{self.base_url}/api/family/join/invalid_code", headers=headers, timeout=10)
            
            # Should return 404 for invalid invite code
            success = response.status_code == 404
            details = f"Status: {response.status_code} (expected 404 for invalid code)"
            
            self.log_test("Join Family - Invalid Code", success, details)
            return success
        except Exception as e:
            self.log_test("Join Family - Invalid Code", False, str(e))
            return False

    def test_leave_family(self):
        """Test leaving/deleting family"""
        try:
            headers = self.get_auth_headers()
            response = requests.delete(f"{self.base_url}/api/family/leave", headers=headers, timeout=10)
            
            # Should return 200 if family exists, 404 if no family
            success = response.status_code in [200, 404]
            details = f"Status: {response.status_code}"
            
            if response.status_code == 200:
                response_data = response.json()
                details += f", Message: {response_data.get('message')}"
            elif response.status_code == 404:
                details += " (no family to leave - expected for new user)"
            
            self.log_test("Leave Family", success, details)
            return success
        except Exception as e:
            self.log_test("Leave Family", False, str(e))
            return False

    # ==================== SPEED TRAP TESTS ====================
    
    def test_report_speed_trap(self):
        """Test reporting a speed trap"""
        try:
            headers = self.get_auth_headers()
            
            data = {
                "lat": 37.7749,
                "lon": -122.4194,
                "trap_type": "speed_camera",
                "description": "Test speed camera report"
            }
            response = requests.post(f"{self.base_url}/api/traps/report", json=data, headers=headers, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'trap_id' in response_data:
                    trap_id = response_data['trap_id']
                    self.created_trap_ids.append(trap_id)
                    details += f", Trap ID: {trap_id}, New: {response_data.get('new')}"
                else:
                    success = False
                    details += ", Missing trap_id in response"
            
            self.log_test("Report Speed Trap", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Report Speed Trap", False, str(e))
            return False, {}

    def test_get_nearby_traps(self):
        """Test getting nearby speed traps (public endpoint)"""
        try:
            params = {
                "lat": 37.7749,
                "lon": -122.4194,
                "radius_miles": 5
            }
            response = requests.get(f"{self.base_url}/api/traps/nearby", params=params, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'traps' in response_data and 'count' in response_data:
                    trap_count = response_data.get('count', 0)
                    details += f", Trap count: {trap_count}"
                    
                    # Check trap structure if any traps found
                    if trap_count > 0:
                        first_trap = response_data['traps'][0]
                        required_fields = ["id", "lat", "lon", "trap_type", "reporter_count"]
                        has_all_fields = all(field in first_trap for field in required_fields)
                        if not has_all_fields:
                            success = False
                            details += ", Missing fields in trap data"
                else:
                    success = False
                    details += ", Missing 'traps' or 'count' field in response"
            
            self.log_test("Get Nearby Traps", success, details)
            return success
        except Exception as e:
            self.log_test("Get Nearby Traps", False, str(e))
            return False

    def test_dismiss_trap(self):
        """Test dismissing a speed trap"""
        try:
            if not self.created_trap_ids:
                self.log_test("Dismiss Speed Trap", False, "No trap ID available for testing")
                return False
                
            headers = self.get_auth_headers()
            trap_id = self.created_trap_ids[0]
            
            response = requests.post(f"{self.base_url}/api/traps/{trap_id}/dismiss", headers=headers, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                details += f", Message: {response_data.get('message')}"
            
            self.log_test("Dismiss Speed Trap", success, details)
            return success
        except Exception as e:
            self.log_test("Dismiss Speed Trap", False, str(e))
            return False

    def test_trap_invalid_params(self):
        """Test speed trap endpoints with invalid parameters"""
        try:
            headers = self.get_auth_headers()
            
            # Test invalid coordinates for reporting
            data = {
                "lat": "invalid",
                "lon": "invalid", 
                "trap_type": "speed_camera"
            }
            response = requests.post(f"{self.base_url}/api/traps/report", json=data, headers=headers, timeout=10)
            
            # Should return 422 for invalid parameters
            success = response.status_code == 422
            details = f"Status: {response.status_code} (expected 422 for invalid params)"
            
            self.log_test("Speed Trap - Invalid Parameters", success, details)
            return success
        except Exception as e:
            self.log_test("Speed Trap - Invalid Parameters", False, str(e))
            return False
    
    def test_start_trip(self):
        """Test starting a new trip"""
        try:
            data = {
                "start_lat": 37.7749,
                "start_lon": -122.4194,
                "speed_unit": "mph"
            }
            response = requests.post(f"{self.base_url}/api/trips/start", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'trip_id' in response_data:
                    self.created_trip_ids.append(response_data['trip_id'])
                    details += f", Trip ID: {response_data['trip_id']}"
                    self.log_test("Start Trip", success, details)
                    return True, response_data['trip_id']
                else:
                    success = False
                    details += ", Missing trip_id in response"
            
            self.log_test("Start Trip", success, details)
            return False, None
        except Exception as e:
            self.log_test("Start Trip", False, str(e))
            return False, None

    def test_add_data_point(self, trip_id):
        """Test adding data point to trip"""
        try:
            data = {
                "trip_id": trip_id,
                "data_point": {
                    "timestamp": datetime.now().isoformat(),
                    "lat": 37.7750,
                    "lon": -122.4195,
                    "speed": 45.5,
                    "speed_limit": 35,
                    "is_speeding": True
                }
            }
            response = requests.post(f"{self.base_url}/api/trips/data-point", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                details += f", Response: {response_data}"
            
            self.log_test("Add Data Point", success, details)
            return success
        except Exception as e:
            self.log_test("Add Data Point", False, str(e))
            return False

    def test_end_trip(self, trip_id):
        """Test ending a trip"""
        try:
            data = {
                "trip_id": trip_id,
                "end_lat": 37.7751,
                "end_lon": -122.4196
            }
            response = requests.post(f"{self.base_url}/api/trips/end", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                details += f", Max Speed: {response_data.get('max_speed')}, Alerts: {response_data.get('total_alerts')}"
            
            self.log_test("End Trip", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("End Trip", False, str(e))
            return False, {}

    def test_get_trips(self):
        """Test getting trip list"""
        try:
            params = {"limit": 10}
            response = requests.get(f"{self.base_url}/api/trips", params=params, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                trip_count = len(response_data.get('trips', []))
                details += f", Trip count: {trip_count}, Total: {response_data.get('total', 0)}"
            
            self.log_test("Get Trips List", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Get Trips List", False, str(e))
            return False, {}

    def test_get_trip_detail(self, trip_id):
        """Test getting trip detail"""
        try:
            response = requests.get(f"{self.base_url}/api/trips/{trip_id}", timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                data_points = len(response_data.get('data_points', []))
                details += f", Data points: {data_points}, Max speed: {response_data.get('max_speed')}"
            
            self.log_test("Get Trip Detail", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Get Trip Detail", False, str(e))
            return False, {}

    def test_delete_trip(self, trip_id):
        """Test deleting a trip"""
        try:
            response = requests.delete(f"{self.base_url}/api/trips/{trip_id}", timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                details += f", Response: {response_data}"
            
            self.log_test("Delete Trip", success, details)
            return success
        except Exception as e:
            self.log_test("Delete Trip", False, str(e))
            return False

    def test_trip_workflow(self):
        """Test complete trip recording workflow"""
        print("\n🛣️  Testing Complete Trip Workflow...")
        
        # 1. Start a trip
        success, trip_id = self.test_start_trip()
        if not success or not trip_id:
            print("❌ Cannot continue workflow - trip creation failed")
            return False
        
        # 2. Add multiple data points
        print(f"📍 Adding data points to trip {trip_id}...")
        for i in range(3):
            success = self.test_add_data_point(trip_id)
            if success:
                print(f"   ✅ Data point {i+1} added")
            else:
                print(f"   ❌ Data point {i+1} failed")
            time.sleep(0.5)  # Small delay between data points
        
        # 3. End the trip
        success, trip_data = self.test_end_trip(trip_id)
        if not success:
            print("❌ Trip ending failed")
            return False
        
        # 4. Get trip list
        success, trips_data = self.test_get_trips()
        if not success:
            print("❌ Getting trip list failed")
            return False
        
        # 5. Get trip detail
        success, detail_data = self.test_get_trip_detail(trip_id)
        if not success:
            print("❌ Getting trip detail failed")
            return False
        
        print("✅ Complete trip workflow successful!")
        return True

    def test_trip_edge_cases(self):
        """Test trip API edge cases"""
        print("\n🔍 Testing Trip API Edge Cases...")
        
        # Test invalid trip ID for data point
        try:
            data = {
                "trip_id": "invalid_id",
                "data_point": {
                    "timestamp": datetime.now().isoformat(),
                    "lat": 37.7750,
                    "lon": -122.4195,
                    "speed": 45.5,
                    "speed_limit": 35,
                    "is_speeding": True
                }
            }
            response = requests.post(f"{self.base_url}/api/trips/data-point", json=data, timeout=10)
            success = response.status_code == 400
            self.log_test("Invalid Trip ID (Add Data Point)", success, f"Status: {response.status_code} (expected 400)")
        except Exception as e:
            self.log_test("Invalid Trip ID (Add Data Point)", False, str(e))
        
        # Test non-existent trip detail
        try:
            response = requests.get(f"{self.base_url}/api/trips/507f1f77bcf86cd799439011", timeout=10)
            success = response.status_code == 404
            self.log_test("Non-existent Trip Detail", success, f"Status: {response.status_code} (expected 404)")
        except Exception as e:
            self.log_test("Non-existent Trip Detail", False, str(e))

    def cleanup_trips(self):
        """Clean up any created trips"""
        if self.created_trip_ids:
            print(f"\n🧹 Cleaning up {len(self.created_trip_ids)} created trips...")
            for trip_id in self.created_trip_ids:
                try:
                    self.test_delete_trip(trip_id)
                except:
                    pass

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Speed Alert API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        try:
            # Test API availability first
            if not self.test_api_root():
                print("❌ API root endpoint failed - stopping tests")
                return False
            
            # Run authentication tests
            print("\n🔐 Testing Authentication...")
            if not self.test_user_registration():
                print("❌ User registration failed - stopping authenticated tests")
                return False
            
            self.test_user_login()
            self.test_get_user_profile()
            
            # Run all speed limit tests
            print("\n📡 Testing Speed Limit API...")
            self.test_speed_limit_valid_location()
            self.test_speed_limit_invalid_params()
            self.test_speed_limit_missing_params()
            self.test_speed_limit_remote_location()
            self.test_api_response_time()
            
            # Run gamification tests
            print("\n🏆 Testing Gamification Features...")
            self.test_get_user_stats()
            self.test_get_all_badges()
            
            # Run export reports tests
            print("\n📊 Testing Export Reports...")
            self.test_generate_report()
            
            # Run family mode tests
            print("\n👨‍👩‍👧‍👦 Testing Family Mode...")
            self.test_create_family()
            self.test_get_family()
            self.test_join_family_invalid_code()
            self.test_leave_family()
            
            # Run speed trap tests
            print("\n🚨 Testing Speed Trap Features...")
            self.test_get_nearby_traps()  # Test public endpoint first
            self.test_report_speed_trap()
            self.test_dismiss_trap()
            self.test_trap_invalid_params()
            
            # Run trip history tests
            print("\n🛣️  Testing Trip History API...")
            self.test_trip_workflow()
            self.test_trip_edge_cases()
            
            # Print summary
            print("=" * 60)
            print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
            success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
            print(f"📈 Success Rate: {success_rate:.1f}%")
            
            return self.tests_passed == self.tests_run
            
        except Exception as e:
            print(f"💥 Unexpected error during testing: {str(e)}")
            return False
        finally:
            # Always cleanup created trips
            self.cleanup_trips()

def main():
    tester = SpeedAlertAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open("/app/backend_test_results.json", "w") as f:
        json.dump({
            "summary": {
                "total_tests": tester.tests_run,
                "passed_tests": tester.tests_passed,
                "success_rate": (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0,
                "timestamp": datetime.now().isoformat()
            },
            "test_results": tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())