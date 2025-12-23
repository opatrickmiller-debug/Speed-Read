#!/usr/bin/env python3
"""
Backend API Testing for Speed Alert App
Tests the /api/speed-limit endpoint functionality
"""

import requests
import sys
import json
from datetime import datetime

class SpeedAlertAPITester:
    def __init__(self, base_url="https://pace-guardian.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Speed Alert API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test API availability first
        if not self.test_api_root():
            print("❌ API root endpoint failed - stopping tests")
            return False
        
        # Run all speed limit tests
        self.test_speed_limit_valid_location()
        self.test_speed_limit_invalid_params()
        self.test_speed_limit_missing_params()
        self.test_speed_limit_remote_location()
        self.test_api_response_time()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

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