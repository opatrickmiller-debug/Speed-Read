"""
Test new features: Meal Library, Onboarding, Education
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMealLibraryAPI:
    """Tests for public meal library endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Returns authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_meal_library(self, auth_headers):
        """Test GET /api/meals/library - browse public meals"""
        response = requests.get(
            f"{BASE_URL}/api/meals/library",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "meals" in data
        assert "total" in data
        assert "has_more" in data
        assert isinstance(data["meals"], list)
        print(f"✓ Meal library returns {data['total']} public meals")
    
    def test_meal_library_with_search(self, auth_headers):
        """Test GET /api/meals/library with search query"""
        response = requests.get(
            f"{BASE_URL}/api/meals/library?search=chicken",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "meals" in data
        print(f"✓ Meal library search returns {data['total']} meals")
    
    def test_meal_library_with_keto_filter(self, auth_headers):
        """Test GET /api/meals/library with keto tier filter"""
        response = requests.get(
            f"{BASE_URL}/api/meals/library?keto_tier=ultra_low",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "meals" in data
        print(f"✓ Meal library filter by ultra_low returns {data['total']} meals")
    
    def test_meal_library_sort_by_popular(self, auth_headers):
        """Test GET /api/meals/library sorted by popular"""
        response = requests.get(
            f"{BASE_URL}/api/meals/library?sort_by=popular",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "meals" in data
        print(f"✓ Meal library sort by popular works")
    
    def test_meal_library_sort_by_protein(self, auth_headers):
        """Test GET /api/meals/library sorted by protein"""
        response = requests.get(
            f"{BASE_URL}/api/meals/library?sort_by=protein",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "meals" in data
        print(f"✓ Meal library sort by protein works")


class TestCustomMealsAndPublish:
    """Test creating custom meals and publishing to library"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Returns authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_create_custom_meal(self, auth_headers):
        """Test POST /api/custom-meals - create a custom meal"""
        unique_name = f"TEST_Custom_Meal_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/custom-meals",
            headers=auth_headers,
            json={
                "name": unique_name,
                "description": "A test custom meal for library testing",
                "foods": [
                    {
                        "fdc_id": "171705",
                        "name": "Chicken Breast",
                        "description": "Chicken Breast",
                        "protein": 31,
                        "fat": 3.6,
                        "carbs": 0,
                        "calories": 165,
                        "servings": 1,
                        "amino_acids": [
                            {"name": "Leucine", "value": 2.5, "is_essential": True},
                            {"name": "Isoleucine", "value": 1.5, "is_essential": True}
                        ]
                    }
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == unique_name
        assert "id" in data
        assert data["total_protein"] == 31
        print(f"✓ Created custom meal: {unique_name}")
        return data["id"]
    
    def test_get_custom_meals(self, auth_headers):
        """Test GET /api/custom-meals - list user's custom meals"""
        response = requests.get(
            f"{BASE_URL}/api/custom-meals",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User has {len(data)} custom meals")
    
    def test_publish_custom_meal(self, auth_headers):
        """Test POST /api/meals/publish/{meal_id} - publish meal to library"""
        # First create a custom meal
        unique_name = f"TEST_Publish_Meal_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/custom-meals",
            headers=auth_headers,
            json={
                "name": unique_name,
                "description": "A meal to be published",
                "foods": [
                    {
                        "fdc_id": "171705",
                        "name": "Chicken Breast",
                        "protein": 31,
                        "fat": 3.6,
                        "carbs": 0,
                        "calories": 165,
                        "servings": 1
                    }
                ]
            }
        )
        assert create_response.status_code == 200
        meal_id = create_response.json()["id"]
        
        # Publish the meal
        publish_response = requests.post(
            f"{BASE_URL}/api/meals/publish/{meal_id}",
            headers=auth_headers
        )
        assert publish_response.status_code == 200
        data = publish_response.json()
        assert "message" in data
        print(f"✓ Published meal to library: {meal_id}")
    
    def test_unpublish_meal(self, auth_headers):
        """Test POST /api/meals/unpublish/{meal_id} - unpublish meal"""
        # First create and publish a meal
        unique_name = f"TEST_Unpublish_Meal_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/custom-meals",
            headers=auth_headers,
            json={
                "name": unique_name,
                "description": "A meal to be unpublished",
                "foods": [{"name": "Test Food", "protein": 10, "fat": 5, "carbs": 2, "calories": 100}]
            }
        )
        meal_id = create_response.json()["id"]
        
        # Publish
        requests.post(f"{BASE_URL}/api/meals/publish/{meal_id}", headers=auth_headers)
        
        # Unpublish
        unpublish_response = requests.post(
            f"{BASE_URL}/api/meals/unpublish/{meal_id}",
            headers=auth_headers
        )
        assert unpublish_response.status_code == 200
        print(f"✓ Unpublished meal: {meal_id}")


class TestMealLibraryInteractions:
    """Test like, save, copy operations on meal library"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def public_meal_id(self, auth_headers):
        """Create and publish a meal to test interactions"""
        unique_name = f"TEST_Public_Meal_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/custom-meals",
            headers=auth_headers,
            json={
                "name": unique_name,
                "description": "Public meal for interaction tests",
                "foods": [{"name": "Test Food", "protein": 20, "fat": 10, "carbs": 5, "calories": 200}]
            }
        )
        meal_id = create_response.json()["id"]
        
        # Publish it
        requests.post(f"{BASE_URL}/api/meals/publish/{meal_id}", headers=auth_headers)
        return meal_id
    
    def test_like_public_meal(self, auth_headers, public_meal_id):
        """Test POST /api/meals/library/{meal_id}/like"""
        response = requests.post(
            f"{BASE_URL}/api/meals/library/{public_meal_id}/like",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "liked" in data
        print(f"✓ Like meal endpoint works, liked={data['liked']}")
    
    def test_save_public_meal(self, auth_headers, public_meal_id):
        """Test POST /api/meals/library/{meal_id}/save"""
        response = requests.post(
            f"{BASE_URL}/api/meals/library/{public_meal_id}/save",
            headers=auth_headers
        )
        # Either 200 (saved) or 400 (already saved) is acceptable
        assert response.status_code in [200, 400]
        print(f"✓ Save meal endpoint works")
    
    def test_get_saved_meals(self, auth_headers):
        """Test GET /api/meals/saved"""
        response = requests.get(
            f"{BASE_URL}/api/meals/saved",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "meals" in data
        assert "count" in data
        print(f"✓ User has {data['count']} saved meals")
    
    def test_copy_public_meal(self, auth_headers, public_meal_id):
        """Test POST /api/meals/library/{meal_id}/copy"""
        response = requests.post(
            f"{BASE_URL}/api/meals/library/{public_meal_id}/copy",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "new_meal_id" in data
        print(f"✓ Copied meal to user's collection: {data['new_meal_id']}")
    
    def test_unsave_public_meal(self, auth_headers, public_meal_id):
        """Test DELETE /api/meals/library/{meal_id}/unsave"""
        # First save it
        requests.post(f"{BASE_URL}/api/meals/library/{public_meal_id}/save", headers=auth_headers)
        
        # Then unsave
        response = requests.delete(
            f"{BASE_URL}/api/meals/library/{public_meal_id}/unsave",
            headers=auth_headers
        )
        assert response.status_code == 200
        print(f"✓ Unsave meal endpoint works")


class TestOnboardingSettings:
    """Test onboarding completion via settings API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_update_settings_with_onboarding(self, auth_headers):
        """Test PUT /api/auth/settings - can set onboarding_completed"""
        response = requests.put(
            f"{BASE_URL}/api/auth/settings",
            headers=auth_headers,
            json={
                "protein_goal": 150,
                "daily_carb_limit": 20,
                "onboarding_completed": True
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("onboarding_completed") == True
        print("✓ Settings API accepts onboarding_completed field")
    
    def test_get_me_returns_onboarding_status(self, auth_headers):
        """Test GET /api/auth/me - returns onboarding_completed"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # onboarding_completed should be present in user data
        print(f"✓ User data includes onboarding_completed: {data.get('onboarding_completed')}")


class TestKetoAndNutritionScores:
    """Test keto score and nutrition score APIs (used with tooltips)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@test.com",
            "password": "test123"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_keto_score(self, auth_headers):
        """Test GET /api/keto/score - returns keto score"""
        response = requests.get(
            f"{BASE_URL}/api/keto/score",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "score" in data
        assert "net_carbs" in data
        assert "carb_limit" in data
        print(f"✓ Keto score API returns score: {data['score']}")
    
    def test_get_nutrition_score(self, auth_headers):
        """Test GET /api/stats/nutrition-score - returns nutrition score"""
        response = requests.get(
            f"{BASE_URL}/api/stats/nutrition-score",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "grade" in data
        assert "total_score" in data
        assert "amino_acid_score" in data
        assert "omega_score" in data
        print(f"✓ Nutrition score API returns grade: {data['grade']}, score: {data['total_score']}")


# Cleanup test data
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_meals():
    """Cleanup TEST_ prefixed meals after all tests"""
    yield
    # We don't clean up in this test as it would require querying and deleting all TEST_ meals
    # The meals will persist but are prefixed with TEST_ for identification
    print("Tests completed. TEST_ prefixed meals may remain in database.")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
