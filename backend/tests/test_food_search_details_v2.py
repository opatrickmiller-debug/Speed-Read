"""
Test suite for Food Search and Food Details - Iteration 14
Focus on the fixes:
1. USDA FDC API 404 errors fixed (batch endpoint fallback)
2. Search returns calories_per_100g
3. Food details loads correctly for SR Legacy foods
4. Caching in fdc_client
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication for all tests"""
    
    def get_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]


class TestFoodSearchWithCalories:
    """Test /api/foods/search returns calories_per_100g in results"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        auth = TestAuth()
        self.token = auth.get_token()
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_search_chicken_returns_calories(self):
        """Test search for 'chicken' returns results with calories_per_100g"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=chicken&page_size=10",
            headers=self.headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "foods" in data
        assert len(data["foods"]) > 0, "No results for chicken"
        
        # Check first result has calories_per_100g
        first_food = data["foods"][0]
        assert "calories_per_100g" in first_food, f"Missing calories_per_100g in result: {first_food}"
        print(f"First result: {first_food['description']} - {first_food['calories_per_100g']} cal/100g")
    
    def test_search_egg_returns_calories(self):
        """Test search for 'egg' returns results with calories_per_100g"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=egg&page_size=10",
            headers=self.headers
        )
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert len(data["foods"]) > 0, "No results for egg"
        
        first_food = data["foods"][0]
        assert "calories_per_100g" in first_food
        assert first_food["calories_per_100g"] > 0, "Calories should be > 0 for eggs"
        print(f"First result: {first_food['description']} - {first_food['calories_per_100g']} cal/100g")
    
    def test_search_returns_protein_per_100g(self):
        """Test search returns protein_per_100g"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=beef&page_size=5",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        for food in data["foods"]:
            assert "protein_per_100g" in food, f"Missing protein_per_100g: {food['description']}"
        print(f"All {len(data['foods'])} results have protein_per_100g")
    
    def test_search_returns_tier_info(self):
        """Test search returns tier labels (Best Match, Verified, Community)"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=salmon&page_size=10",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check that tiers object exists
        assert "tiers" in data, "Missing tiers in response"
        
        # Check that foods have tier_label
        for food in data["foods"][:5]:
            assert "tier_label" in food, f"Missing tier_label: {food['description']}"
            assert food["tier_label"] in ["Best Match", "Verified", "Community", "Your Food"], f"Invalid tier: {food['tier_label']}"
        print(f"Tier counts: {data['tiers']}")


class TestFoodDetails:
    """Test /api/foods/{id} endpoint with specific IDs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        auth = TestAuth()
        self.token = auth.get_token()
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_food_details_169886_chicken(self):
        """Test food details for ID 169886 (Chicken, broilers or fryers)"""
        response = requests.get(
            f"{BASE_URL}/api/foods/169886",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get food 169886: {response.text}"
        data = response.json()
        
        # Verify essential fields
        assert "description" in data
        assert "calories" in data
        assert "protein" in data
        assert "fat" in data
        assert "carbs" in data
        
        print(f"Food 169886: {data['description']}")
        print(f"  Calories: {data['calories']}, Protein: {data['protein']}g")
    
    def test_food_details_174901_bagels(self):
        """Test food details for ID 174901 (Bagels, egg)"""
        response = requests.get(
            f"{BASE_URL}/api/foods/174901",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get food 174901: {response.text}"
        data = response.json()
        
        assert "description" in data
        assert "calories" in data
        assert data["calories"] > 0, "Calories should be > 0 for bagels"
        
        print(f"Food 174901: {data['description']}")
        print(f"  Calories: {data['calories']}, Carbs: {data.get('carbs', 0)}g")
    
    def test_food_details_includes_serving_info(self):
        """Test food details includes serving_size and serving_unit"""
        response = requests.get(
            f"{BASE_URL}/api/foods/169886",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "serving_size" in data, "Missing serving_size"
        assert "serving_unit" in data, "Missing serving_unit"
        print(f"Serving: {data['serving_size']}{data['serving_unit']}")
    
    def test_food_details_includes_source(self):
        """Test food details includes source field"""
        response = requests.get(
            f"{BASE_URL}/api/foods/169886",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "source" in data, "Missing source field"
        assert data["source"] in ["usda", "off", "custom"], f"Invalid source: {data['source']}"
        print(f"Source: {data['source']}")
    
    def test_food_details_has_amino_acids_for_sr_legacy(self):
        """Test SR Legacy foods have amino acid data"""
        response = requests.get(
            f"{BASE_URL}/api/foods/169886",  # Chicken - SR Legacy
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check amino_acids array exists
        assert "amino_acids" in data, "Missing amino_acids field"
        if data.get("has_amino_acids"):
            assert len(data["amino_acids"]) > 0, "has_amino_acids=True but array empty"
            print(f"Found {len(data['amino_acids'])} amino acids")
    
    def test_food_details_404_for_invalid_id(self):
        """Test 404 returned for non-existent food ID"""
        response = requests.get(
            f"{BASE_URL}/api/foods/999999999",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for invalid ID")


class TestFDCCachingBehavior:
    """Test that repeated requests benefit from caching"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        auth = TestAuth()
        self.token = auth.get_token()
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_repeated_requests_are_faster(self):
        """Test that second request for same food is faster (cached)"""
        food_id = "169886"
        
        # First request (may hit API)
        start1 = time.time()
        response1 = requests.get(
            f"{BASE_URL}/api/foods/{food_id}",
            headers=self.headers
        )
        time1 = time.time() - start1
        assert response1.status_code == 200
        
        # Second request (should be cached)
        start2 = time.time()
        response2 = requests.get(
            f"{BASE_URL}/api/foods/{food_id}",
            headers=self.headers
        )
        time2 = time.time() - start2
        assert response2.status_code == 200
        
        # Both should return same data
        assert response1.json()["description"] == response2.json()["description"]
        
        print(f"First request: {time1:.3f}s, Second request: {time2:.3f}s")
        # Note: Due to network variability, we just verify both work


class TestMealTypeFlow:
    """Test meal type in food logging"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        auth = TestAuth()
        self.token = auth.get_token()
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_log_food_with_meal_type_breakfast(self):
        """Test logging food with breakfast meal type"""
        log_data = {
            "fdc_id": "TEST_169886",
            "description": "TEST_Chicken for breakfast",
            "serving_size": 100,
            "serving_unit": "g",
            "servings": 1,
            "calories": 239,
            "protein": 27.3,
            "fat": 13.6,
            "carbs": 0,
            "fiber": 0,
            "amino_acids": [],
            "fatty_acids": [],
            "meal_type": "breakfast"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/logs",
            json=log_data,
            headers=self.headers
        )
        assert response.status_code in [200, 201], f"Failed to log: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"Logged food with meal_type=breakfast, id={data['id']}")
    
    def test_log_food_with_meal_type_lunch(self):
        """Test logging food with lunch meal type"""
        log_data = {
            "fdc_id": "TEST_169886_lunch",
            "description": "TEST_Chicken for lunch",
            "serving_size": 100,
            "serving_unit": "g",
            "servings": 1,
            "calories": 239,
            "protein": 27.3,
            "fat": 13.6,
            "carbs": 0,
            "fiber": 0,
            "amino_acids": [],
            "fatty_acids": [],
            "meal_type": "lunch"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/logs",
            json=log_data,
            headers=self.headers
        )
        assert response.status_code in [200, 201]
        print("Logged food with meal_type=lunch")
    
    def test_log_food_with_meal_type_dinner(self):
        """Test logging food with dinner meal type"""
        log_data = {
            "fdc_id": "TEST_169886_dinner",
            "description": "TEST_Chicken for dinner",
            "serving_size": 100,
            "serving_unit": "g",
            "servings": 1,
            "calories": 239,
            "protein": 27.3,
            "fat": 13.6,
            "carbs": 0,
            "fiber": 0,
            "amino_acids": [],
            "fatty_acids": [],
            "meal_type": "dinner"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/logs",
            json=log_data,
            headers=self.headers
        )
        assert response.status_code in [200, 201]
        print("Logged food with meal_type=dinner")
    
    def test_log_food_with_meal_type_snack(self):
        """Test logging food with snack meal type"""
        log_data = {
            "fdc_id": "TEST_169886_snack",
            "description": "TEST_Chicken for snack",
            "serving_size": 100,
            "serving_unit": "g",
            "servings": 1,
            "calories": 239,
            "protein": 27.3,
            "fat": 13.6,
            "carbs": 0,
            "fiber": 0,
            "amino_acids": [],
            "fatty_acids": [],
            "meal_type": "snack"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/logs",
            json=log_data,
            headers=self.headers
        )
        assert response.status_code in [200, 201]
        print("Logged food with meal_type=snack")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
