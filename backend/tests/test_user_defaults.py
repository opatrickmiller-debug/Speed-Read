"""
Test suite for user registration defaults and settings
Features tested:
- New user registration defaults to imperial unit system
- Settings update endpoint allows changing unit_system
- Existing user settings can be updated properly
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestUserRegistrationDefaults:
    """Test that new users are created with imperial unit system by default"""
    
    def test_new_user_defaults_to_imperial(self):
        """New user registration should default unit_system to 'imperial'"""
        unique_email = f"test_imperial_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "test123",
            "name": "Test Imperial User"
        })
        
        # Status assertion
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "user" in data, "Response should contain user object"
        assert "access_token" in data, "Response should contain access_token"
        
        user = data["user"]
        assert user["unit_system"] == "imperial", f"Expected unit_system 'imperial', got '{user.get('unit_system')}'"
        assert user["email"] == unique_email
        assert user["name"] == "Test Imperial User"
        
        # Verify other default values
        assert user["protein_goal"] == 150.0
        assert user["daily_carb_limit"] == 20.0
        assert user["body_weight_kg"] == 70.0
        assert user["body_fat_percentage"] == 20.0
        assert user["protein_per_kg_lbm"] == 2.0
        
        print(f"✓ New user registered with unit_system='{user['unit_system']}'")


class TestExistingUserSettings:
    """Test that existing user settings can be updated"""
    
    @pytest.fixture
    def auth_token(self):
        """Login with test account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        
        if response.status_code != 200:
            pytest.skip("Test account not available")
        
        return response.json()["access_token"]
    
    def test_login_returns_user_with_unit_system(self, auth_token):
        """Verify login response includes unit_system field"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "user" in data
        user = data["user"]
        assert "unit_system" in user, "User response should include unit_system"
        assert user["unit_system"] in ["metric", "imperial"], f"Invalid unit_system: {user['unit_system']}"
        
        print(f"✓ Login returns user with unit_system='{user['unit_system']}'")
    
    def test_update_settings_with_all_fields(self, auth_token):
        """Test updating all settings including unit_system"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Update settings
        update_payload = {
            "body_weight_kg": 75.0,
            "body_fat_percentage": 18.0,
            "protein_per_kg_lbm": 2.2,
            "protein_goal": 160.0,
            "daily_carb_limit": 25.0,
            "unit_system": "imperial"
        }
        
        response = requests.put(f"{BASE_URL}/api/auth/settings", 
                               json=update_payload, 
                               headers=headers)
        
        assert response.status_code == 200, f"Settings update failed: {response.text}"
        
        # Verify response contains updated values
        data = response.json()
        assert data["body_weight_kg"] == 75.0
        assert data["body_fat_percentage"] == 18.0
        assert data["protein_per_kg_lbm"] == 2.2
        assert data["protein_goal"] == 160.0
        assert data["daily_carb_limit"] == 25.0
        assert data["unit_system"] == "imperial"
        
        print("✓ Settings updated successfully with all fields")
    
    def test_update_unit_system_only(self, auth_token):
        """Test updating only the unit_system field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Update only unit_system to metric
        response = requests.put(f"{BASE_URL}/api/auth/settings", 
                               json={"unit_system": "metric"}, 
                               headers=headers)
        
        assert response.status_code == 200, f"Failed to update unit_system: {response.text}"
        
        data = response.json()
        assert data["unit_system"] == "metric"
        
        # Verify change persists
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me_response.status_code == 200
        assert me_response.json()["unit_system"] == "metric"
        
        # Change back to imperial
        response = requests.put(f"{BASE_URL}/api/auth/settings", 
                               json={"unit_system": "imperial"}, 
                               headers=headers)
        assert response.status_code == 200
        assert response.json()["unit_system"] == "imperial"
        
        print("✓ Unit system toggled successfully: metric → imperial")
    
    def test_invalid_unit_system_rejected(self, auth_token):
        """Test that invalid unit_system values are rejected"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.put(f"{BASE_URL}/api/auth/settings", 
                               json={"unit_system": "invalid"}, 
                               headers=headers)
        
        # Should return 422 validation error
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        print("✓ Invalid unit_system correctly rejected with 422")


class TestSettingsNumericInputValidation:
    """Test that settings accept numeric values (for text input changes)"""
    
    @pytest.fixture
    def auth_token(self):
        """Login with test account"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        
        if response.status_code != 200:
            pytest.skip("Test account not available")
        
        return response.json()["access_token"]
    
    def test_body_weight_accepts_numeric(self, auth_token):
        """Body weight accepts numeric values (from text input)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.put(f"{BASE_URL}/api/auth/settings", 
                               json={"body_weight_kg": 85.5}, 
                               headers=headers)
        
        assert response.status_code == 200
        assert response.json()["body_weight_kg"] == 85.5
        print("✓ body_weight_kg accepts numeric values")
    
    def test_body_fat_accepts_numeric(self, auth_token):
        """Body fat percentage accepts numeric values"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.put(f"{BASE_URL}/api/auth/settings", 
                               json={"body_fat_percentage": 22.5}, 
                               headers=headers)
        
        assert response.status_code == 200
        assert response.json()["body_fat_percentage"] == 22.5
        print("✓ body_fat_percentage accepts numeric values")
    
    def test_protein_multiplier_accepts_numeric(self, auth_token):
        """Protein multiplier accepts numeric values"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.put(f"{BASE_URL}/api/auth/settings", 
                               json={"protein_per_kg_lbm": 2.5}, 
                               headers=headers)
        
        assert response.status_code == 200
        assert response.json()["protein_per_kg_lbm"] == 2.5
        print("✓ protein_per_kg_lbm accepts numeric values")
    
    def test_carb_limit_accepts_numeric(self, auth_token):
        """Carb limit accepts numeric values"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.put(f"{BASE_URL}/api/auth/settings", 
                               json={"daily_carb_limit": 30.0}, 
                               headers=headers)
        
        assert response.status_code == 200
        assert response.json()["daily_carb_limit"] == 30.0
        print("✓ daily_carb_limit accepts numeric values")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
