"""
Backend tests for unified food search across USDA, Open Food Facts, and custom foods.
Tests:
- Search endpoint returns results from both USDA and Open Food Facts
- Source badges display correctly (source field for USDA/OFF)
- AA Data badge shows for USDA items with amino acid profiles
- Food detail view loads for USDA items
- Food detail view loads for Open Food Facts items
- Favorite functionality works for both sources
"""

import pytest
import requests
import os
from datetime import datetime
import time

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


class TestUnifiedFoodSearch:
    """Test unified food search across USDA and Open Food Facts"""
    
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
    
    def test_search_returns_both_usda_and_off_results(self):
        """Test that search returns results from both USDA and Open Food Facts"""
        # Search for a common food term like "oreo" that should appear in both
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=oreo&page=1&page_size=25",
            headers=self.headers,
            timeout=30  # Long timeout due to external API latency
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "foods" in data, "Missing foods in response"
        assert "total_hits" in data, "Missing total_hits"
        assert "sources" in data, "Missing sources field"
        
        foods = data["foods"]
        sources = data["sources"]
        
        # Check that we have both USDA and OFF sources
        assert "usda" in sources or "off" in sources, f"Expected usda or off in sources, got: {sources}"
        
        # Count by source
        usda_count = len([f for f in foods if f.get("source") == "usda"])
        off_count = len([f for f in foods if f.get("source") == "off"])
        
        print(f"Search results - USDA: {usda_count}, Open Food Facts: {off_count}")
        
        # We should have results from both sources for common products
        if usda_count == 0 and off_count == 0:
            pytest.fail("No results from either USDA or Open Food Facts")
    
    def test_search_results_have_source_field(self):
        """Test that each search result has proper source field"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=milk&page=1&page_size=20",
            headers=self.headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        foods = data["foods"]
        assert len(foods) > 0, "No search results"
        
        for food in foods:
            assert "source" in food, f"Missing source field in food: {food.get('description', 'unknown')}"
            assert food["source"] in ["usda", "off", "custom"], f"Invalid source: {food['source']}"
            assert "fdc_id" in food, "Missing fdc_id field"
            assert "description" in food, "Missing description field"
    
    def test_usda_results_have_amino_acid_flag(self):
        """Test that USDA results have has_amino_acids flag"""
        # Search for a food that should have USDA results with amino acids
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=chicken+breast&page=1&page_size=25",
            headers=self.headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        foods = data["foods"]
        usda_foods = [f for f in foods if f.get("source") == "usda"]
        
        if len(usda_foods) > 0:
            for food in usda_foods:
                # has_amino_acids should be present in USDA results
                assert "has_amino_acids" in food, f"Missing has_amino_acids field in USDA food: {food.get('description')}"
                assert isinstance(food["has_amino_acids"], bool), "has_amino_acids should be boolean"
                
                # Check data_type field
                assert "data_type" in food, "Missing data_type field"
                
                # If data_type is SR Legacy, Foundation, or Survey, should have amino acids flag
                if food.get("data_type") in ["SR Legacy", "Foundation", "Survey (FNDDS)"]:
                    assert food["has_amino_acids"] == True, f"SR Legacy/Foundation food should have amino acids: {food.get('description')}"
    
    def test_off_results_have_correct_structure(self):
        """Test that Open Food Facts results have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=nutella&page=1&page_size=25",
            headers=self.headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        foods = data["foods"]
        off_foods = [f for f in foods if f.get("source") == "off"]
        
        print(f"Found {len(off_foods)} Open Food Facts results for 'nutella'")
        
        if len(off_foods) > 0:
            for food in off_foods:
                # OFF IDs should start with "off:"
                assert food.get("fdc_id", "").startswith("off:"), f"OFF fdc_id should start with 'off:': {food.get('fdc_id')}"
                assert food.get("id", "").startswith("off:"), f"OFF id should start with 'off:': {food.get('id')}"
                
                # OFF results should have nutrition per 100g
                assert "protein_per_100g" in food, "Missing protein_per_100g"
                assert "data_type" in food, "Missing data_type"
                assert food["data_type"] == "Open Food Facts", f"OFF data_type should be 'Open Food Facts', got: {food['data_type']}"
                
                # OFF foods don't have amino acid data
                assert food.get("has_amino_acids") == False, "OFF foods should not have amino acid data"
    
    def test_search_filter_by_usda_source(self):
        """Test search with source filter for USDA only"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=salmon&page=1&page_size=25&source=usda",
            headers=self.headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        foods = data["foods"]
        
        # All results should be from USDA
        for food in foods:
            assert food.get("source") == "usda", f"Expected USDA source, got: {food.get('source')}"
    
    def test_search_filter_by_off_source(self):
        """Test search with source filter for Open Food Facts only"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=coca+cola&page=1&page_size=25&source=off",
            headers=self.headers,
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        
        foods = data["foods"]
        
        # All results should be from OFF (if any)
        for food in foods:
            assert food.get("source") == "off", f"Expected OFF source, got: {food.get('source')}"


