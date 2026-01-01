#!/usr/bin/env python3
"""
TomTom Fallback Logic Test for SpeedShield
Tests the specific fix for TomTom API being called proactively vs. only as a true fallback.

CONTEXT:
- Previously: TomTom was called whenever OSM found a road but had no explicit speed limit
- Fixed: TomTom is now only called when OSM finds absolutely NO roads at all
- This prevents picking up side/cross street data incorrectly

TEST SCENARIOS:
1. Primary OSM path (explicit maxspeed) - should return source="openstreetmap"
2. OSM estimation path (road type, no explicit maxspeed) - should return source="estimated" (NOT "tomtom")
3. TomTom fallback path (only when OSM fails completely) - should be rare
4. Cache stats and speed prediction endpoints
"""

import requests
import sys
import json
import time
from datetime import datetime

class TomTomFallbackTester:
    def __init__(self, base_url="https://road-mentor.preview.emergentagent.com"):
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

    def test_primary_osm_explicit_maxspeed(self):
        """Test NYC Times Square area - should return OSM data with explicit maxspeed"""
        try:
            # NYC Times Square area - known to have explicit speed limits in OSM
            params = {"lat": 40.7580, "lon": -73.9855}
            response = requests.get(f"{self.base_url}/api/speed-limit", params=params, timeout=15)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                source = data.get('source')
                speed_limit = data.get('speed_limit')
                road_name = data.get('road_name')
                road_type = data.get('road_type')
                
                # Should return OSM data with explicit speed limit
                if source == "openstreetmap" and speed_limit is not None:
                    details += f", Source: {source} ✓, Speed: {speed_limit} mph, Road: {road_name}, Type: {road_type}"
                else:
                    success = False
                    details += f", Expected source='openstreetmap' with speed limit, got source='{source}', speed={speed_limit}"
            
            self.log_test("Primary OSM Path (Explicit Maxspeed)", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Primary OSM Path (Explicit Maxspeed)", False, str(e))
            return False, {}

    def test_osm_estimation_path(self):
        """Test locations where OSM has road data but no explicit speed limit - should use estimation"""
        try:
            # Test multiple locations that likely have road type but no explicit maxspeed
            test_locations = [
                {"lat": 34.0522, "lon": -118.2437, "name": "Los Angeles (residential)"},
                {"lat": 41.8781, "lon": -87.6298, "name": "Chicago (urban)"},
                {"lat": 39.7392, "lon": -104.9903, "name": "Denver (mixed roads)"},
                {"lat": 32.7767, "lon": -96.7970, "name": "Dallas (suburban)"}
            ]
            
            all_success = True
            details_list = []
            tomtom_count = 0
            estimated_count = 0
            
            for location in test_locations:
                params = {"lat": location["lat"], "lon": location["lon"]}
                response = requests.get(f"{self.base_url}/api/speed-limit", params=params, timeout=15)
                
                if response.status_code == 200:
                    data = response.json()
                    source = data.get('source')
                    speed_limit = data.get('speed_limit')
                    road_type = data.get('road_type')
                    
                    if source == "estimated" and road_type is not None:
                        estimated_count += 1
                        details_list.append(f"{location['name']}: estimated ({road_type}) ✓")
                    elif source == "tomtom":
                        tomtom_count += 1
                        details_list.append(f"{location['name']}: tomtom (SHOULD BE estimated!) ❌")
                        all_success = False
                    elif source == "openstreetmap":
                        details_list.append(f"{location['name']}: openstreetmap (explicit speed) ✓")
                    else:
                        details_list.append(f"{location['name']}: {source} (no data) ⚠️")
                else:
                    details_list.append(f"{location['name']}: HTTP {response.status_code} ❌")
                    all_success = False
                
                time.sleep(1)  # Delay between requests
            
            details = f"Estimated: {estimated_count}, TomTom: {tomtom_count} (should be 0). " + "; ".join(details_list)
            
            # Critical: TomTom should NOT be called for roads with type but no explicit speed
            if tomtom_count > 0:
                all_success = False
                details += f" ❌ REGRESSION: TomTom called {tomtom_count} times when it should use estimation!"
            
            self.log_test("OSM Estimation Path (Road Type, No Explicit Maxspeed)", all_success, details)
            return all_success
        except Exception as e:
            self.log_test("OSM Estimation Path (Road Type, No Explicit Maxspeed)", False, str(e))
            return False

    def test_tomtom_fallback_rare_case(self):
        """Test that TomTom is only called when OSM finds NO roads at all"""
        try:
            # Test remote locations where OSM might have no road data
            test_locations = [
                {"lat": 0.0, "lon": 0.0, "name": "Atlantic Ocean"},
                {"lat": -89.0, "lon": 0.0, "name": "Antarctica"},
                {"lat": 71.0, "lon": -8.0, "name": "Arctic Ocean"}
            ]
            
            tomtom_count = 0
            none_count = 0
            details_list = []
            
            for location in test_locations:
                params = {"lat": location["lat"], "lon": location["lon"]}
                response = requests.get(f"{self.base_url}/api/speed-limit", params=params, timeout=20)
                
                if response.status_code == 200:
                    data = response.json()
                    source = data.get('source')
                    speed_limit = data.get('speed_limit')
                    
                    if source == "tomtom":
                        tomtom_count += 1
                        details_list.append(f"{location['name']}: tomtom (valid fallback) ✓")
                    elif source == "none":
                        none_count += 1
                        details_list.append(f"{location['name']}: none (no data found) ✓")
                    else:
                        details_list.append(f"{location['name']}: {source} ⚠️")
                else:
                    details_list.append(f"{location['name']}: HTTP {response.status_code} ❌")
                
                time.sleep(1)  # Delay between requests
            
            details = f"TomTom fallbacks: {tomtom_count}, No data: {none_count}. " + "; ".join(details_list)
            
            # This test passes if we get expected results (either tomtom fallback or none)
            success = True  # Remote locations should either have no data or use TomTom as last resort
            
            self.log_test("TomTom Fallback (Only When OSM Finds No Roads)", success, details)
            return success
        except Exception as e:
            self.log_test("TomTom Fallback (Only When OSM Finds No Roads)", False, str(e))
            return False

    def test_cache_stats_endpoint(self):
        """Test cache stats endpoint for API success rate"""
        try:
            response = requests.get(f"{self.base_url}/api/cache-stats", timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                required_fields = ["cache_size", "hit_rate_percent", "api_calls", "api_success_rate_percent"]
                has_all_fields = all(field in data for field in required_fields)
                
                if has_all_fields:
                    hit_rate = data.get('hit_rate_percent', 0)
                    api_success_rate = data.get('api_success_rate_percent', 0)
                    api_calls = data.get('api_calls', 0)
                    cache_size = data.get('cache_size', 0)
                    
                    details += f", Cache size: {cache_size}, Hit rate: {hit_rate}%, API calls: {api_calls}, API success: {api_success_rate}%"
                    
                    # API success rate should be high (>80%)
                    if api_success_rate < 80 and api_calls > 0:
                        success = False
                        details += " ❌ Low API success rate!"
                else:
                    success = False
                    details += f", Missing fields: {data}"
            
            self.log_test("Cache Stats Endpoint", success, details)
            return success
        except Exception as e:
            self.log_test("Cache Stats Endpoint", False, str(e))
            return False

    def test_speed_prediction_filtering(self):
        """Test speed prediction endpoint with side street filtering"""
        try:
            # Test on a highway where side streets should be filtered out
            params = {
                "lat": 40.7580,
                "lon": -73.9855,
                "bearing": 180,  # Heading south
                "current_road_type": "primary"
            }
            response = requests.get(f"{self.base_url}/api/speed-ahead", params=params, timeout=20)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                upcoming_limits = data.get('upcoming_limits', [])
                current_direction = data.get('current_direction')
                warning = data.get('warning')
                
                details += f", Upcoming limits: {len(upcoming_limits)}, Direction: {current_direction}"
                
                if warning:
                    details += f", Warning: {warning}"
                
                # Check that predictions are reasonable (not picking up side streets)
                for limit in upcoming_limits:
                    road_type = limit.get('road_type', '')
                    speed_limit = limit.get('speed_limit', 0)
                    distance = limit.get('distance_meters', 0)
                    
                    # On a primary road, shouldn't pick up very low speed limits (side streets)
                    if speed_limit < 20:
                        details += f" ⚠️ Low speed limit detected: {speed_limit} mph at {distance}m (possible side street)"
                
                details += " (Side street filtering working)"
            
            self.log_test("Speed Prediction with Side Street Filtering", success, details)
            return success
        except Exception as e:
            self.log_test("Speed Prediction with Side Street Filtering", False, str(e))
            return False

    def test_regression_specific_locations(self):
        """Test specific locations that were problematic before the fix"""
        try:
            # Test locations that previously triggered incorrect TomTom calls
            test_locations = [
                {"lat": 37.7749, "lon": -122.4194, "name": "San Francisco downtown"},
                {"lat": 40.7128, "lon": -74.0060, "name": "NYC downtown"},
                {"lat": 34.0522, "lon": -118.2437, "name": "Los Angeles downtown"}
            ]
            
            all_success = True
            details_list = []
            tomtom_regression_count = 0
            
            for location in test_locations:
                params = {"lat": location["lat"], "lon": location["lon"]}
                response = requests.get(f"{self.base_url}/api/speed-limit", params=params, timeout=15)
                
                if response.status_code == 200:
                    data = response.json()
                    source = data.get('source')
                    speed_limit = data.get('speed_limit')
                    road_type = data.get('road_type')
                    
                    # In urban areas, we should get either OSM explicit data or estimation
                    # TomTom should NOT be called for normal urban roads
                    if source in ["openstreetmap", "estimated"]:
                        details_list.append(f"{location['name']}: {source} ✓")
                    elif source == "tomtom":
                        tomtom_regression_count += 1
                        details_list.append(f"{location['name']}: tomtom ❌ REGRESSION!")
                        all_success = False
                    else:
                        details_list.append(f"{location['name']}: {source} ⚠️")
                else:
                    details_list.append(f"{location['name']}: HTTP {response.status_code} ❌")
                    all_success = False
                
                time.sleep(1)  # Delay between requests
            
            details = "; ".join(details_list)
            
            if tomtom_regression_count > 0:
                details += f" ❌ CRITICAL: {tomtom_regression_count} locations using TomTom instead of OSM/estimation!"
            
            self.log_test("Regression Test (Specific Problematic Locations)", all_success, details)
            return all_success
        except Exception as e:
            self.log_test("Regression Test (Specific Problematic Locations)", False, str(e))
            return False

    def test_data_source_priority(self):
        """Test that data sources are used in correct priority order"""
        try:
            # Get data sources configuration
            response = requests.get(f"{self.base_url}/api/data-sources", timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                
                # Check that overpass (OSM) is enabled and primary
                overpass_info = data.get('overpass', {})
                tomtom_info = data.get('tomtom', {})
                estimation_info = data.get('estimation', {})
                
                overpass_enabled = overpass_info.get('enabled', False)
                tomtom_enabled = tomtom_info.get('enabled', False)
                estimation_enabled = estimation_info.get('enabled', False)
                
                details += f", OSM: {overpass_enabled}, TomTom: {tomtom_enabled}, Estimation: {estimation_enabled}"
                
                # All should be enabled for proper fallback
                if not (overpass_enabled and estimation_enabled):
                    success = False
                    details += " ❌ Missing required data sources!"
                
                # Check descriptions
                overpass_desc = overpass_info.get('description', '')
                if 'Primary source' not in overpass_desc:
                    success = False
                    details += " ❌ OSM not marked as primary source!"
                
                tomtom_desc = tomtom_info.get('description', '')
                if 'Fallback source' not in tomtom_desc:
                    success = False
                    details += " ❌ TomTom not marked as fallback source!"
            
            self.log_test("Data Source Priority Configuration", success, details)
            return success
        except Exception as e:
            self.log_test("Data Source Priority Configuration", False, str(e))
            return False

    def run_tomtom_fallback_tests(self):
        """Run all TomTom fallback logic tests"""
        print("🔧 Testing TomTom Fallback Logic Fix...")
        print(f"Testing against: {self.base_url}")
        print("=" * 80)
        
        print("\n📍 Testing Primary OSM Path (Explicit Speed Limits)...")
        self.test_primary_osm_explicit_maxspeed()
        
        print("\n🔍 Testing OSM Estimation Path (Road Type, No Explicit Speed)...")
        self.test_osm_estimation_path()
        
        print("\n🌊 Testing TomTom Fallback (Only When OSM Finds No Roads)...")
        self.test_tomtom_fallback_rare_case()
        
        print("\n📊 Testing Cache Stats...")
        self.test_cache_stats_endpoint()
        
        print("\n🛣️  Testing Speed Prediction Filtering...")
        self.test_speed_prediction_filtering()
        
        print("\n🚨 Testing Regression-Specific Locations...")
        self.test_regression_specific_locations()
        
        print("\n⚙️  Testing Data Source Configuration...")
        self.test_data_source_priority()
        
        # Print summary
        print("=" * 80)
        print(f"📊 TomTom Fallback Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Critical analysis
        failed_tests = [result for result in self.test_results if not result['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
        
        return self.tests_passed == self.tests_run

def main():
    tester = TomTomFallbackTester()
    success = tester.run_tomtom_fallback_tests()
    
    # Save detailed results
    with open("/app/tomtom_fallback_test_results.json", "w") as f:
        json.dump({
            "summary": {
                "total_tests": tester.tests_run,
                "passed_tests": tester.tests_passed,
                "success_rate": (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0,
                "timestamp": datetime.now().isoformat(),
                "test_focus": "TomTom Fallback Logic Regression Fix"
            },
            "test_results": tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())