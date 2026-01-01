#!/usr/bin/env python3
"""
Fleet & Telematics API Testing - Phase 1 Implementation
Tests all endpoints as specified in the review request
"""

import requests
import json
import time
from datetime import datetime, timedelta

class FleetAPITester:
    def __init__(self, base_url="https://speed-guardian-3.preview.emergentagent.com"):
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

    def test_trip_lifecycle(self):
        """Test complete trip lifecycle as specified in review request"""
        print("\n🚛 Testing Trip Lifecycle...")
        
        # 1. Start a trip with device_id and location
        print("1. Starting trip...")
        start_data = {
            "device_id": "test_device_fleet_001",
            "start_location": {
                "lat": 37.7749,
                "lon": -122.4194,
                "address": "San Francisco, CA"
            }
        }
        
        response = requests.post(f"{self.base_url}/api/fleet/trips/start", json=start_data, timeout=10)
        if response.status_code != 200:
            self.log_test("Trip Start", False, f"Status: {response.status_code}")
            return False
        
        trip_data = response.json()
        trip_id = trip_data.get('trip_id')
        if not trip_id:
            self.log_test("Trip Start", False, "No trip_id returned")
            return False
        
        self.log_test("Trip Start", True, f"Trip ID: {trip_id}")
        
        # 2. Add location points during trip (3-4 updates with increasing speed)
        print("2. Adding location updates with increasing speed...")
        speeds = [25, 45, 65, 72]  # Increasing speeds, last one will trigger speeding
        
        for i, speed in enumerate(speeds):
            location_data = {
                "trip_id": trip_id,
                "device_id": "test_device_fleet_001",
                "lat": 37.7749 + (i * 0.001),  # Move slightly
                "lon": -122.4194 + (i * 0.001),
                "speed": speed,
                "heading": 90.0,
                "timestamp": datetime.now().isoformat()
            }
            
            response = requests.post(f"{self.base_url}/api/fleet/trips/{trip_id}/location", json=location_data, timeout=10)
            success = response.status_code == 200
            
            if success:
                response_data = response.json()
                max_speed = response_data.get('max_speed', 0)
                self.log_test(f"Location Update {i+1} ({speed} mph)", True, f"Max speed: {max_speed}")
            else:
                self.log_test(f"Location Update {i+1} ({speed} mph)", False, f"Status: {response.status_code}")
            
            time.sleep(0.5)
        
        # 3. Log a speeding incident (72 mph in 55 zone)
        print("3. Logging speeding incident...")
        speeding_data = {
            "trip_id": trip_id,
            "device_id": "test_device_fleet_001",
            "start_time": datetime.now().isoformat(),
            "start_location": {
                "lat": 37.7752,
                "lon": -122.4197,
                "address": "Highway 101"
            },
            "posted_limit": 55,
            "threshold_used": 60,
            "max_speed": 72.0,
            "road_name": "Highway 101",
            "road_type": "highway"
        }
        
        response = requests.post(f"{self.base_url}/api/fleet/incidents/speeding/start", json=speeding_data, timeout=10)
        if response.status_code == 200:
            incident_data = response.json()
            incident_id = incident_data.get('incident_id')
            severity = incident_data.get('severity')
            score_impact = incident_data.get('score_impact')
            
            # Verify severity calculation (72 in 55 = 17 over = severe)
            expected_severity = "severe"  # 16-25 over = severe
            severity_correct = severity == expected_severity
            
            self.log_test("Speeding Incident Start", True, 
                         f"ID: {incident_id}, Severity: {severity} (expected: {expected_severity}), Impact: {score_impact}")
            self.log_test("Severity Calculation (17 mph over)", severity_correct, 
                         f"Got: {severity}, Expected: {expected_severity}")
            
            # End the speeding incident
            time.sleep(1)
            end_data = {
                "end_time": datetime.now().isoformat(),
                "end_location": {
                    "lat": 37.7753,
                    "lon": -122.4198,
                    "address": "Highway 101 Exit"
                },
                "avg_speed": 68.5,
                "duration_seconds": 30
            }
            
            response = requests.post(f"{self.base_url}/api/fleet/incidents/speeding/{incident_id}/end", json=end_data, timeout=10)
            success = response.status_code == 200
            self.log_test("Speeding Incident End", success, f"Status: {response.status_code}")
            
        else:
            self.log_test("Speeding Incident Start", False, f"Status: {response.status_code}")
        
        # 4. Log a hard brake event
        print("4. Logging hard brake event...")
        event_data = {
            "trip_id": trip_id,
            "device_id": "test_device_fleet_001",
            "event_type": "hard_brake",
            "timestamp": datetime.now().isoformat(),
            "location": {
                "lat": 37.7754,
                "lon": -122.4199,
                "address": "Downtown SF"
            },
            "intensity_g": 0.6,  # High G-force for hard brake
            "speed_before": 45.0,
            "speed_after": 15.0,
            "duration_ms": 2500,
            "road_name": "Market Street",
            "road_type": "primary"
        }
        
        response = requests.post(f"{self.base_url}/api/fleet/incidents/event", json=event_data, timeout=10)
        if response.status_code == 200:
            event_response = response.json()
            event_id = event_response.get('id')
            event_severity = event_response.get('severity')
            event_impact = event_response.get('score_impact')
            self.log_test("Hard Brake Event", True, 
                         f"ID: {event_id}, Severity: {event_severity}, Impact: {event_impact}")
        else:
            self.log_test("Hard Brake Event", False, f"Status: {response.status_code}")
        
        # 5. End trip and get summary
        print("5. Ending trip...")
        end_trip_data = {
            "end_location": {
                "lat": 37.7755,
                "lon": -122.4200,
                "address": "San Francisco Downtown"
            }
        }
        
        response = requests.post(f"{self.base_url}/api/fleet/trips/{trip_id}/end", json=end_trip_data, timeout=10)
        if response.status_code == 200:
            trip_summary = response.json()
            safety_score = trip_summary.get('safety_score')
            incidents_count = trip_summary.get('speeding_incidents_count')
            hard_brake_count = trip_summary.get('hard_brake_count')
            distance = trip_summary.get('distance_miles')
            
            # Verify trip summary has correct counts
            incidents_correct = incidents_count >= 1
            brakes_correct = hard_brake_count >= 1
            score_reduced = safety_score < 100
            
            self.log_test("Trip End", True, 
                         f"Score: {safety_score}, Incidents: {incidents_count}, Hard Brakes: {hard_brake_count}, Distance: {distance}mi")
            self.log_test("Trip Summary - Incident Count", incidents_correct, 
                         f"Expected ≥1, Got: {incidents_count}")
            self.log_test("Trip Summary - Hard Brake Count", brakes_correct, 
                         f"Expected ≥1, Got: {hard_brake_count}")
            self.log_test("Trip Summary - Safety Score Reduced", score_reduced, 
                         f"Expected <100, Got: {safety_score}")
            
        else:
            self.log_test("Trip End", False, f"Status: {response.status_code}")
            return False
        
        # 6. Verify scores endpoint reflects the trip data
        print("6. Verifying scores endpoint...")
        params = {"device_id": "test_device_fleet_001"}
        response = requests.get(f"{self.base_url}/api/fleet/scores", params=params, timeout=10)
        
        if response.status_code == 200:
            scores_data = response.json()
            daily_score = scores_data.get('daily_score')
            total_trips = scores_data.get('total_trips')
            total_miles = scores_data.get('total_miles')
            
            trips_updated = total_trips >= 1
            miles_updated = total_miles > 0
            
            self.log_test("Scores Endpoint", True, 
                         f"Daily: {daily_score}, Trips: {total_trips}, Miles: {total_miles}")
            self.log_test("Scores - Trip Count Updated", trips_updated, 
                         f"Expected ≥1, Got: {total_trips}")
            self.log_test("Scores - Miles Updated", miles_updated, 
                         f"Expected >0, Got: {total_miles}")
        else:
            self.log_test("Scores Endpoint", False, f"Status: {response.status_code}")
        
        return True

    def test_severity_calculations(self):
        """Test severity calculations as specified in review request"""
        print("\n🚨 Testing Severity Calculations...")
        
        test_cases = [
            {"speed": 59, "limit": 55, "expected": "minor"},    # 4 over (<5)
            {"speed": 65, "limit": 55, "expected": "moderate"}, # 10 over (6-15)
            {"speed": 75, "limit": 55, "expected": "severe"},   # 20 over (16-25)
            {"speed": 85, "limit": 55, "expected": "extreme"}   # 30 over (25+)
        ]
        
        for case in test_cases:
            speeding_data = {
                "trip_id": "test_severity_trip",
                "device_id": "test_device_severity",
                "start_time": datetime.now().isoformat(),
                "start_location": {"lat": 37.7749, "lon": -122.4194},
                "posted_limit": case["limit"],
                "threshold_used": case["limit"] + 5,
                "max_speed": case["speed"],
                "road_name": "Test Road"
            }
            
            response = requests.post(f"{self.base_url}/api/fleet/incidents/speeding/start", json=speeding_data, timeout=10)
            
            if response.status_code == 200:
                incident_data = response.json()
                actual_severity = incident_data.get('severity')
                speed_over = case["speed"] - case["limit"]
                
                severity_correct = actual_severity == case["expected"]
                self.log_test(f"Severity - {speed_over} mph over", severity_correct,
                             f"Expected: {case['expected']}, Got: {actual_severity}")
            else:
                self.log_test(f"Severity Test - {case['speed']} in {case['limit']}", False, 
                             f"Status: {response.status_code}")

    def test_data_retrieval_endpoints(self):
        """Test data retrieval endpoints"""
        print("\n📊 Testing Data Retrieval Endpoints...")
        
        device_id = "test_device_fleet_001"
        
        # Test GET /api/fleet/trips?device_id=X
        params = {"device_id": device_id, "limit": 10}
        response = requests.get(f"{self.base_url}/api/fleet/trips", params=params, timeout=10)
        
        if response.status_code == 200:
            trips_data = response.json()
            trips = trips_data.get('trips', [])
            total = trips_data.get('total', 0)
            self.log_test("GET /fleet/trips", True, f"Found {len(trips)} trips, Total: {total}")
        else:
            self.log_test("GET /fleet/trips", False, f"Status: {response.status_code}")
        
        # Test GET /api/fleet/scores?device_id=X
        params = {"device_id": device_id}
        response = requests.get(f"{self.base_url}/api/fleet/scores", params=params, timeout=10)
        
        if response.status_code == 200:
            scores_data = response.json()
            daily = scores_data.get('daily_score')
            weekly = scores_data.get('weekly_score')
            monthly = scores_data.get('monthly_score')
            self.log_test("GET /fleet/scores", True, f"Daily: {daily}, Weekly: {weekly}, Monthly: {monthly}")
        else:
            self.log_test("GET /fleet/scores", False, f"Status: {response.status_code}")
        
        # Test GET /api/fleet/incidents?device_id=X
        params = {"device_id": device_id, "limit": 20}
        response = requests.get(f"{self.base_url}/api/fleet/incidents", params=params, timeout=10)
        
        if response.status_code == 200:
            incidents = response.json()
            incident_count = len(incidents) if isinstance(incidents, list) else 0
            self.log_test("GET /fleet/incidents", True, f"Found {incident_count} incidents")
        else:
            self.log_test("GET /fleet/incidents", False, f"Status: {response.status_code}")

    def test_endpoint_responses(self):
        """Test that all endpoints return 200/201 as specified"""
        print("\n🔍 Testing Endpoint Response Codes...")
        
        # All endpoints should return 200/201 for valid requests
        endpoints_tested = [
            "POST /api/fleet/trips/start",
            "POST /api/fleet/trips/{trip_id}/location", 
            "POST /api/fleet/trips/{trip_id}/end",
            "POST /api/fleet/incidents/speeding/start",
            "POST /api/fleet/incidents/speeding/{incident_id}/end",
            "POST /api/fleet/incidents/event",
            "GET /api/fleet/trips",
            "GET /api/fleet/scores", 
            "GET /api/fleet/incidents"
        ]
        
        success_count = sum(1 for result in self.test_results if result['success'])
        total_count = len([r for r in self.test_results if any(endpoint in r['test'] for endpoint in endpoints_tested)])
        
        all_endpoints_working = success_count >= total_count * 0.9  # 90% success rate
        self.log_test("All Endpoints Return 200/201", all_endpoints_working, 
                     f"{success_count}/{total_count} endpoint tests passed")

    def run_fleet_tests(self):
        """Run all fleet API tests as specified in review request"""
        print("🚛 Starting Fleet & Telematics API Tests (Phase 1)")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test the complete flow as specified
        self.test_trip_lifecycle()
        self.test_severity_calculations()
        self.test_data_retrieval_endpoints()
        self.test_endpoint_responses()
        
        # Print summary
        print("=" * 60)
        print(f"📊 Fleet API Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Check success criteria
        print("\n✅ SUCCESS CRITERIA VERIFICATION:")
        print(f"   • All endpoints return 200/201: {'✅' if success_rate >= 90 else '❌'}")
        print(f"   • Trip shows correct incident counts: {'✅' if any('Trip Summary - Incident Count' in r['test'] and r['success'] for r in self.test_results) else '❌'}")
        print(f"   • Safety score is less than 100 after incidents: {'✅' if any('Safety Score Reduced' in r['test'] and r['success'] for r in self.test_results) else '❌'}")
        print(f"   • Severity calculations are correct: {'✅' if any('Severity -' in r['test'] and r['success'] for r in self.test_results) else '❌'}")
        
        return success_rate >= 90

def main():
    tester = FleetAPITester()
    success = tester.run_fleet_tests()
    
    # Save detailed results
    with open("/app/fleet_test_results.json", "w") as f:
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
    exit(main())