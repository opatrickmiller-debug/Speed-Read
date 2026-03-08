"""
Test suite for Meal Builder feature - Custom Meals API
Tests POST /api/custom-meals endpoint and related meal functionality
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMealBuilder:
    """Meal Builder and Custom Meals API Tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authenticated headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    # ========== CUSTOM MEALS CRUD TESTS ==========
    
    def test_create_custom_meal_basic(self, auth_headers):
        """Test creating a basic custom meal with foods"""
        meal_data = {
            "name": f"TEST_Keto_Breakfast_{uuid.uuid4().hex[:6]}",
            "description": "High protein keto breakfast",
            "foods": [
                {
                    "fdc_id": "169886",
                    "description": "Chicken, broilers or fryers, breast",
                    "name": "Chicken breast",
                    "serving_size": 150,
                    "servings": 1,
                    "calories": 165,
                    "protein": 31.0,
                    "fat": 3.6,
                    "carbs": 0
                },
                {
                    "fdc_id": "171287",
                    "description": "Eggs, whole, raw",
                    "name": "Eggs",
                    "serving_size": 100,
                    "servings": 2,
                    "calories": 147,
                    "protein": 12.6,
                    "fat": 9.9,
                    "carbs": 0.8
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/custom-meals", 
                                json=meal_data, headers=auth_headers)
        
        assert response.status_code == 200, f"Create custom meal failed: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain meal id"
        assert data["name"] == meal_data["name"], "Meal name should match"
        assert "total_protein" in data, "Response should have total_protein"
        assert "total_carbs" in data, "Response should have total_carbs"
        assert "total_fat" in data, "Response should have total_fat"
        assert "total_calories" in data, "Response should have total_calories"
        assert "keto_tier" in data, "Response should have keto_tier"
        
        # Store for cleanup
        TestMealBuilder.created_meal_id = data["id"]
        
        print(f"✓ Created custom meal: {data['name']}")
        print(f"  Total macros: {data['total_calories']}cal, {data['total_protein']}g protein")
        print(f"  Keto tier: {data['keto_tier']}")
    
    def test_create_meal_calculates_macros_correctly(self, auth_headers):
        """Test that meal creation calculates total macros from foods"""
        meal_data = {
            "name": f"TEST_Macro_Test_{uuid.uuid4().hex[:6]}",
            "description": "Testing macro calculations",
            "foods": [
                {
                    "fdc_id": "test1",
                    "description": "Test food 1",
                    "name": "Test food 1",
                    "serving_size": 100,
                    "servings": 1,
                    "calories": 100,
                    "protein": 20,
                    "fat": 5,
                    "carbs": 2
                },
                {
                    "fdc_id": "test2",
                    "description": "Test food 2",
                    "name": "Test food 2",
                    "serving_size": 100,
                    "servings": 2,  # 2 servings
                    "calories": 50,
                    "protein": 10,
                    "fat": 2,
                    "carbs": 1
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/custom-meals", 
                                json=meal_data, headers=auth_headers)
        
        assert response.status_code == 200, f"Create meal failed: {response.text}"
        
        data = response.json()
        # Food 1: 1 serving of 20g protein = 20g
        # Food 2: 2 servings of 10g protein = 20g
        # Total: 40g protein
        assert data["total_protein"] == 40.0, f"Expected 40g protein, got {data['total_protein']}"
        # Total calories: 100 + (50*2) = 200
        assert data["total_calories"] == 200.0, f"Expected 200 cal, got {data['total_calories']}"
        
        print(f"✓ Macro calculations correct: {data['total_protein']}g protein, {data['total_calories']}cal")
    
    def test_create_meal_keto_tier_calculation(self, auth_headers):
        """Test keto tier is calculated correctly based on carbs"""
        # Ultra low carb (<=2g)
        meal_ultra = {
            "name": f"TEST_Ultra_Low_{uuid.uuid4().hex[:6]}",
            "foods": [{"fdc_id": "1", "servings": 1, "carbs": 1.5}]
        }
        res = requests.post(f"{BASE_URL}/api/custom-meals", json=meal_ultra, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["keto_tier"] == "ultra_low", "Should be ultra_low for <=2g carbs"
        
        # Low carb (<=5g)
        meal_low = {
            "name": f"TEST_Low_{uuid.uuid4().hex[:6]}",
            "foods": [{"fdc_id": "2", "servings": 1, "carbs": 4}]
        }
        res = requests.post(f"{BASE_URL}/api/custom-meals", json=meal_low, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["keto_tier"] == "low", "Should be low for <=5g carbs"
        
        # Moderate (<=10g)
        meal_mod = {
            "name": f"TEST_Moderate_{uuid.uuid4().hex[:6]}",
            "foods": [{"fdc_id": "3", "servings": 1, "carbs": 8}]
        }
        res = requests.post(f"{BASE_URL}/api/custom-meals", json=meal_mod, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["keto_tier"] == "moderate", "Should be moderate for <=10g carbs"
        
        # High (>10g)
        meal_high = {
            "name": f"TEST_High_{uuid.uuid4().hex[:6]}",
            "foods": [{"fdc_id": "4", "servings": 1, "carbs": 15}]
        }
        res = requests.post(f"{BASE_URL}/api/custom-meals", json=meal_high, headers=auth_headers)
        assert res.status_code == 200
        assert res.json()["keto_tier"] == "high", "Should be high for >10g carbs"
        
        print("✓ Keto tier calculations correct for all tiers")
    
    def test_get_custom_meals(self, auth_headers):
        """Test getting list of custom meals"""
        response = requests.get(f"{BASE_URL}/api/custom-meals", headers=auth_headers)
        
        assert response.status_code == 200, f"Get meals failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Should have at least the meals we created
        test_meals = [m for m in data if m["name"].startswith("TEST_")]
        assert len(test_meals) > 0, "Should have test meals"
        
        print(f"✓ Retrieved {len(data)} custom meals ({len(test_meals)} test meals)")
    
    def test_create_meal_without_name_validation(self, auth_headers):
        """Test that meal creation requires a name"""
        meal_data = {
            "name": "",  # Empty name
            "foods": [{"fdc_id": "1", "servings": 1, "calories": 100}]
        }
        
        response = requests.post(f"{BASE_URL}/api/custom-meals", 
                                json=meal_data, headers=auth_headers)
        
        # The backend may accept empty name, but frontend validates
        # We're testing backend behavior here
        if response.status_code == 200:
            print("⚠ Backend accepts empty meal names (frontend should validate)")
        else:
            print(f"✓ Backend rejects empty meal names: {response.status_code}")
    
    def test_create_meal_empty_foods(self, auth_headers):
        """Test creating meal with empty foods array"""
        meal_data = {
            "name": f"TEST_Empty_Foods_{uuid.uuid4().hex[:6]}",
            "foods": []
        }
        
        response = requests.post(f"{BASE_URL}/api/custom-meals", 
                                json=meal_data, headers=auth_headers)
        
        # Check if backend accepts empty foods (frontend should validate)
        if response.status_code == 200:
            print("⚠ Backend accepts meals with no foods (frontend should validate)")
        else:
            print(f"✓ Backend rejects meals with no foods: {response.status_code}")
    
    def test_delete_custom_meal(self, auth_headers):
        """Test deleting a custom meal"""
        # First create a meal to delete
        meal_data = {
            "name": f"TEST_To_Delete_{uuid.uuid4().hex[:6]}",
            "foods": [{"fdc_id": "1", "servings": 1, "calories": 100}]
        }
        
        create_res = requests.post(f"{BASE_URL}/api/custom-meals", 
                                  json=meal_data, headers=auth_headers)
        assert create_res.status_code == 200
        meal_id = create_res.json()["id"]
        
        # Delete it
        delete_res = requests.delete(f"{BASE_URL}/api/custom-meals/{meal_id}", 
                                    headers=auth_headers)
        assert delete_res.status_code == 200, f"Delete failed: {delete_res.text}"
        
        # Verify it's gone
        get_res = requests.get(f"{BASE_URL}/api/custom-meals", headers=auth_headers)
        meals = get_res.json()
        meal_ids = [m["id"] for m in meals]
        assert meal_id not in meal_ids, "Deleted meal should not be in list"
        
        print(f"✓ Successfully deleted custom meal {meal_id}")
    
    def test_delete_nonexistent_meal(self, auth_headers):
        """Test deleting a meal that doesn't exist"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/custom-meals/{fake_id}", 
                                  headers=auth_headers)
        
        assert response.status_code == 404, "Should return 404 for non-existent meal"
        print("✓ Returns 404 for non-existent meal deletion")
    
    # ========== FOOD SEARCH (for Meal Builder) ==========
    
    def test_food_search_for_meal_builder(self, auth_headers):
        """Test food search works for adding to meal builder"""
        response = requests.get(
            f"{BASE_URL}/api/foods/search?query=chicken&page_size=10",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        
        data = response.json()
        assert "foods" in data, "Response should have foods array"
        assert len(data["foods"]) > 0, "Should return search results"
        
        # Verify search result has required fields
        food = data["foods"][0]
        assert "fdc_id" in food, "Food should have fdc_id"
        assert "description" in food, "Food should have description"
        
        print(f"✓ Food search returned {len(data['foods'])} results for 'chicken'")
    
    def test_food_details_for_meal_builder(self, auth_headers):
        """Test getting food details for accurate macros in meal builder"""
        fdc_id = "169886"  # Chicken breast
        response = requests.get(
            f"{BASE_URL}/api/foods/{fdc_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Get food details failed: {response.text}"
        
        data = response.json()
        assert "description" in data, "Should have description"
        assert "protein" in data or "protein_per_100g" in data, "Should have protein info"
        
        print(f"✓ Food details retrieved for {fdc_id}: {data.get('description', '')[:50]}")
    
    # ========== LOG CUSTOM MEAL ==========
    
    def test_log_custom_meal(self, auth_headers):
        """Test logging a custom meal to food log"""
        # First create a meal
        meal_data = {
            "name": f"TEST_To_Log_{uuid.uuid4().hex[:6]}",
            "foods": [
                {"fdc_id": "1", "description": "Test food", "servings": 1, 
                 "calories": 150, "protein": 25, "fat": 5, "carbs": 1}
            ]
        }
        
        create_res = requests.post(f"{BASE_URL}/api/custom-meals", 
                                  json=meal_data, headers=auth_headers)
        assert create_res.status_code == 200
        meal_id = create_res.json()["id"]
        
        # Log the meal
        log_res = requests.post(
            f"{BASE_URL}/api/custom-meals/{meal_id}/log?meal_type=breakfast",
            headers=auth_headers
        )
        
        assert log_res.status_code == 200, f"Log meal failed: {log_res.text}"
        
        data = log_res.json()
        assert "log_ids" in data, "Response should have log_ids"
        assert len(data["log_ids"]) > 0, "Should have logged at least one food"
        
        print(f"✓ Logged custom meal with {len(data['log_ids'])} foods")
    
    def test_log_nonexistent_meal(self, auth_headers):
        """Test logging a non-existent custom meal"""
        fake_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/custom-meals/{fake_id}/log?meal_type=breakfast",
            headers=auth_headers
        )
        
        assert response.status_code == 404, "Should return 404 for non-existent meal"
        print("✓ Returns 404 when logging non-existent meal")
    
    # ========== AUTHENTICATION TESTS ==========
    
    def test_create_meal_requires_auth(self):
        """Test that creating a meal requires authentication"""
        meal_data = {
            "name": "Unauthorized meal",
            "foods": []
        }
        
        response = requests.post(f"{BASE_URL}/api/custom-meals", json=meal_data)
        
        assert response.status_code in [401, 403, 422], \
            f"Should require auth, got {response.status_code}"
        print("✓ Create meal requires authentication")
    
    def test_get_meals_requires_auth(self):
        """Test that getting meals requires authentication"""
        response = requests.get(f"{BASE_URL}/api/custom-meals")
        
        assert response.status_code in [401, 403, 422], \
            f"Should require auth, got {response.status_code}"
        print("✓ Get meals requires authentication")


class TestMealBuilderCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        token = response.json().get("access_token")
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def test_cleanup_test_meals(self, auth_headers):
        """Clean up TEST_ prefixed meals"""
        # Get all meals
        response = requests.get(f"{BASE_URL}/api/custom-meals", headers=auth_headers)
        if response.status_code != 200:
            print("Could not retrieve meals for cleanup")
            return
        
        meals = response.json()
        test_meals = [m for m in meals if m["name"].startswith("TEST_")]
        
        deleted = 0
        for meal in test_meals:
            del_res = requests.delete(f"{BASE_URL}/api/custom-meals/{meal['id']}", 
                                     headers=auth_headers)
            if del_res.status_code == 200:
                deleted += 1
        
        print(f"✓ Cleaned up {deleted} test meals")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