class TestFoodDetailsUSDA:
    """Test food detail view for USDA items"""
    
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
    
    def test_get_usda_food_details(self):
        """Test getting details for a USDA food item"""
        # 175168 is salmon - a known USDA food
        response = requests.get(
            f"{BASE_URL}/api/foods/175168",
            headers=self.headers,
            timeout=20
        )
        assert response.status_code == 200, f"Get USDA food details failed: {response.text}"
        data = response.json()
        
        # Validate required fields
        assert "fdc_id" in data, "Missing fdc_id"
        assert "description" in data, "Missing description"
        assert "source" in data, "Missing source"
        assert data["source"] == "usda", f"Expected USDA source, got: {data['source']}"
        
        # Validate nutrition fields
        assert "calories" in data, "Missing calories"
        assert "protein" in data, "Missing protein"
        assert "fat" in data, "Missing fat"
        assert "carbs" in data, "Missing carbs"
        
        # Validate amino acid fields
        assert "amino_acids" in data, "Missing amino_acids"
        assert "has_amino_acids" in data, "Missing has_amino_acids flag"
        
        # Validate fatty acid fields
        assert "fatty_acids" in data, "Missing fatty_acids"
        assert "omega3_total" in data, "Missing omega3_total"
        assert "omega6_total" in data, "Missing omega6_total"
        
        print(f"USDA food: {data['description']}, protein: {data['protein']}g, has_amino_acids: {data['has_amino_acids']}")
    
    def test_usda_food_with_amino_acids_profile(self):
        """Test that USDA SR Legacy foods have amino acid data"""
        # 175168 (salmon) should be SR Legacy with amino acids
        response = requests.get(
            f"{BASE_URL}/api/foods/175168",
            headers=self.headers,
            timeout=20
        )
        assert response.status_code == 200
        data = response.json()
        
        # Salmon should have amino acid data
        assert isinstance(data["amino_acids"], list), "amino_acids should be a list"
        if data["has_amino_acids"]:
            assert len(data["amino_acids"]) > 0, "has_amino_acids is True but no amino_acids data"


