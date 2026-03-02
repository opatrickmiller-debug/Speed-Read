"""
Backend tests for essential fatty acids feature
- Tests fatty acid extraction from USDA data
- Tests fatty acid suggestions API endpoints
- Tests food log with fatty acids
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "tester@test.com"
TEST_PASSWORD = "test123"


class TestAuth:
    """Authentication tests - Get token for subsequent tests"""
    
    def test_login_success(self):
        """Test login to get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]


class TestFattyAcidSuggestions:
    """Test fatty acid suggestions endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_fatty_acid_suggestions(self):
        """Test GET /api/suggestions/fatty-acids endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/suggestions/fatty-acids",
            headers=self.headers
        )
        assert response.status_code == 200, f"Fatty acids suggestions failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "date" in data, "Missing date field"
        assert "omega3_total" in data, "Missing omega3_total field"
        assert "omega6_total" in data, "Missing omega6_total field"
        assert "omega_ratio" in data, "Missing omega_ratio field"
        assert "ideal_ratio" in data, "Missing ideal_ratio field"
        assert "low_fatty_acids" in data, "Missing low_fatty_acids field"
        assert "complete_profile" in data, "Missing complete_profile field"
        
        # Validate data types
        assert isinstance(data["omega3_total"], (int, float)), "omega3_total should be numeric"
        assert isinstance(data["omega6_total"], (int, float)), "omega6_total should be numeric"
        assert isinstance(data["low_fatty_acids"], list), "low_fatty_acids should be a list"
        assert isinstance(data["complete_profile"], bool), "complete_profile should be boolean"
    
    def test_fatty_acid_suggestions_with_date(self):
        """Test fatty acid suggestions with specific date parameter"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/suggestions/fatty-acids?date={today}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Fatty acids suggestions with date failed: {response.text}"
        data = response.json()
        assert data["date"] == today, f"Date mismatch: expected {today}, got {data['date']}"
    
    def test_fatty_acid_deficit_structure(self):
        """Test structure of fatty acid deficit items"""
        response = requests.get(
            f"{BASE_URL}/api/suggestions/fatty-acids",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # If there are low fatty acids, validate their structure
        if data["low_fatty_acids"]:
            fa = data["low_fatty_acids"][0]
            assert "fatty_acid" in fa, "Missing fatty_acid name"
            assert "omega_type" in fa, "Missing omega_type"
            assert "current_intake" in fa, "Missing current_intake"
            assert "recommended_intake" in fa, "Missing recommended_intake"
            assert "deficit" in fa, "Missing deficit"
            assert "suggested_foods" in fa, "Missing suggested_foods"
            
            # Validate omega_type is 3 or 6
            assert fa["omega_type"] in [3, 6], f"Invalid omega_type: {fa['omega_type']}"
            
            # Validate deficit calculation
            assert fa["deficit"] >= 0, "Deficit should not be negative"


class TestOmegaRichFoods:
    """Test omega-rich foods endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_omega3_rich_foods(self):
        """Test GET /api/suggestions/omega-rich-foods for omega-3"""
        response = requests.get(
            f"{BASE_URL}/api/suggestions/omega-rich-foods?omega_type=3",
            headers=self.headers
        )
        assert response.status_code == 200, f"Omega-3 foods failed: {response.text}"
        data = response.json()
        
        assert "omega_type" in data, "Missing omega_type"
        assert data["omega_type"] == 3, "Wrong omega type"
        assert "foods" in data, "Missing foods"
        assert "tip" in data, "Missing tip"
    
    def test_get_omega6_rich_foods(self):
        """Test GET /api/suggestions/omega-rich-foods for omega-6"""
        response = requests.get(
            f"{BASE_URL}/api/suggestions/omega-rich-foods?omega_type=6",
            headers=self.headers
        )
        assert response.status_code == 200, f"Omega-6 foods failed: {response.text}"
        data = response.json()
        
        assert data["omega_type"] == 6, "Wrong omega type"
        assert isinstance(data["foods"], list), "Foods should be a list"


class TestFoodDetailsWithFattyAcids:
    """Test that food details include fatty acid data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_salmon_has_fatty_acids(self):
        """Test that salmon (FDC 175168) includes fatty acid data"""
        # Salmon should have significant omega-3 content
        response = requests.get(
            f"{BASE_URL}/api/foods/175168",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get salmon details failed: {response.text}"
        data = response.json()
        
        # Validate fatty acid fields exist
        assert "fatty_acids" in data, "Missing fatty_acids field"
        assert "omega3_total" in data, "Missing omega3_total field"
        assert "omega6_total" in data, "Missing omega6_total field"
        assert "omega_ratio" in data, "Missing omega_ratio field"
        
        # Salmon should have omega-3 fatty acids
        assert isinstance(data["fatty_acids"], list), "fatty_acids should be a list"
        assert data["omega3_total"] >= 0, "omega3_total should be non-negative"
    
    def test_food_search_returns_results(self):
        """Test food search for fatty fish"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=salmon&page=1&page_size=10",
            headers=self.headers
        )
        assert response.status_code == 200, f"Food search failed: {response.text}"
        data = response.json()
        
        assert "foods" in data, "Missing foods in search response"
        assert len(data["foods"]) > 0, "No foods returned for salmon search"


