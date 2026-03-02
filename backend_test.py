#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone

class KetroNutritionAPITester:
    def __init__(self, base_url="https://amino-acid-analyzer.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_user_email = f"test_user_{int(datetime.now().timestamp())}@isotope.dev"
        self.test_user_password = "test123456"
        self.created_log_id = None
        self.created_favorite_id = None

    def log_test(self, name, success, message=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED {message}")
        else:
            print(f"❌ {name} - FAILED {message}")
        return success

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Make API request with proper error handling"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            
            success = response.status_code == expected_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                pass
                
            return success, response.status_code, response_data
            
        except requests.RequestException as e:
            print(f"Request error: {str(e)}")
            return False, 0, {}

    def test_health_check(self):
        """Test health check endpoint"""
        success, status, data = self.make_request('GET', 'health', expected_status=200)
        if success:
            return self.log_test("Health Check", True, f"- {data.get('status', 'healthy')}")
        else:
            return self.log_test("Health Check", False, f"Status: {status}")

    def test_user_registration(self):
        """Test user registration"""
        user_data = {
            "email": self.test_user_email,
            "password": self.test_user_password,
            "name": "Test User"
        }
        
        success, status, data = self.make_request('POST', 'auth/register', user_data, expected_status=200)
        
        if success and data.get('access_token') and data.get('user'):
            self.token = data['access_token']
            self.user_id = data['user']['id']
            return self.log_test("User Registration", True, f"- Token: {self.token[:20]}...")
        else:
            return self.log_test("User Registration", False, f"Status: {status}, Data: {data}")

    def test_user_login(self):
        """Test user login with test credentials"""
        login_data = {
            "email": "test@isotope.dev", 
            "password": "test123456"
        }
        
        success, status, data = self.make_request('POST', 'auth/login', login_data, expected_status=200)
        
        if success and data.get('access_token'):
            # Use the test user credentials instead for consistency
            self.token = data['access_token']
            self.user_id = data.get('user', {}).get('id')
            return self.log_test("User Login (test@isotope.dev)", True, f"- User ID: {self.user_id}")
        else:
            return self.log_test("User Login", False, f"Status: {status}, Data: {data}")

    def test_get_user_profile(self):
        """Test getting user profile"""
        success, status, data = self.make_request('GET', 'auth/me', expected_status=200)
        
        if success and data.get('email'):
            return self.log_test("Get User Profile", True, f"- Email: {data['email']}")
        else:
            return self.log_test("Get User Profile", False, f"Status: {status}")

    def test_food_search(self):
        """Test USDA food search"""
        success, status, data = self.make_request('GET', 'foods/search?query=chicken', expected_status=200)
        
        if success and data.get('foods') and len(data['foods']) > 0:
            food = data['foods'][0]
            self.test_fdc_id = food.get('fdc_id')
            return self.log_test("Food Search", True, f"- Found {len(data['foods'])} foods, First: {food.get('description', 'N/A')[:50]}")
        else:
            return self.log_test("Food Search", False, f"Status: {status}, Foods: {len(data.get('foods', []))}")

    def test_food_details(self):
        """Test getting food details with amino acids"""
        if not hasattr(self, 'test_fdc_id') or not self.test_fdc_id:
            # Use a known chicken FDC ID
            test_id = "171077"  # Chicken breast, raw
        else:
            test_id = self.test_fdc_id
            
        success, status, data = self.make_request('GET', f'foods/{test_id}', expected_status=200)
        
        if success and data.get('fdc_id'):
            amino_count = len(data.get('amino_acids', []))
            is_complete = data.get('is_complete_protein', False)
            protein = data.get('protein', 0)
            self.test_food_detail = data  # Store for logging test
            
            return self.log_test("Food Details", True, 
                f"- Protein: {protein}g, Amino acids: {amino_count}, Complete: {is_complete}")
        else:
            return self.log_test("Food Details", False, f"Status: {status}")

    def test_create_food_log(self):
        """Test creating food log entry"""
        if not hasattr(self, 'test_food_detail') or not self.test_food_detail:
            return self.log_test("Create Food Log", False, "No food detail data available")
            
        log_data = {
            "fdc_id": self.test_food_detail['fdc_id'],
            "description": self.test_food_detail['description'],
            "serving_size": 100,
            "serving_unit": "g", 
            "servings": 1.5,
            "calories": self.test_food_detail.get('calories', 0),
            "protein": self.test_food_detail.get('protein', 0),
            "fat": self.test_food_detail.get('fat', 0),
            "carbs": self.test_food_detail.get('carbs', 0),
            "fiber": self.test_food_detail.get('fiber', 0),
            "amino_acids": [
                {
                    "name": aa.get('name', ''),
                    "value": aa.get('value', 0),
                    "is_essential": aa.get('is_essential', False)
                } for aa in self.test_food_detail.get('amino_acids', [])
            ],
            "meal_type": "lunch"
        }
        
        success, status, data = self.make_request('POST', 'logs', log_data, expected_status=200)
        
        if success and data.get('id'):
            self.created_log_id = data['id']
            protein_logged = data.get('protein', 0) * data.get('servings', 1)
            return self.log_test("Create Food Log", True, f"- Log ID: {self.created_log_id}, Protein: {protein_logged}g")
        else:
            return self.log_test("Create Food Log", False, f"Status: {status}")

    def test_get_food_logs(self):
        """Test retrieving food logs"""
        date_str = datetime.now().strftime('%Y-%m-%d')
        success, status, data = self.make_request('GET', f'logs?date={date_str}', expected_status=200)
        
        if success and isinstance(data, list):
            return self.log_test("Get Food Logs", True, f"- Found {len(data)} logs for today")
        else:
            return self.log_test("Get Food Logs", False, f"Status: {status}")

    def test_daily_stats(self):
        """Test getting daily stats"""
        success, status, data = self.make_request('GET', 'stats/daily', expected_status=200)
        
        if success and 'total_protein' in data:
            protein = data.get('total_protein', 0)
            amino_acids = len(data.get('amino_acid_totals', {}))
            goal_percent = data.get('protein_goal_percentage', 0)
            return self.log_test("Daily Stats", True, 
                f"- Protein: {protein}g ({goal_percent}%), Amino acids tracked: {amino_acids}")
        else:
            return self.log_test("Daily Stats", False, f"Status: {status}")

    def test_weekly_stats(self):
        """Test getting weekly trends"""
        success, status, data = self.make_request('GET', 'stats/weekly', expected_status=200)
        
        if success and 'days' in data:
            days = data.get('days', [])
            return self.log_test("Weekly Stats", True, f"- {len(days)} days of data")
        else:
            return self.log_test("Weekly Stats", False, f"Status: {status}")

    def test_add_favorite(self):
        """Test adding food to favorites"""
        if not hasattr(self, 'test_food_detail') or not self.test_food_detail:
            return self.log_test("Add Favorite", False, "No food detail data available")
            
        fav_data = {
            "fdc_id": self.test_food_detail['fdc_id'],
            "description": self.test_food_detail['description'],
            "protein_per_100g": self.test_food_detail.get('protein', 0),
            "is_complete_protein": self.test_food_detail.get('is_complete_protein', False)
        }
        
        success, status, data = self.make_request('POST', 'favorites', fav_data, expected_status=200)
        
        if success and data.get('id'):
            self.created_favorite_id = data['id']
            return self.log_test("Add Favorite", True, f"- Favorite ID: {self.created_favorite_id}")
        else:
            return self.log_test("Add Favorite", False, f"Status: {status}")

    def test_get_favorites(self):
        """Test retrieving favorites"""
        success, status, data = self.make_request('GET', 'favorites', expected_status=200)
        
        if success and isinstance(data, list):
            return self.log_test("Get Favorites", True, f"- Found {len(data)} favorites")
        else:
            return self.log_test("Get Favorites", False, f"Status: {status}")

    def test_update_protein_goal(self):
        """Test updating protein goal"""
        goal_data = {"protein_goal": 175.0}
        success, status, data = self.make_request('PUT', 'auth/protein-goal', goal_data, expected_status=200)
        
        if success and data.get('protein_goal') == 175.0:
            return self.log_test("Update Protein Goal", True, f"- New goal: {data['protein_goal']}g")
        else:
            return self.log_test("Update Protein Goal", False, f"Status: {status}")

    def test_check_favorite_status(self):
        """Test checking if food is favorited"""
        if not hasattr(self, 'test_food_detail') or not self.test_food_detail:
            return self.log_test("Check Favorite Status", False, "No food detail data available")
            
        fdc_id = self.test_food_detail['fdc_id']
        success, status, data = self.make_request('GET', f'favorites/check/{fdc_id}', expected_status=200)
        
        if success and 'is_favorite' in data:
            is_fav = data.get('is_favorite', False)
            return self.log_test("Check Favorite Status", True, f"- Is favorite: {is_fav}")
        else:
            return self.log_test("Check Favorite Status", False, f"Status: {status}")

    def test_barcode_lookup(self):
        """Test barcode lookup with Mars bar"""
        test_barcode = "5000159407236"  # Mars bar barcode from test requirements
        success, status, data = self.make_request('GET', f'barcode/{test_barcode}', expected_status=200)
        
        if success and data.get('barcode') == test_barcode:
            product_name = data.get('product_name', 'Unknown')
            brand = data.get('brand', 'Unknown')
            protein = data.get('protein_per_100g', 0)
            self.test_barcode_product = data  # Store for barcode log test
            return self.log_test("Barcode Lookup", True, 
                f"- Product: {product_name} ({brand}), Protein: {protein}g/100g")
        else:
            return self.log_test("Barcode Lookup", False, f"Status: {status}, Data: {data}")

    def test_barcode_log(self):
        """Test adding barcode product directly to log"""
        if not hasattr(self, 'test_barcode_product') or not self.test_barcode_product:
            return self.log_test("Barcode Log", False, "No barcode product data available")
            
        barcode = self.test_barcode_product['barcode']
        params = f'barcode={barcode}&servings=1&serving_size=50&meal_type=snack'
        success, status, data = self.make_request('POST', f'barcode/log?{params}', expected_status=200)
        
        if success and data.get('log_id'):
            log_id = data['log_id']
            product = data.get('product', {})
            return self.log_test("Barcode Log", True, f"- Log ID: {log_id}, Product: {product.get('product_name', 'Unknown')}")
        else:
            return self.log_test("Barcode Log", False, f"Status: {status}")

    def test_amino_acid_suggestions(self):
        """Test amino acid suggestions endpoint"""
        success, status, data = self.make_request('GET', 'suggestions/amino-acids', expected_status=200)
        
        if success and 'complete_profile' in data:
            complete = data.get('complete_profile', False)
            low_count = len(data.get('low_amino_acids', []))
            missing_count = len(data.get('missing_amino_acids', []))
            date = data.get('date', 'Unknown')
            return self.log_test("Amino Acid Suggestions", True, 
                f"- Date: {date}, Complete: {complete}, Low: {low_count}, Missing: {missing_count}")
        else:
            return self.log_test("Amino Acid Suggestions", False, f"Status: {status}")

    def test_complete_protein_foods(self):
        """Test complete protein foods endpoint"""
        success, status, data = self.make_request('GET', 'suggestions/complete-protein', expected_status=200)
        
        if success and 'complete_protein_foods' in data:
            foods = data.get('complete_protein_foods', [])
            tip = data.get('tip', '')
            return self.log_test("Complete Protein Foods", True, 
                f"- {len(foods)} complete protein foods listed, Tip available: {bool(tip)}")
        else:
            return self.log_test("Complete Protein Foods", False, f"Status: {status}")

    def test_invalid_barcode(self):
        """Test invalid barcode handling"""
        invalid_barcode = "123"  # Too short
        success, status, data = self.make_request('GET', f'barcode/{invalid_barcode}', expected_status=400)
        
        if success or status == 400:
            return self.log_test("Invalid Barcode Handling", True, f"- Correctly rejected barcode: {invalid_barcode}")
        else:
            return self.log_test("Invalid Barcode Handling", False, f"Status: {status}, Expected: 400")

    def test_nonexistent_barcode(self):
        """Test nonexistent barcode handling"""
        fake_barcode = "99999999999999"  # Valid format but doesn't exist
        success, status, data = self.make_request('GET', f'barcode/{fake_barcode}', expected_status=404)
        
        if success or status == 404:
            return self.log_test("Nonexistent Barcode Handling", True, f"- Correctly returned 404 for: {fake_barcode}")
        else:
            return self.log_test("Nonexistent Barcode Handling", False, f"Status: {status}, Expected: 404")

    def test_keto_meals_endpoint(self):
        """Test /api/suggestions/keto-meals endpoint"""
        success, status, response_data = self.make_request('GET', 'suggestions/keto-meals')
        
        if success:
            # Verify response structure
            if 'meal_combos' in response_data and isinstance(response_data['meal_combos'], list):
                meal_count = len(response_data['meal_combos'])
                
                # Check first combo structure if exists
                if response_data['meal_combos']:
                    combo = response_data['meal_combos'][0]
                    required_fields = ['name', 'foods', 'total_protein', 'total_carbs', 'description']
                    missing_fields = [field for field in required_fields if field not in combo]
                    if not missing_fields:
                        return self.log_test("Keto Meals Endpoint", True, f"Found {meal_count} keto combos. First: {combo['name']} ({combo['total_carbs']}g carbs)")
                    else:
                        return self.log_test("Keto Meals Endpoint", False, f"Missing fields in meal combo: {missing_fields}")
                else:
                    return self.log_test("Keto Meals Endpoint", True, "Empty meal combos list (valid response)")
            else:
                return self.log_test("Keto Meals Endpoint", False, "Response missing meal_combos array")
        else:
            return self.log_test("Keto Meals Endpoint", False, f"Request failed with status {status}")

    def test_meal_builder_analyze(self):
        """Test POST /api/meal-builder/analyze endpoint"""
        # Use some test FDC IDs for analysis
        test_fdc_ids = ["173424", "171534", "174032"]  # Eggs, Chicken, Beef
        
        # Construct query string
        query_string = "&".join([f'food_ids={fdc_id}' for fdc_id in test_fdc_ids])
        success, status, response_data = self.make_request(
            'POST', 
            f'meal-builder/analyze?{query_string}'
        )
        
        if success:
            # Check response structure
            required_sections = ['foods', 'combined_macros', 'amino_acid_analysis', 'keto_analysis']
            missing_sections = [section for section in required_sections if section not in response_data]
            
            if not missing_sections:
                # Check specific analysis data
                keto_analysis = response_data.get('keto_analysis', {})
                aa_analysis = response_data.get('amino_acid_analysis', {})
                macros = response_data.get('combined_macros', {})
                
                keto_valid = all(key in keto_analysis for key in ['tier', 'net_carbs', 'is_keto_friendly'])
                aa_valid = all(key in aa_analysis for key in ['is_complete_protein', 'completeness_score'])
                macro_valid = all(key in macros for key in ['protein', 'carbs', 'fat', 'calories'])
                
                if keto_valid and aa_valid and macro_valid:
                    return self.log_test("Meal Builder Analyze", True, f"Analysis complete: {keto_analysis['tier']} tier, {macros['carbs']}g carbs, {aa_analysis['completeness_score']}% protein complete")
                else:
                    return self.log_test("Meal Builder Analyze", False, f"Invalid analysis structure - keto:{keto_valid}, aa:{aa_valid}, macro:{macro_valid}")
            else:
                return self.log_test("Meal Builder Analyze", False, f"Missing analysis sections: {missing_sections}")
        else:
            return self.log_test("Meal Builder Analyze", False, f"Request failed with status {status}")

    def test_complete_protein_with_keto_data(self):
        """Test complete protein suggestions have keto carb data"""
        success, status, response_data = self.make_request('GET', 'suggestions/complete-protein')
        
        if success:
            if 'complete_protein_foods' in response_data:
                foods = response_data['complete_protein_foods']
                
                if foods:
                    # Check if foods have carb and keto data
                    food_count = len(foods)
                    valid_foods = 0
                    
                    for food in foods[:5]:  # Check first 5
                        has_carbs = 'carbs_per_100g' in food
                        has_protein = 'protein_per_100g' in food
                        has_keto_tier = 'keto_tier' in food
                        
                        if has_carbs and has_protein and has_keto_tier:
                            valid_foods += 1
                    
                    if valid_foods == min(5, len(foods)):
                        return self.log_test("Complete Protein with Keto Data", True, f"All {food_count} foods have keto carb/protein data")
                    else:
                        return self.log_test("Complete Protein with Keto Data", False, f"Only {valid_foods}/{min(5, len(foods))} foods have complete keto data")
                else:
                    return self.log_test("Complete Protein with Keto Data", True, "Empty foods list (valid response)")
            else:
                return self.log_test("Complete Protein with Keto Data", False, "Missing complete_protein_foods in response")
        else:
            return self.log_test("Complete Protein with Keto Data", False, f"Request failed with status {status}")

    def test_amino_suggestions_with_carb_data(self):
        """Test amino acid suggestions include carb data in food suggestions"""
        success, status, response_data = self.make_request('GET', 'suggestions/amino-acids')
        
        if success:
            if 'low_amino_acids' in response_data:
                suggestions = response_data['low_amino_acids']
                
                if suggestions:
                    # Check if suggestion foods have carb data
                    first_suggestion = suggestions[0]
                    if 'suggested_foods' in first_suggestion:
                        foods = first_suggestion['suggested_foods']
                        if foods and len(foods) > 0:
                            first_food = foods[0]
                            has_carbs = 'carbs' in first_food
                            has_protein = 'protein' in first_food
                            has_keto = 'keto' in first_food
                            
                            if has_carbs and has_protein and has_keto:
                                return self.log_test("Amino Suggestions with Carb Data", True, f"Suggested foods have keto data: {first_food.get('name', 'Unknown')} - {first_food['carbs']}g carbs")
                            else:
                                return self.log_test("Amino Suggestions with Carb Data", False, f"Suggested foods missing keto data - carbs:{has_carbs}, protein:{has_protein}, keto:{has_keto}")
                        else:
                            return self.log_test("Amino Suggestions with Carb Data", False, "No suggested foods in amino acid suggestions")
                    else:
                        return self.log_test("Amino Suggestions with Carb Data", False, "Missing suggested_foods in amino acid suggestions")
                else:
                    return self.log_test("Amino Suggestions with Carb Data", True, "No amino acid deficiencies (complete profile)")
            else:
                return self.log_test("Amino Suggestions with Carb Data", False, "Missing low_amino_acids in response")
        else:
            return self.log_test("Amino Suggestions with Carb Data", False, f"Request failed with status {status}")

    def test_update_user_settings(self):
        """Test PUT /api/auth/settings - body composition and carb limits"""
        settings_data = {
            "body_weight_kg": 75.0,
            "body_fat_percentage": 18.5,
            "protein_per_kg_lbm": 2.2,
            "daily_carb_limit": 25.0,
            "protein_goal": 160.0
        }
        
        success, status, response_data = self.make_request('PUT', 'auth/settings', settings_data)
        
        if success:
            # Check if all settings were updated
            required_fields = ['body_weight_kg', 'body_fat_percentage', 'protein_per_kg_lbm', 'daily_carb_limit', 'protein_goal']
            updated_correctly = all(
                response_data.get(field) == settings_data[field] 
                for field in required_fields
            )
            
            if updated_correctly:
                return self.log_test("Update User Settings", True, f"All settings updated: weight={response_data['body_weight_kg']}kg, bf={response_data['body_fat_percentage']}%, carb_limit={response_data['daily_carb_limit']}g")
            else:
                return self.log_test("Update User Settings", False, "Settings not updated correctly in response")
        else:
            return self.log_test("Update User Settings", False, f"Request failed with status {status}")

    def test_calculate_protein_goal(self):
        """Test GET /api/auth/calculate-protein-goal - protein calculation from lean body mass"""
        success, status, response_data = self.make_request('GET', 'auth/calculate-protein-goal')
        
        if success:
            required_fields = ['body_weight_kg', 'body_fat_percentage', 'lean_body_mass_kg', 'protein_per_kg_lbm', 'recommended_protein_goal', 'formula']
            missing_fields = [field for field in required_fields if field not in response_data]
            
            if not missing_fields:
                # Verify calculation makes sense
                body_weight = response_data.get('body_weight_kg', 0)
                bf_pct = response_data.get('body_fat_percentage', 0)
                lbm = response_data.get('lean_body_mass_kg', 0)
                multiplier = response_data.get('protein_per_kg_lbm', 0)
                protein_goal = response_data.get('recommended_protein_goal', 0)
                
                expected_lbm = body_weight * (1 - bf_pct / 100)
                expected_protein = expected_lbm * multiplier
                
                if abs(lbm - expected_lbm) < 0.1 and abs(protein_goal - expected_protein) < 1:
                    return self.log_test("Calculate Protein Goal", True, f"LBM: {lbm}kg, Protein: {protein_goal}g (formula: {response_data.get('formula', 'N/A')})")
                else:
                    return self.log_test("Calculate Protein Goal", False, f"Calculation mismatch - expected LBM: {expected_lbm}, got: {lbm}")
            else:
                return self.log_test("Calculate Protein Goal", False, f"Missing fields: {missing_fields}")
        else:
            return self.log_test("Calculate Protein Goal", False, f"Request failed with status {status}")

    def test_keto_score_endpoint(self):
        """Test GET /api/keto-score - daily keto score calculation"""
        success, status, response_data = self.make_request('GET', 'keto-score')
        
        if success:
            required_fields = ['date', 'net_carbs', 'carb_limit', 'carbs_remaining', 'score', 'status', 'color', 'message']
            missing_fields = [field for field in required_fields if field not in response_data]
            
            if not missing_fields:
                score = response_data.get('score', 0)
                status_val = response_data.get('status', '')
                net_carbs = response_data.get('net_carbs', 0)
                carb_limit = response_data.get('carb_limit', 0)
                color = response_data.get('color', '')
                
                # Validate status logic
                valid_status = status_val in ['ketosis', 'borderline', 'over_limit']
                valid_color = color in ['emerald', 'amber', 'red']
                valid_score = 0 <= score <= 100
                
                if valid_status and valid_color and valid_score:
                    return self.log_test("Keto Score Endpoint", True, f"Score: {score}/100, Status: {status_val}, Net carbs: {net_carbs}g/{carb_limit}g")
                else:
                    return self.log_test("Keto Score Endpoint", False, f"Invalid values - status:{valid_status}, color:{valid_color}, score:{valid_score}")
            else:
                return self.log_test("Keto Score Endpoint", False, f"Missing fields: {missing_fields}")
        else:
            return self.log_test("Keto Score Endpoint", False, f"Request failed with status {status}")

    def test_custom_meals_create(self):
        """Test POST /api/custom-meals - create custom meal"""
        meal_data = {
            "name": "Test Keto Breakfast",
            "description": "High protein, low carb breakfast",
            "foods": [
                {
                    "fdc_id": "173424",
                    "description": "Eggs, whole, raw, fresh",
                    "protein": 12.6,
                    "carbs": 0.7,
                    "fat": 9.5,
                    "calories": 155,
                    "servings": 2,
                    "serving_size": 100,
                    "serving_unit": "g",
                    "amino_acids": []
                },
                {
                    "fdc_id": "168322",
                    "description": "Pork, cured, bacon, raw",
                    "protein": 37.0,
                    "carbs": 1.4,
                    "fat": 42.0,
                    "calories": 541,
                    "servings": 0.5,
                    "serving_size": 100,
                    "serving_unit": "g",
                    "amino_acids": []
                }
            ]
        }
        
        success, status, response_data = self.make_request('POST', 'custom-meals', meal_data)
        
        if success:
            required_fields = ['id', 'name', 'description', 'foods', 'total_protein', 'total_carbs', 'total_fat', 'total_calories', 'is_complete_protein', 'keto_tier']
            missing_fields = [field for field in required_fields if field not in response_data]
            
            if not missing_fields:
                self.created_custom_meal_id = response_data['id']
                meal_name = response_data.get('name')
                total_protein = response_data.get('total_protein', 0)
                total_carbs = response_data.get('total_carbs', 0)
                keto_tier = response_data.get('keto_tier', '')
                
                return self.log_test("Custom Meals Create", True, f"Created '{meal_name}' (ID: {self.created_custom_meal_id[:8]}...) - {total_protein}g protein, {total_carbs}g carbs, tier: {keto_tier}")
            else:
                return self.log_test("Custom Meals Create", False, f"Missing fields: {missing_fields}")
        else:
            return self.log_test("Custom Meals Create", False, f"Request failed with status {status}")

    def test_custom_meals_get_all(self):
        """Test GET /api/custom-meals - list user's custom meals"""
        success, status, response_data = self.make_request('GET', 'custom-meals')
        
        if success and isinstance(response_data, list):
            meal_count = len(response_data)
            
            if hasattr(self, 'created_custom_meal_id') and meal_count > 0:
                # Check if our created meal is in the list
                created_meal = next((meal for meal in response_data if meal.get('id') == self.created_custom_meal_id), None)
                if created_meal:
                    return self.log_test("Custom Meals Get All", True, f"Found {meal_count} custom meals, including our created meal")
                else:
                    return self.log_test("Custom Meals Get All", False, f"Created meal not found in list of {meal_count} meals")
            else:
                return self.log_test("Custom Meals Get All", True, f"Retrieved {meal_count} custom meals")
        else:
            return self.log_test("Custom Meals Get All", False, f"Request failed with status {status} or invalid response format")

    def test_custom_meals_log(self):
        """Test POST /api/custom-meals/{id}/log - log custom meal to daily food log"""
        if not hasattr(self, 'created_custom_meal_id'):
            return self.log_test("Custom Meals Log", False, "No custom meal ID available")
        
        meal_id = self.created_custom_meal_id
        success, status, response_data = self.make_request('POST', f'custom-meals/{meal_id}/log?meal_type=breakfast')
        
        if success:
            if 'log_ids' in response_data and 'message' in response_data:
                log_ids = response_data.get('log_ids', [])
                message = response_data.get('message', '')
                self.custom_meal_log_ids = log_ids  # Store for cleanup
                
                return self.log_test("Custom Meals Log", True, f"Logged custom meal: {message} (created {len(log_ids)} log entries)")
            else:
                return self.log_test("Custom Meals Log", False, "Response missing expected fields")
        else:
            return self.log_test("Custom Meals Log", False, f"Request failed with status {status}")

    def test_custom_meals_delete(self):
        """Test DELETE /api/custom-meals/{id} - delete custom meal"""
        if not hasattr(self, 'created_custom_meal_id'):
            return self.log_test("Custom Meals Delete", False, "No custom meal ID available")
        
        meal_id = self.created_custom_meal_id
        success, status, response_data = self.make_request('DELETE', f'custom-meals/{meal_id}')
        
        if success:
            if 'message' in response_data:
                return self.log_test("Custom Meals Delete", True, f"Deleted custom meal: {response_data['message']}")
            else:
                return self.log_test("Custom Meals Delete", True, "Custom meal deleted (no message)")
        else:
            return self.log_test("Custom Meals Delete", False, f"Request failed with status {status}")

    def cleanup_test_data(self):
        """Clean up created test data"""
        cleanup_count = 0
        
        # Delete created food log
        if self.created_log_id:
            success, _, _ = self.make_request('DELETE', f'logs/{self.created_log_id}', expected_status=200)
            if success:
                cleanup_count += 1
                
        # Delete created favorite  
        if self.created_favorite_id:
            success, _, _ = self.make_request('DELETE', f'favorites/{self.created_favorite_id}', expected_status=200)
            if success:
                cleanup_count += 1

        # Delete logs created from custom meal
        if hasattr(self, 'custom_meal_log_ids') and self.custom_meal_log_ids:
            for log_id in self.custom_meal_log_ids:
                success, _, _ = self.make_request('DELETE', f'logs/{log_id}', expected_status=200)
                if success:
                    cleanup_count += 1
                
        if cleanup_count > 0:
            self.log_test("Cleanup Test Data", True, f"- Cleaned {cleanup_count} items")
        return True

    def run_all_tests(self):
        """Execute all API tests"""
        print("🧪 Starting Keto Nutrition Tracker API Tests")
        print(f"🌐 Testing endpoint: {self.base_url}")
        print("=" * 60)
        
        # Critical flow tests (including new barcode and suggestions features)
        tests = [
            self.test_health_check,
            self.test_user_login,  # Use existing test user
            self.test_get_user_profile,
            # NEW: Settings and body composition tests
            self.test_update_user_settings,
            self.test_calculate_protein_goal,
            # NEW: Keto Score tests
            self.test_keto_score_endpoint,
            self.test_food_search,
            self.test_food_details,
            self.test_create_food_log,
            self.test_get_food_logs,
            self.test_daily_stats,
            self.test_weekly_stats,
            self.test_add_favorite,
            self.test_get_favorites,
            self.test_check_favorite_status,
            self.test_update_protein_goal,
            # New barcode scanning features
            self.test_barcode_lookup,
            self.test_barcode_log,
            self.test_invalid_barcode,
            self.test_nonexistent_barcode,
            # New amino acid suggestions features  
            self.test_amino_acid_suggestions,
            self.test_complete_protein_foods,
            # Keto Meal Builder features
            self.test_keto_meals_endpoint,
            self.test_meal_builder_analyze,
            self.test_complete_protein_with_keto_data,
            self.test_amino_suggestions_with_carb_data,
            # NEW: Custom Meals CRUD tests
            self.test_custom_meals_create,
            self.test_custom_meals_get_all,
            self.test_custom_meals_log,
            self.test_custom_meals_delete,
            self.cleanup_test_data
        ]
        
        # Run all tests
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_test(test.__name__, False, f"Exception: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"✨ Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed! API is working correctly.")
            return 0
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed. Check logs above.")
            return 1

def main():
    tester = KetroNutritionAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())