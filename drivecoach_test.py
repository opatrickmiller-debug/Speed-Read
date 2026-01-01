#!/usr/bin/env python3
"""
DriveCoach API Testing - Referral System & Instructor Portal
Tests the newly implemented features for DriveCoach:
1. Referral System API
2. Instructor Portal API
"""

import requests
import sys
import json
import time
from datetime import datetime, timedelta

class DriveCoachAPITester:
    def __init__(self, base_url="https://road-mentor.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_referral_codes = []
        self.instructor_token = None
        self.instructor_id = None
        self.student_ids = []

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

    def get_instructor_headers(self):
        """Get authorization headers for instructor"""
        if self.instructor_token:
            return {"Authorization": f"Bearer {self.instructor_token}", "Content-Type": "application/json"}
        return {"Content-Type": "application/json"}

    # ==================== REFERRAL SYSTEM TESTS ====================
    
    def test_create_referral_code_user_a(self):
        """Test creating referral code for user A"""
        try:
            timestamp = int(time.time())
            self.device_a = f"device_user_a_{timestamp}"
            data = {
                "device_id": self.device_a,
                "email": f"user_a_{timestamp}@example.com"
            }
            response = requests.post(f"{self.base_url}/api/referral/code", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'referral_code' in response_data and 'referral_link' in response_data:
                    referral_code = response_data['referral_code']
                    self.created_referral_codes.append({
                        'device_id': self.device_a,
                        'code': referral_code
                    })
                    details += f", Code: {referral_code}, Link: {response_data.get('referral_link')}"
                else:
                    success = False
                    details += ", Missing referral_code or referral_link in response"
            
            self.log_test("Create Referral Code - User A", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Create Referral Code - User A", False, str(e))
            return False, {}

    def test_create_referral_code_user_b(self):
        """Test creating referral code for user B"""
        try:
            timestamp = int(time.time())
            self.device_b = f"device_user_b_{timestamp}"
            data = {
                "device_id": self.device_b,
                "email": f"user_b_{timestamp}@example.com"
            }
            response = requests.post(f"{self.base_url}/api/referral/code", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'referral_code' in response_data and 'referral_link' in response_data:
                    referral_code = response_data['referral_code']
                    self.created_referral_codes.append({
                        'device_id': self.device_b,
                        'code': referral_code
                    })
                    details += f", Code: {referral_code}, Link: {response_data.get('referral_link')}"
                else:
                    success = False
                    details += ", Missing referral_code or referral_link in response"
            
            self.log_test("Create Referral Code - User B", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Create Referral Code - User B", False, str(e))
            return False, {}

    def test_apply_referral_code(self):
        """Test user B applying user A's referral code"""
        try:
            # Find user A's referral code
            user_a_code = None
            for ref in self.created_referral_codes:
                if ref['device_id'] == self.device_a:
                    user_a_code = ref['code']
                    break
            
            if not user_a_code:
                self.log_test("Apply Referral Code", False, "No referral code found for user A")
                return False
            
            timestamp = int(time.time())
            data = {
                "device_id": self.device_b,
                "referral_code": user_a_code,
                "email": f"user_b_{timestamp}@example.com"
            }
            response = requests.post(f"{self.base_url}/api/referral/apply", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if response_data.get('success') and 'reward' in response_data:
                    reward = response_data['reward']
                    details += f", Success: {response_data.get('success')}, Reward Type: {reward.get('type')}, Value: {reward.get('value')}"
                    details += f", Message: {response_data.get('message')}"
                else:
                    success = False
                    details += f", Unexpected response: {response_data}"
            
            self.log_test("Apply Referral Code", success, details)
            return success
        except Exception as e:
            self.log_test("Apply Referral Code", False, str(e))
            return False

    def test_referral_stats_user_a(self):
        """Test getting referral statistics for user A (referrer)"""
        try:
            params = {"device_id": self.device_a}
            response = requests.get(f"{self.base_url}/api/referral/stats", params=params, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                required_fields = ["device_id", "referral_code", "total_referrals", "completed_referrals", "total_rewards_earned"]
                has_all_fields = all(field in response_data for field in required_fields)
                
                if has_all_fields:
                    total_refs = response_data.get('total_referrals')
                    completed_refs = response_data.get('completed_referrals')
                    rewards = response_data.get('total_rewards_earned')
                    details += f", Total: {total_refs}, Completed: {completed_refs}, Rewards: {rewards}"
                    
                    # Should have at least 1 completed referral after applying code
                    if completed_refs >= 1:
                        details += " (Referral system working correctly)"
                    else:
                        success = False
                        details += " (Expected at least 1 completed referral)"
                else:
                    success = False
                    details += f", Missing fields in response: {response_data}"
            
            self.log_test("Referral Stats - User A", success, details)
            return success
        except Exception as e:
            self.log_test("Referral Stats - User A", False, str(e))
            return False

    def test_referral_rewards_user_a(self):
        """Test getting rewards for user A (referrer)"""
        try:
            params = {"device_id": self.device_a}
            response = requests.get(f"{self.base_url}/api/referral/rewards", params=params, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if isinstance(response_data, list):
                    reward_count = len(response_data)
                    details += f", Reward count: {reward_count}"
                    
                    # Should have at least 1 reward after successful referral
                    if reward_count >= 1:
                        first_reward = response_data[0]
                        reward_type = first_reward.get('reward_type')
                        reward_value = first_reward.get('reward_value')
                        source = first_reward.get('source')
                        details += f", First reward: {reward_type} ({reward_value}) from {source}"
                    else:
                        success = False
                        details += " (Expected at least 1 reward)"
                else:
                    success = False
                    details += f", Expected list, got: {type(response_data)}"
            
            self.log_test("Referral Rewards - User A", success, details)
            return success
        except Exception as e:
            self.log_test("Referral Rewards - User A", False, str(e))
            return False

    def test_referral_rewards_user_b(self):
        """Test getting rewards for user B (referee)"""
        try:
            params = {"device_id": self.device_b}
            response = requests.get(f"{self.base_url}/api/referral/rewards", params=params, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if isinstance(response_data, list):
                    reward_count = len(response_data)
                    details += f", Reward count: {reward_count}"
                    
                    # Should have at least 1 reward after successful referral
                    if reward_count >= 1:
                        first_reward = response_data[0]
                        reward_type = first_reward.get('reward_type')
                        reward_value = first_reward.get('reward_value')
                        source = first_reward.get('source')
                        details += f", First reward: {reward_type} ({reward_value}) from {source}"
                    else:
                        success = False
                        details += " (Expected at least 1 reward)"
                else:
                    success = False
                    details += f", Expected list, got: {type(response_data)}"
            
            self.log_test("Referral Rewards - User B", success, details)
            return success
        except Exception as e:
            self.log_test("Referral Rewards - User B", False, str(e))
            return False

    def test_validate_referral_code(self):
        """Test validating a referral code"""
        try:
            # Use user A's referral code
            user_a_code = None
            for ref in self.created_referral_codes:
                if ref['device_id'] == self.device_a:
                    user_a_code = ref['code']
                    break
            
            if not user_a_code:
                self.log_test("Validate Referral Code", False, "No referral code found for user A")
                return False
            
            response = requests.get(f"{self.base_url}/api/referral/validate/{user_a_code}", timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'valid' in response_data and 'message' in response_data:
                    is_valid = response_data.get('valid')
                    message = response_data.get('message')
                    details += f", Valid: {is_valid}, Message: {message}"
                    
                    if not is_valid:
                        success = False
                        details += " (Expected valid=True)"
                else:
                    success = False
                    details += f", Missing fields in response: {response_data}"
            
            self.log_test("Validate Referral Code", success, details)
            return success
        except Exception as e:
            self.log_test("Validate Referral Code", False, str(e))
            return False

    def test_validate_invalid_referral_code(self):
        """Test validating an invalid referral code"""
        try:
            response = requests.get(f"{self.base_url}/api/referral/validate/INVALID123", timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'valid' in response_data and 'message' in response_data:
                    is_valid = response_data.get('valid')
                    message = response_data.get('message')
                    details += f", Valid: {is_valid}, Message: {message}"
                    
                    if is_valid:
                        success = False
                        details += " (Expected valid=False for invalid code)"
                else:
                    success = False
                    details += f", Missing fields in response: {response_data}"
            
            self.log_test("Validate Invalid Referral Code", success, details)
            return success
        except Exception as e:
            self.log_test("Validate Invalid Referral Code", False, str(e))
            return False

    # ==================== INSTRUCTOR PORTAL TESTS ====================
    
    def test_instructor_register(self):
        """Test registering a new instructor"""
        try:
            timestamp = int(time.time())
            self.instructor_email = f"instructor_{timestamp}@drivingschool.com"
            data = {
                "email": self.instructor_email,
                "password": "InstructorPass123!",
                "name": "John Smith",
                "phone": "+1-555-0123",
                "school_name": "Elite Driving School",
                "license_number": "CDL123456"
            }
            response = requests.post(f"{self.base_url}/api/instructor/register", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'token' in response_data and 'instructor' in response_data:
                    self.instructor_token = response_data['token']
                    instructor = response_data['instructor']
                    self.instructor_id = instructor.get('id')
                    details += f", Instructor ID: {self.instructor_id}, Name: {instructor.get('name')}"
                    details += f", School: {instructor.get('school_name')}"
                else:
                    success = False
                    details += ", Missing token or instructor in response"
            
            self.log_test("Instructor Register", success, details)
            return success
        except Exception as e:
            self.log_test("Instructor Register", False, str(e))
            return False

    def test_instructor_login(self):
        """Test instructor login"""
        try:
            # Use the same email from registration (stored in class)
            if not hasattr(self, 'instructor_email'):
                self.log_test("Instructor Login", False, "No instructor email stored from registration")
                return False
                
            data = {
                "email": self.instructor_email,
                "password": "InstructorPass123!"
            }
            response = requests.post(f"{self.base_url}/api/instructor/login", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'token' in response_data and 'instructor' in response_data:
                    self.instructor_token = response_data['token']
                    instructor = response_data['instructor']
                    details += f", Instructor ID: {instructor.get('id')}, Name: {instructor.get('name')}"
                else:
                    success = False
                    details += ", Missing token or instructor in response"
            
            self.log_test("Instructor Login", success, details)
            return success
        except Exception as e:
            self.log_test("Instructor Login", False, str(e))
            return False

    def test_instructor_profile(self):
        """Test getting instructor profile"""
        try:
            if not self.instructor_id:
                self.log_test("Instructor Profile", False, "No instructor ID available")
                return False
            
            params = {"instructor_id": self.instructor_id}
            response = requests.get(f"{self.base_url}/api/instructor/profile", params=params, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                required_fields = ["id", "email", "name", "school_name", "student_count"]
                has_all_fields = all(field in response_data for field in required_fields)
                
                if has_all_fields:
                    name = response_data.get('name')
                    school = response_data.get('school_name')
                    student_count = response_data.get('student_count')
                    details += f", Name: {name}, School: {school}, Students: {student_count}"
                else:
                    success = False
                    details += f", Missing fields in response: {response_data}"
            
            self.log_test("Instructor Profile", success, details)
            return success
        except Exception as e:
            self.log_test("Instructor Profile", False, str(e))
            return False

    def test_add_student_to_roster(self):
        """Test adding a student to instructor's roster"""
        try:
            if not self.instructor_id:
                self.log_test("Add Student to Roster", False, "No instructor ID available")
                return False
            
            data = {
                "instructor_id": self.instructor_id,
                "student_device_id": "student_device_001",
                "student_name": "Alice Johnson",
                "student_email": "alice.johnson@example.com",
                "permit_date": "2024-01-15",
                "target_test_date": "2024-06-15",
                "notes": "Needs practice with parallel parking"
            }
            response = requests.post(f"{self.base_url}/api/instructor/students", json=data, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'student_id' in response_data and 'status' in response_data:
                    student_id = response_data['student_id']
                    self.student_ids.append(student_id)
                    status = response_data['status']
                    details += f", Student ID: {student_id}, Status: {status}"
                else:
                    success = False
                    details += ", Missing student_id or status in response"
            
            self.log_test("Add Student to Roster", success, details)
            return success
        except Exception as e:
            self.log_test("Add Student to Roster", False, str(e))
            return False

    def test_list_students(self):
        """Test listing students for instructor"""
        try:
            if not self.instructor_id:
                self.log_test("List Students", False, "No instructor ID available")
                return False
            
            params = {"instructor_id": self.instructor_id}
            response = requests.get(f"{self.base_url}/api/instructor/students", params=params, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if isinstance(response_data, list):
                    student_count = len(response_data)
                    details += f", Student count: {student_count}"
                    
                    # Should have at least 1 student after adding one
                    if student_count >= 1:
                        first_student = response_data[0]
                        name = first_student.get('name')
                        device_id = first_student.get('device_id')
                        details += f", First student: {name} ({device_id})"
                    else:
                        success = False
                        details += " (Expected at least 1 student)"
                else:
                    success = False
                    details += f", Expected list, got: {type(response_data)}"
            
            self.log_test("List Students", success, details)
            return success
        except Exception as e:
            self.log_test("List Students", False, str(e))
            return False

    def test_instructor_dashboard(self):
        """Test getting instructor dashboard summary"""
        try:
            if not self.instructor_id:
                self.log_test("Instructor Dashboard", False, "No instructor ID available")
                return False
            
            params = {"instructor_id": self.instructor_id}
            response = requests.get(f"{self.base_url}/api/instructor/dashboard", params=params, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                required_fields = ["instructor", "total_students", "active_students", "students_meeting_requirements", "average_student_score"]
                has_all_fields = all(field in response_data for field in required_fields)
                
                if has_all_fields:
                    total_students = response_data.get('total_students')
                    active_students = response_data.get('active_students')
                    avg_score = response_data.get('average_student_score')
                    total_hours = response_data.get('total_hours_supervised')
                    details += f", Total Students: {total_students}, Active: {active_students}"
                    details += f", Avg Score: {avg_score}, Hours: {total_hours}"
                else:
                    success = False
                    details += f", Missing fields in response: {response_data}"
            
            self.log_test("Instructor Dashboard", success, details)
            return success
        except Exception as e:
            self.log_test("Instructor Dashboard", False, str(e))
            return False

    def test_create_invite_link(self):
        """Test creating invite link for student"""
        try:
            if not self.instructor_id:
                self.log_test("Create Invite Link", False, "No instructor ID available")
                return False
            
            data = {
                "student_name": "Bob Wilson"
            }
            params = {"instructor_id": self.instructor_id}
            response = requests.post(f"{self.base_url}/api/instructor/invite", json=data, params=params, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'invite_code' in response_data and 'invite_link' in response_data:
                    invite_code = response_data['invite_code']
                    invite_link = response_data['invite_link']
                    expires_at = response_data.get('expires_at')
                    details += f", Code: {invite_code}, Link: {invite_link}"
                    if expires_at:
                        details += f", Expires: {expires_at}"
                else:
                    success = False
                    details += ", Missing invite_code or invite_link in response"
            
            self.log_test("Create Invite Link", success, details)
            return success, response.json() if success else {}
        except Exception as e:
            self.log_test("Create Invite Link", False, str(e))
            return False, {}

    def test_remove_student(self):
        """Test removing a student from instructor's roster"""
        try:
            if not self.instructor_id or not self.student_ids:
                self.log_test("Remove Student", False, "No instructor ID or student ID available")
                return False
            
            student_id = self.student_ids[0]
            params = {"instructor_id": self.instructor_id}
            response = requests.delete(f"{self.base_url}/api/instructor/students/{student_id}", params=params, timeout=10)
            
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                response_data = response.json()
                if 'status' in response_data:
                    status = response_data['status']
                    details += f", Status: {status}"
                else:
                    success = False
                    details += ", Missing status in response"
            
            self.log_test("Remove Student", success, details)
            return success
        except Exception as e:
            self.log_test("Remove Student", False, str(e))
            return False

    # ==================== EDGE CASE TESTS ====================
    
    def test_referral_edge_cases(self):
        """Test referral system edge cases"""
        print("\n🔍 Testing Referral System Edge Cases...")
        
        # Test self-referral (should fail)
        try:
            user_a_code = None
            for ref in self.created_referral_codes:
                if ref['device_id'] == 'device_user_a_001':
                    user_a_code = ref['code']
                    break
            
            if user_a_code:
                data = {
                    "device_id": "device_user_a_001",  # Same device trying to use own code
                    "referral_code": user_a_code,
                    "email": "user_a@example.com"
                }
                response = requests.post(f"{self.base_url}/api/referral/apply", json=data, timeout=10)
                success = response.status_code == 400  # Should fail
                self.log_test("Self-Referral Prevention", success, f"Status: {response.status_code} (expected 400)")
        except Exception as e:
            self.log_test("Self-Referral Prevention", False, str(e))
        
        # Test duplicate referral application (should fail)
        try:
            if user_a_code:
                data = {
                    "device_id": "device_user_b_002",  # User B trying to apply same code again
                    "referral_code": user_a_code,
                    "email": "user_b@example.com"
                }
                response = requests.post(f"{self.base_url}/api/referral/apply", json=data, timeout=10)
                success = response.status_code == 400  # Should fail
                self.log_test("Duplicate Referral Prevention", success, f"Status: {response.status_code} (expected 400)")
        except Exception as e:
            self.log_test("Duplicate Referral Prevention", False, str(e))

    def test_instructor_edge_cases(self):
        """Test instructor portal edge cases"""
        print("\n🔍 Testing Instructor Portal Edge Cases...")
        
        # Test duplicate email registration (should fail)
        try:
            data = {
                "email": self.instructor_email,  # Same email as before
                "password": "AnotherPass123!",
                "name": "Jane Doe",
                "school_name": "Another School"
            }
            response = requests.post(f"{self.base_url}/api/instructor/register", json=data, timeout=10)
            success = response.status_code == 400  # Should fail
            self.log_test("Duplicate Email Registration", success, f"Status: {response.status_code} (expected 400)")
        except Exception as e:
            self.log_test("Duplicate Email Registration", False, str(e))
        
        # Test invalid login credentials (should fail)
        try:
            data = {
                "email": "nonexistent@example.com",
                "password": "WrongPassword123!"
            }
            response = requests.post(f"{self.base_url}/api/instructor/login", json=data, timeout=10)
            success = response.status_code == 401  # Should fail
            self.log_test("Invalid Login Credentials", success, f"Status: {response.status_code} (expected 401)")
        except Exception as e:
            self.log_test("Invalid Login Credentials", False, str(e))

    # ==================== MAIN TEST RUNNER ====================
    
    def run_referral_system_tests(self):
        """Run all referral system tests"""
        print("\n🎯 Testing Referral System API...")
        
        # Test flow: Create codes → Apply code → Check rewards
        self.test_create_referral_code_user_a()
        self.test_create_referral_code_user_b()
        self.test_apply_referral_code()
        self.test_referral_stats_user_a()
        self.test_referral_rewards_user_a()
        self.test_referral_rewards_user_b()
        self.test_validate_referral_code()
        self.test_validate_invalid_referral_code()
        
        # Edge cases
        self.test_referral_edge_cases()

    def run_instructor_portal_tests(self):
        """Run all instructor portal tests"""
        print("\n👨‍🏫 Testing Instructor Portal API...")
        
        # Test flow: Register → Login → Add student → Dashboard → Invite → Remove
        self.test_instructor_register()
        self.test_instructor_login()
        self.test_instructor_profile()
        self.test_add_student_to_roster()
        self.test_list_students()
        self.test_instructor_dashboard()
        self.test_create_invite_link()
        self.test_remove_student()
        
        # Edge cases
        self.test_instructor_edge_cases()

    def run_all_tests(self):
        """Run all DriveCoach API tests"""
        print("🚗 Starting DriveCoach API Testing...")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Run referral system tests
        self.run_referral_system_tests()
        
        # Run instructor portal tests
        self.run_instructor_portal_tests()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        else:
            print("\n✅ ALL TESTS PASSED!")
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = DriveCoachAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)