class TestFoodLogWithFattyAcids:
    """Test food logging with fatty acids data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_create_food_log_with_fatty_acids(self):
        """Test creating food log with fatty acid data"""
        test_log = {
            "fdc_id": "TEST_175168",
            "description": "TEST_Salmon with fatty acids",
            "serving_size": 100,
            "serving_unit": "g",
            "servings": 1,
            "calories": 208,
            "protein": 25,
            "fat": 12,
            "carbs": 0,
            "fiber": 0,
            "amino_acids": [
                {"name": "Leucine", "value": 1.8, "is_essential": True},
                {"name": "Lysine", "value": 2.1, "is_essential": True}
            ],
            "fatty_acids": [
                {"name": "EPA", "value": 0.86, "is_essential": True, "omega_type": 3},
                {"name": "DHA", "value": 1.1, "is_essential": True, "omega_type": 3},
                {"name": "Linoleic acid (LA)", "value": 0.15, "is_essential": True, "omega_type": 6}
            ],
            "meal_type": "lunch"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/logs",
            json=test_log,
            headers=self.headers
        )
        assert response.status_code == 200, f"Create log failed: {response.text}"
        data = response.json()
        
        # Validate fatty acids were saved
        assert "fatty_acids" in data, "Missing fatty_acids in response"
        assert len(data["fatty_acids"]) == 3, f"Expected 3 fatty acids, got {len(data['fatty_acids'])}"
        
        # Store log_id for cleanup
        self.created_log_id = data["id"]
        
        # Verify the log can be retrieved
        get_response = requests.get(
            f"{BASE_URL}/api/logs?date={datetime.now().strftime('%Y-%m-%d')}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        logs = get_response.json()
        
        # Find our test log
        test_logs = [l for l in logs if l.get("fdc_id") == "TEST_175168"]
        assert len(test_logs) > 0, "Test log not found in logs"
        
        # Verify fatty acids persisted
        found_log = test_logs[0]
        assert "fatty_acids" in found_log, "fatty_acids not persisted"
        
        # Cleanup
        if hasattr(self, 'created_log_id'):
            requests.delete(
                f"{BASE_URL}/api/logs/{self.created_log_id}",
                headers=self.headers
            )
    
    def test_fatty_acids_affect_suggestions(self):
        """Test that logged fatty acids affect suggestions"""
        # Get suggestions before logging
        before = requests.get(
            f"{BASE_URL}/api/suggestions/fatty-acids",
            headers=self.headers
        )
        assert before.status_code == 200
        before_data = before.json()
        
        # Get current omega3 total
        initial_omega3 = before_data["omega3_total"]
        print(f"Initial omega3 total: {initial_omega3}")


class TestAminoAcidSuggestions:
    """Test existing amino acid suggestions still work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_amino_acid_suggestions(self):
        """Test GET /api/suggestions/amino-acids endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/suggestions/amino-acids",
            headers=self.headers
        )
        assert response.status_code == 200, f"Amino acid suggestions failed: {response.text}"
        data = response.json()
        
        assert "date" in data, "Missing date"
        assert "missing_amino_acids" in data, "Missing missing_amino_acids"
        assert "low_amino_acids" in data, "Missing low_amino_acids"
        assert "complete_profile" in data, "Missing complete_profile"
    
    def test_complete_protein_endpoint(self):
        """Test GET /api/suggestions/complete-protein endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/suggestions/complete-protein",
            headers=self.headers
        )
        assert response.status_code == 200, f"Complete protein endpoint failed: {response.text}"
        data = response.json()
        
        assert "complete_protein_foods" in data, "Missing complete_protein_foods"
        assert "tip" in data, "Missing tip"
        assert len(data["complete_protein_foods"]) > 0, "No complete proteins returned"


class TestTrendsWeeklyStats:
    """Test weekly stats include current day"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_res.status_code == 200:
            self.token = login_res.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_weekly_trends_endpoint(self):
        """Test GET /api/stats/weekly endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/stats/weekly",
            headers=self.headers
        )
        assert response.status_code == 200, f"Weekly stats failed: {response.text}"
        data = response.json()
        
        # Validate response structure - it's wrapped in an object with 'days' key
        assert "days" in data, "Missing days in weekly stats response"
        days = data["days"]
        
        assert isinstance(days, list), "Days should be a list"
        assert len(days) == 7, f"Expected 7 days, got {len(days)}"
        
        # Check today's date is included
        today = datetime.now().strftime("%Y-%m-%d")
        dates = [day.get("date") for day in days]
        assert today in dates, f"Today's date {today} not in weekly stats: {dates}"
        
        # Validate structure of each day
        for day in days:
            assert "date" in day, "Missing date in day stats"
            assert "protein" in day or "total_protein" in day, "Missing protein in day stats"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