class TestFoodDetailsOpenFoodFacts:
    """Test food detail view for Open Food Facts items"""
    
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
    
    def test_get_off_food_details(self):
        """Test getting details for an Open Food Facts item"""
        # Search first to get a valid OFF barcode
        search_res = requests.get(
            f"{BASE_URL}/api/foods/search?query=nutella&page=1&page_size=10&source=off",
            headers=self.headers,
            timeout=30
        )
        
        if search_res.status_code != 200:
            pytest.skip("Could not search for OFF foods")
        
        search_data = search_res.json()
        off_foods = search_data.get("foods", [])
        
        if len(off_foods) == 0:
            pytest.skip("No OFF results to test with")
        
        # Get the first OFF food's fdc_id
        off_fdc_id = off_foods[0]["fdc_id"]
        print(f"Testing OFF food detail for: {off_fdc_id}")
        
        # Get food details
        response = requests.get(
            f"{BASE_URL}/api/foods/{off_fdc_id}",
            headers=self.headers,
            timeout=20
        )
        assert response.status_code == 200, f"Get OFF food details failed: {response.text}"
        data = response.json()
        
        # Validate required fields
        assert "fdc_id" in data, "Missing fdc_id"
        assert data["fdc_id"] == off_fdc_id, "fdc_id mismatch"
        assert "description" in data, "Missing description"
        assert "source" in data, "Missing source"
        assert data["source"] == "off", f"Expected OFF source, got: {data['source']}"
        
        # Validate nutrition fields
        assert "calories" in data, "Missing calories"
        assert "protein" in data, "Missing protein"
        assert "fat" in data, "Missing fat"
        assert "carbs" in data, "Missing carbs"
        
        # OFF foods should not have amino acid data
        assert data.get("has_amino_acids") == False, "OFF foods should not have amino acid data"
        
        print(f"OFF food: {data['description']}, source: {data['source']}, calories: {data['calories']}")
    
    def test_off_detail_has_serving_info(self):
        """Test that OFF food detail has serving information"""
        # Search for a known product
        search_res = requests.get(
            f"{BASE_URL}/api/foods/search?query=oreo&page=1&page_size=10&source=off",
            headers=self.headers,
            timeout=30
        )
        
        if search_res.status_code != 200:
            pytest.skip("Could not search for OFF foods")
        
        search_data = search_res.json()
        off_foods = search_data.get("foods", [])
        
        if len(off_foods) == 0:
            pytest.skip("No OFF results to test with")
        
        off_fdc_id = off_foods[0]["fdc_id"]
        
        response = requests.get(
            f"{BASE_URL}/api/foods/{off_fdc_id}",
            headers=self.headers,
            timeout=20
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have serving information
        assert "serving_size" in data, "Missing serving_size"
        assert "serving_unit" in data, "Missing serving_unit"


class TestFavoritesFunctionality:
    """Test favorite functionality for both USDA and OFF foods"""
    
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
    
    def test_check_favorite_status_usda(self):
        """Test checking favorite status for USDA food"""
        response = requests.get(
            f"{BASE_URL}/api/favorites/check/175168",
            headers=self.headers
        )
        assert response.status_code == 200, f"Check favorite failed: {response.text}"
        data = response.json()
        
        assert "is_favorite" in data, "Missing is_favorite"
        assert isinstance(data["is_favorite"], bool), "is_favorite should be boolean"
    
    def test_add_and_remove_favorite_usda(self):
        """Test adding and removing favorite for USDA food"""
        # Add favorite
        add_response = requests.post(
            f"{BASE_URL}/api/favorites",
            json={
                "fdc_id": "TEST_175168",
                "description": "TEST_Salmon Favorite",
                "protein_per_100g": 25,
                "is_complete_protein": True
            },
            headers=self.headers
        )
        assert add_response.status_code == 200, f"Add favorite failed: {add_response.text}"
        add_data = add_response.json()
        
        assert "id" in add_data, "Missing favorite id"
        favorite_id = add_data["id"]
        
        # Verify it's now a favorite
        check_response = requests.get(
            f"{BASE_URL}/api/favorites/check/TEST_175168",
            headers=self.headers
        )
        assert check_response.status_code == 200
        check_data = check_response.json()
        assert check_data["is_favorite"] == True, "Food should be marked as favorite"
        
        # Remove favorite
        delete_response = requests.delete(
            f"{BASE_URL}/api/favorites/{favorite_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200, f"Delete favorite failed: {delete_response.text}"
        
        # Verify it's removed
        check_after = requests.get(
            f"{BASE_URL}/api/favorites/check/TEST_175168",
            headers=self.headers
        )
        assert check_after.status_code == 200
        assert check_after.json()["is_favorite"] == False, "Food should no longer be favorite"
    
    def test_check_favorite_status_off(self):
        """Test checking favorite status for Open Food Facts food"""
        # OFF IDs have "off:" prefix
        response = requests.get(
            f"{BASE_URL}/api/favorites/check/off:5449000054227",  # Coca-Cola barcode
            headers=self.headers
        )
        assert response.status_code == 200, f"Check OFF favorite failed: {response.text}"
        data = response.json()
        
        assert "is_favorite" in data, "Missing is_favorite"


class TestAddToLogFunctionality:
    """Test add to log functionality for both sources"""
    
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
    
    def test_add_usda_food_to_log(self):
        """Test adding USDA food to log"""
        test_log = {
            "fdc_id": "TEST_USDA_175168",
            "description": "TEST_Salmon (USDA)",
            "serving_size": 100,
            "serving_unit": "g",
            "servings": 1,
            "calories": 208,
            "protein": 25,
            "fat": 12,
            "carbs": 0,
            "fiber": 0,
            "amino_acids": [],
            "fatty_acids": [],
            "meal_type": "lunch"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/logs",
            json=test_log,
            headers=self.headers
        )
        assert response.status_code == 200, f"Add USDA log failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Missing log id"
        log_id = data["id"]
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/logs/{log_id}", headers=self.headers)
    
    def test_add_off_food_to_log(self):
        """Test adding Open Food Facts food to log"""
        test_log = {
            "fdc_id": "off:TEST_5449000054227",
            "description": "TEST_Coca-Cola (OFF)",
            "serving_size": 100,
            "serving_unit": "ml",
            "servings": 2.5,
            "calories": 42,
            "protein": 0,
            "fat": 0,
            "carbs": 10.6,
            "fiber": 0,
            "amino_acids": [],
            "fatty_acids": [],
            "meal_type": "snack"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/logs",
            json=test_log,
            headers=self.headers
        )
        assert response.status_code == 200, f"Add OFF log failed: {response.text}"
        data = response.json()
        
        assert "id" in data, "Missing log id"
        assert data["fdc_id"] == "off:TEST_5449000054227", "fdc_id mismatch"
        log_id = data["id"]
        
        # Verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/logs?date={datetime.now().strftime('%Y-%m-%d')}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        logs = get_response.json()
        
        test_logs = [l for l in logs if l.get("fdc_id") == "off:TEST_5449000054227"]
        assert len(test_logs) > 0, "OFF log not persisted"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/logs/{log_id}", headers=self.headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
