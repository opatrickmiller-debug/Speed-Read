"""
Test suite for Food Search and Food Details features
Tests:
1. Search API with ranking (Foundation/SR Legacy foods first)
2. Food details endpoint (/api/foods/{fdc_id})
3. Add to log functionality
4. Favorites API
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFoodSearchAPI:
    """Test the unified food search API with ranking logic"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_search_eggs_returns_results(self):
        """Test that searching 'eggs' returns results"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=eggs&page_size=10",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "foods" in data
        assert len(data["foods"]) > 0
        print(f"Found {len(data['foods'])} results for 'eggs'")
    
    def test_search_prioritizes_foundation_sr_legacy(self):
        """Test that Foundation and SR Legacy foods are ranked first"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=chicken&page_size=20",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        foods = data["foods"]
        assert len(foods) > 0
        
        # Check first few results have amino acid data (Foundation/SR Legacy)
        foundation_sr_count = 0
        for food in foods[:5]:
            if food.get("has_amino_acids") or food.get("data_type") in ["Foundation", "SR Legacy"]:
                foundation_sr_count += 1
        
        # At least 3 of top 5 should have amino acid data
        assert foundation_sr_count >= 3, f"Only {foundation_sr_count} of top 5 have amino acid data"
        print(f"SUCCESS: {foundation_sr_count}/5 top results have amino acid data")
    
    def test_search_response_structure(self):
        """Test the search response has expected fields"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=salmon&page_size=5",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "foods" in data
        assert "total_hits" in data
        assert "current_page" in data
        
        # Check food item structure
        if data["foods"]:
            food = data["foods"][0]
            assert "fdc_id" in food
            assert "description" in food
            assert "source" in food
            assert "protein_per_100g" in food


class TestFoodDetailsAPI:
    """Test the food details endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and find a valid food ID"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get a valid food ID from search
        search_response = requests.get(
            f"{BASE_URL}/api/foods/search?query=chicken&page_size=5",
            headers=self.headers
        )
        if search_response.status_code == 200 and search_response.json()["foods"]:
            self.valid_fdc_id = search_response.json()["foods"][0]["fdc_id"]
        else:
            self.valid_fdc_id = "174608"  # Fallback to known good ID
    
    def test_get_food_details_success(self):
        """Test getting food details returns proper data"""
        response = requests.get(
            f"{BASE_URL}/api/foods/{self.valid_fdc_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get food details: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "description" in data
        assert "protein" in data or "protein" in str(data)
        assert "calories" in data or "calories" in str(data)
        print(f"SUCCESS: Got details for {data.get('description', 'Unknown')}")
    
    def test_food_details_has_macros(self):
        """Test food details includes macros (protein, fat, carbs, calories)"""
        response = requests.get(
            f"{BASE_URL}/api/foods/{self.valid_fdc_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check macros are present
        assert data.get("protein") is not None, "Missing protein"
        assert data.get("fat") is not None, "Missing fat"
        assert data.get("carbs") is not None, "Missing carbs"
        assert data.get("calories") is not None, "Missing calories"
        
        print(f"Macros: P={data['protein']}g, F={data['fat']}g, C={data['carbs']}g, Cal={data['calories']}")
    
    def test_food_details_amino_acids(self):
        """Test food details includes amino acids for SR Legacy/Foundation foods"""
        # Use a known SR Legacy food with amino acid data
        response = requests.get(
            f"{BASE_URL}/api/foods/174608",  # Chicken breast, roll
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for amino acids
        assert "amino_acids" in data, "Missing amino_acids field"
        if data.get("has_amino_acids"):
            assert len(data["amino_acids"]) > 0, "has_amino_acids=True but empty array"
            print(f"Found {len(data['amino_acids'])} amino acids")
    
    def test_food_details_fatty_acids(self):
        """Test food details includes fatty acids for foods that have them"""
        response = requests.get(
            f"{BASE_URL}/api/foods/174608",  # Chicken breast, roll
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for fatty acids
        assert "fatty_acids" in data, "Missing fatty_acids field"
        if data.get("has_fatty_acids"):
            assert len(data["fatty_acids"]) > 0, "has_fatty_acids=True but empty array"
            print(f"Found {len(data['fatty_acids'])} fatty acids")
    
    def test_food_not_found_returns_404(self):
        """Test that invalid food ID returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/foods/invalid_food_id_12345",
            headers=self.headers
        )
        # Should return 404 for non-existent food
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestAddToLogAPI:
    """Test the food logging functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_add_food_to_log(self):
        """Test adding a food to the daily log"""
        log_data = {
            "fdc_id": "174608",
            "description": "TEST_Chicken breast, roll, oven-roasted",
            "serving_size": 100,
            "serving_unit": "g",
            "servings": 1.5,
            "calories": 134,
            "protein": 14.59,
            "fat": 7.7,
            "carbs": 1.8,
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
        assert response.status_code in [200, 201], f"Failed to add log: {response.text}"
        data = response.json()
        assert "id" in data, "Log response missing ID"
        print(f"SUCCESS: Created food log entry with ID {data['id']}")


class TestFavoritesAPI:
    """Test the favorites functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_check_favorite_status(self):
        """Test checking if a food is favorited"""
        response = requests.get(
            f"{BASE_URL}/api/favorites/check/174608",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "is_favorite" in data
        print(f"Favorite status for 174608: {data['is_favorite']}")
    
    def test_add_to_favorites(self):
        """Test adding a food to favorites"""
        fav_data = {
            "fdc_id": "TEST_174608",
            "description": "TEST_Chicken breast, roll, oven-roasted",
            "protein_per_100g": 14.59,
            "is_complete_protein": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/favorites",
            json=fav_data,
            headers=self.headers
        )
        # May be 200/201 for new, or 409 if already exists
        assert response.status_code in [200, 201, 409], f"Unexpected status: {response.status_code}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "id" in data
            print(f"SUCCESS: Added to favorites with ID {data['id']}")
            
            # Clean up - delete the test favorite
            fav_id = data["id"]
            delete_response = requests.delete(
                f"{BASE_URL}/api/favorites/{fav_id}",
                headers=self.headers
            )
            print(f"Cleanup: Deleted favorite {fav_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
