"""
Test Custom Foods CRUD Operations
Testing: Create, Read, Update, Delete custom food entries
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    BASE_URL = "https://meal-builder-pro.preview.emergentagent.com"

class TestCustomFoodsCRUD:
    """Test custom foods CRUD endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token before each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        
        token = login_res.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_food_ids = []
        
        yield
        
        # Cleanup: Delete all test-created foods
        for food_id in self.created_food_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/custom-foods/{food_id}")
            except:
                pass
    
    def test_get_custom_foods_list(self):
        """Test GET /api/custom-foods returns list"""
        response = self.session.get(f"{BASE_URL}/api/custom-foods")
        assert response.status_code == 200, f"Failed to get custom foods: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/custom-foods returned {len(data)} foods")
    
    def test_create_custom_food(self):
        """Test POST /api/custom-foods creates a new food"""
        test_id = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_Keto Fat Bomb {test_id}",
            "brand": "Homemade",
            "serving_size": 30,
            "serving_unit": "g",
            "calories": 250,
            "protein": 5,
            "fat": 25,
            "carbs": 2,
            "fiber": 1,
            "sugar": 0,
            "sodium": 50,
            "notes": "Test custom food entry"
        }
        
        response = self.session.post(f"{BASE_URL}/api/custom-foods", json=payload)
        assert response.status_code == 200, f"Failed to create food: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have id"
        assert data["name"] == payload["name"], "Name should match"
        assert data["brand"] == payload["brand"], "Brand should match"
        assert data["calories"] == payload["calories"], "Calories should match"
        assert data["protein"] == payload["protein"], "Protein should match"
        assert data["fat"] == payload["fat"], "Fat should match"
        assert data["carbs"] == payload["carbs"], "Carbs should match"
        
        self.created_food_ids.append(data["id"])
        print(f"✓ Created custom food: {data['name']} (ID: {data['id']})")
        
        return data["id"]
    
    def test_create_and_get_custom_food(self):
        """Test creating a food and then fetching it"""
        test_id = str(uuid.uuid4())[:8]
        
        # Create food
        payload = {
            "name": f"TEST_Protein Bar {test_id}",
            "brand": "MyBrand",
            "serving_size": 50,
            "serving_unit": "g",
            "calories": 200,
            "protein": 20,
            "fat": 8,
            "carbs": 4,
            "fiber": 2
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/custom-foods", json=payload)
        assert create_res.status_code == 200, f"Failed to create: {create_res.text}"
        
        food_id = create_res.json()["id"]
        self.created_food_ids.append(food_id)
        
        # Fetch the food
        get_res = self.session.get(f"{BASE_URL}/api/custom-foods/{food_id}")
        assert get_res.status_code == 200, f"Failed to get food: {get_res.text}"
        
        fetched = get_res.json()
        assert fetched["id"] == food_id, "ID should match"
        assert fetched["name"] == payload["name"], "Name should match"
        assert fetched["protein"] == payload["protein"], "Protein should match"
        
        print(f"✓ Create → GET verified for food: {fetched['name']}")
    
    def test_update_custom_food(self):
        """Test PUT /api/custom-foods/{id} updates a food"""
        test_id = str(uuid.uuid4())[:8]
        
        # First create a food
        create_payload = {
            "name": f"TEST_Original Name {test_id}",
            "brand": "Original Brand",
            "serving_size": 100,
            "serving_unit": "g",
            "calories": 100,
            "protein": 10,
            "fat": 5,
            "carbs": 5,
            "fiber": 0
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/custom-foods", json=create_payload)
        assert create_res.status_code == 200
        food_id = create_res.json()["id"]
        self.created_food_ids.append(food_id)
        
        # Update the food
        update_payload = {
            "name": f"TEST_Updated Name {test_id}",
            "brand": "Updated Brand",
            "serving_size": 100,
            "serving_unit": "g",
            "calories": 150,
            "protein": 15,
            "fat": 8,
            "carbs": 3,
            "fiber": 1,
            "notes": "Updated with notes"
        }
        
        update_res = self.session.put(f"{BASE_URL}/api/custom-foods/{food_id}", json=update_payload)
        assert update_res.status_code == 200, f"Failed to update: {update_res.text}"
        
        updated = update_res.json()
        assert updated["name"] == update_payload["name"], "Name should be updated"
        assert updated["calories"] == update_payload["calories"], "Calories should be updated"
        assert updated["protein"] == update_payload["protein"], "Protein should be updated"
        
        # Verify with GET
        get_res = self.session.get(f"{BASE_URL}/api/custom-foods/{food_id}")
        assert get_res.status_code == 200
        fetched = get_res.json()
        assert fetched["name"] == update_payload["name"], "GET should return updated name"
        assert fetched["protein"] == update_payload["protein"], "GET should return updated protein"
        
        print(f"✓ Update → GET verified for food ID: {food_id}")
    
    def test_delete_custom_food(self):
        """Test DELETE /api/custom-foods/{id} removes a food"""
        test_id = str(uuid.uuid4())[:8]
        
        # Create a food to delete
        create_payload = {
            "name": f"TEST_To Delete {test_id}",
            "serving_size": 100,
            "serving_unit": "g",
            "calories": 50,
            "protein": 5,
            "fat": 2,
            "carbs": 3,
            "fiber": 0
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/custom-foods", json=create_payload)
        assert create_res.status_code == 200
        food_id = create_res.json()["id"]
        
        # Delete the food
        delete_res = self.session.delete(f"{BASE_URL}/api/custom-foods/{food_id}")
        assert delete_res.status_code == 200, f"Failed to delete: {delete_res.text}"
        
        # Verify it's gone
        get_res = self.session.get(f"{BASE_URL}/api/custom-foods/{food_id}")
        assert get_res.status_code == 404, "Deleted food should return 404"
        
        print(f"✓ Delete → GET 404 verified for food ID: {food_id}")
    
    def test_delete_nonexistent_food_returns_404(self):
        """Test DELETE for non-existent food returns 404"""
        fake_id = str(uuid.uuid4())
        delete_res = self.session.delete(f"{BASE_URL}/api/custom-foods/{fake_id}")
        assert delete_res.status_code == 404, "Should return 404 for non-existent food"
        print("✓ DELETE non-existent food returns 404")
    
    def test_create_food_name_required(self):
        """Test that name is required when creating food"""
        payload = {
            "brand": "TestBrand",
            "calories": 100,
            "protein": 10,
            "fat": 5,
            "carbs": 5
        }
        
        response = self.session.post(f"{BASE_URL}/api/custom-foods", json=payload)
        # Should fail validation (422 for Pydantic validation error)
        assert response.status_code == 422, f"Should fail without name, got {response.status_code}"
        print("✓ Create food requires name field")


class TestCustomFoodsInSearch:
    """Test custom foods appearing in unified search"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_res = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        
        token = login_res.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.created_food_ids = []
        
        yield
        
        # Cleanup
        for food_id in self.created_food_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/custom-foods/{food_id}")
            except:
                pass
    
    def test_custom_food_appears_in_search(self):
        """Test that custom foods appear in unified search with source=custom"""
        test_id = str(uuid.uuid4())[:8]
        unique_name = f"TEST_UniqueSearchable{test_id}"
        
        # Create a custom food with unique name
        create_payload = {
            "name": unique_name,
            "brand": "TestSearchBrand",
            "serving_size": 100,
            "serving_unit": "g",
            "calories": 200,
            "protein": 25,
            "fat": 10,
            "carbs": 5,
            "fiber": 2
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/custom-foods", json=create_payload)
        assert create_res.status_code == 200
        food_id = create_res.json()["id"]
        self.created_food_ids.append(food_id)
        
        # Search for the custom food
        search_res = self.session.get(f"{BASE_URL}/api/foods/search", params={
            "query": unique_name,
            "source": "custom"
        })
        assert search_res.status_code == 200, f"Search failed: {search_res.text}"
        
        data = search_res.json()
        foods = data.get("foods", [])
        
        # Find our custom food
        custom_food = next((f for f in foods if unique_name in f.get("description", "")), None)
        assert custom_food is not None, f"Custom food not found in search results. Foods: {foods}"
        assert custom_food["source"] == "custom", "Source should be 'custom'"
        assert custom_food["fdc_id"].startswith("custom:"), "fdc_id should start with 'custom:'"
        
        print(f"✓ Custom food appears in search with source='custom'")
    
    def test_custom_food_details_via_search_id(self):
        """Test that custom food details can be fetched via unified endpoint"""
        test_id = str(uuid.uuid4())[:8]
        
        # Create a custom food
        create_payload = {
            "name": f"TEST_DetailTest {test_id}",
            "brand": "DetailBrand",
            "serving_size": 50,
            "serving_unit": "g",
            "calories": 120,
            "protein": 12,
            "fat": 6,
            "carbs": 4,
            "fiber": 1,
            "notes": "Test notes for detail check"
        }
        
        create_res = self.session.post(f"{BASE_URL}/api/custom-foods", json=create_payload)
        assert create_res.status_code == 200
        food_id = create_res.json()["id"]
        self.created_food_ids.append(food_id)
        
        # Get details via unified endpoint with custom: prefix
        detail_res = self.session.get(f"{BASE_URL}/api/foods/custom:{food_id}")
        assert detail_res.status_code == 200, f"Failed to get details: {detail_res.text}"
        
        details = detail_res.json()
        assert details["source"] == "custom", "Source should be 'custom'"
        assert details["description"] == create_payload["name"], "Name should match"
        assert details["protein"] == create_payload["protein"], "Protein should match"
        assert details["calories"] == create_payload["calories"], "Calories should match"
        assert details.get("notes") == create_payload["notes"], "Notes should match"
        assert details.get("has_amino_acids") == False, "Custom foods don't have amino acid data"
        
        print(f"✓ Custom food details fetched via unified endpoint")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
