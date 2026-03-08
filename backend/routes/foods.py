from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import httpx
import asyncio
from core.database import db
from core.security import get_current_user
from services.fdc_client import fdc_client
from services.food_search import food_search_service
from routes.popularity import get_popular_foods, track_food_selection

router = APIRouter(prefix="/foods", tags=["Foods"])

# Open Food Facts search
async def search_open_food_facts(query: str, page_size: int = 20) -> list:
    """Search Open Food Facts database - with short timeout for fast results"""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:  # Short timeout
            url = "https://world.openfoodfacts.org/cgi/search.pl"
            params = {
                "search_terms": query,
                "search_simple": 1,
                "action": "process",
                "json": 1,
                "page_size": min(page_size, 10),  # Limit to speed up
                "fields": "code,product_name,brands,nutriments"
            }
            headers = {
                "User-Agent": "IsotopeNutritionTracker/1.0 (https://isotope.app)"
            }
            
            response = await client.get(url, params=params, headers=headers)
            if response.status_code != 200:
                return []
            
            data = response.json()
            products = data.get("products", [])
            
            results = []
            for product in products:
                if not product.get("product_name"):
                    continue
                    
                nutriments = product.get("nutriments", {})
                results.append({
                    "id": f"off:{product.get('code', '')}",
                    "fdc_id": f"off:{product.get('code', '')}",
                    "description": product.get("product_name", ""),
                    "brand_owner": product.get("brands"),
                    "data_type": "Open Food Facts",
                    "source": "off",
                    "protein_per_100g": nutriments.get("proteins_100g", 0) or 0,
                    "calories_per_100g": nutriments.get("energy-kcal_100g", 0) or 0,
                    "fat_per_100g": nutriments.get("fat_100g", 0) or 0,
                    "carbs_per_100g": nutriments.get("carbohydrates_100g", 0) or 0,
                    "fiber_per_100g": nutriments.get("fiber_100g", 0) or 0,
                    "has_amino_acids": False,
                    "has_fatty_acids": False
                })
            
            return results
    except httpx.TimeoutException:
        # Silently fail - USDA results are more reliable anyway
        return []
    except Exception:
        return []

# Search custom foods in database
async def search_custom_foods(query: str, user_id: str) -> list:
    """Search user's custom foods"""
    # Case-insensitive search
    regex_pattern = {"$regex": query, "$options": "i"}
    
    foods = await db.custom_foods.find({
        "user_id": user_id,
        "$or": [
            {"name": regex_pattern},
            {"brand": regex_pattern}
        ]
    }, {"_id": 0}).to_list(50)
    
    results = []
    for food in foods:
        results.append({
            "id": f"custom:{food['id']}",
            "fdc_id": f"custom:{food['id']}",
            "description": food["name"],
            "brand_owner": food.get("brand"),
            "data_type": "Custom",
            "source": "custom",
            "protein_per_100g": food.get("protein", 0),
            "calories_per_100g": food.get("calories", 0),
            "fat_per_100g": food.get("fat", 0),
            "carbs_per_100g": food.get("carbs", 0),
            "fiber_per_100g": food.get("fiber", 0),
            "has_amino_acids": False,
            "has_fatty_acids": False
        })
    
    return results

@router.get("/search")
async def search_foods(
    query: str = Query(..., min_length=1),
    page_size: int = Query(25, ge=1, le=100),
    page: int = Query(1, ge=1),
    source: Optional[str] = Query(None, description="Filter by source: usda, off, custom, all"),
    include_branded: bool = Query(False, description="Include USDA branded foods (less reliable)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Unified food search across all sources:
    - USDA FoodData Central (with amino acid data)
    - Open Food Facts (2M+ products)
    - User's custom foods
    
    Results are ranked to prioritize simple whole foods over complex meals.
    By default, excludes branded products which may have stale/invalid IDs.
    """
    source = source or "all"
    all_results = []
    
    # Get popularity scores for ranking boost
    popularity_scores = await get_popular_foods(200)
    
    # Build tasks for parallel execution
    async def safe_search(name, coro):
        try:
            result = await coro
            return (name, result)
        except Exception as e:
            print(f"Search error for {name}: {e}")
            return (name, [] if name != "usda" else {"foods": []})
    
    tasks = []
    
    # For USDA, search foundation/SR Legacy foods first (whole foods with amino acid data)
    # Then supplement with branded if requested
    if source in ["all", "usda"]:
        # Search Foundation and SR Legacy foods (high-quality whole foods)
        tasks.append(safe_search("usda_foundation", fdc_client.search_foods(query, page_size, page, data_type="Foundation")))
        tasks.append(safe_search("usda_sr_legacy", fdc_client.search_foods(query, page_size, page, data_type="SR Legacy")))
        tasks.append(safe_search("usda_survey", fdc_client.search_foods(query, page_size, page, data_type="Survey (FNDDS)")))
        if include_branded:
            tasks.append(safe_search("usda_branded", fdc_client.search_foods(query, page_size // 2, page, data_type="Branded")))
    
    if source in ["all", "off"]:
        tasks.append(safe_search("off", search_open_food_facts(query, page_size)))
    
    if source in ["all", "custom"]:
        tasks.append(safe_search("custom", search_custom_foods(query, current_user["id"])))
    
    # Execute searches in parallel
    results = await asyncio.gather(*tasks)
    results_by_source = dict(results)
    
    # Process USDA results from multiple data type searches
    # Data types with reliable amino acid data
    AMINO_ACID_SOURCES = {"SR Legacy", "Foundation", "Survey (FNDDS)"}
    seen_fdc_ids = set()  # Avoid duplicates across data type searches
    
    def process_usda_foods(usda_data, data_type_override=None):
        """Process USDA foods from a search result"""
        foods_to_add = []
        for food in usda_data.get("foods", []):
            fdc_id = str(food.get("fdcId", ""))
            if fdc_id in seen_fdc_ids:
                continue
            seen_fdc_ids.add(fdc_id)
            
            food_data_type = data_type_override or food.get("dataType", "")
            
            # Skip branded if not requested
            if not include_branded and food_data_type == "Branded":
                continue
            
            # Extract nutrients
            protein = 0
            calories = 0
            fat = 0
            carbs = 0
            fiber = 0
            for nutrient in food.get("foodNutrients", []):
                nutrient_id = nutrient.get("nutrientId")
                if nutrient_id == 1003:  # Protein
                    protein = nutrient.get("value", 0) or 0
                elif nutrient_id == 1008:  # Energy (kcal)
                    calories = nutrient.get("value", 0) or 0
                elif nutrient_id == 1004:  # Fat
                    fat = nutrient.get("value", 0) or 0
                elif nutrient_id == 1005:  # Carbs
                    carbs = nutrient.get("value", 0) or 0
                elif nutrient_id == 1079:  # Fiber
                    fiber = nutrient.get("value", 0) or 0
            
            has_amino = food_data_type in AMINO_ACID_SOURCES
            
            foods_to_add.append({
                "id": fdc_id,
                "fdc_id": fdc_id,
                "description": food.get("description", ""),
                "brand_owner": food.get("brandOwner"),
                "data_type": food_data_type,
                "source": "usda",
                "protein_per_100g": round(protein, 2),
                "calories_per_100g": round(calories, 0),
                "fat_per_100g": round(fat, 2),
                "carbs_per_100g": round(carbs, 2),
                "fiber_per_100g": round(fiber, 2),
                "has_amino_acids": has_amino,
                "has_fatty_acids": has_amino
            })
        return foods_to_add
    
    # Collect USDA results
    usda_results = []
    
    # Process Foundation foods first (highest quality)
    if "usda_foundation" in results_by_source:
        usda_results.extend(process_usda_foods(results_by_source["usda_foundation"], "Foundation"))
    
    # Then SR Legacy (whole foods reference)
    if "usda_sr_legacy" in results_by_source:
        usda_results.extend(process_usda_foods(results_by_source["usda_sr_legacy"], "SR Legacy"))
    
    # Then Survey foods (common foods)
    if "usda_survey" in results_by_source:
        usda_results.extend(process_usda_foods(results_by_source["usda_survey"], "Survey (FNDDS)"))
    
    # Finally branded (if enabled)
    if "usda_branded" in results_by_source:
        usda_results.extend(process_usda_foods(results_by_source["usda_branded"], "Branded"))
    
    # Legacy support for old "usda" key (single search)
    if "usda" in results_by_source:
        usda_results.extend(process_usda_foods(results_by_source["usda"]))
    
    # Get Open Food Facts results
    off_results = results_by_source.get("off", [])
    
    # Get custom foods results
    custom_results = results_by_source.get("custom", [])
    
    # ==================== ADVANCED RANKING (using food_search_service) ====================
    # Get user's previously logged foods for ranking boost
    user_logged_foods = await food_search_service.get_user_logged_foods(db, current_user["id"])
    
    # Use the advanced ranking algorithm
    ranked_results = await food_search_service.search_and_rank(
        query=query,
        usda_results=usda_results,
        off_results=off_results,
        custom_results=custom_results,
        user_logged_foods=user_logged_foods,
        popularity_scores=popularity_scores,
        limit=page_size
    )
    
    # Count tiers for response metadata
    tier_counts = {"best_match": 0, "verified": 0, "community": 0}
    for food in ranked_results:
        tier = food.get("tier", 3)
        if tier == 1:
            tier_counts["best_match"] += 1
        elif tier == 2:
            tier_counts["verified"] += 1
        else:
            tier_counts["community"] += 1
    
    return {
        "foods": ranked_results,
        "total_hits": len(usda_results) + len(off_results) + len(custom_results),
        "current_page": page,
        "page_size": page_size,
        "sources": list(set(f["source"] for f in ranked_results)) if ranked_results else [],
        "tiers": tier_counts
    }

# ==================== CATEGORY BROWSING & QUICK ACCESS ====================
# These routes MUST be before /{fdc_id} to avoid path conflicts

@router.get("/categories")
async def get_food_categories():
    """Get all food categories for browsing - no auth required"""
    categories = []
    for key, cat in FOOD_CATEGORIES.items():
        categories.append({
            "id": key,
            "name": cat["name"],
            "icon": cat["icon"],
            "color": cat["color"],
            "description": cat["description"],
            "food_count": len(cat["search_terms"])
        })
    return {"categories": categories}

@router.get("/categories/{category_id}")
async def get_category_foods(category_id: str, current_user: dict = Depends(get_current_user)):
    """Get foods for a specific category"""
    if category_id not in FOOD_CATEGORIES:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category = FOOD_CATEGORIES[category_id]
    foods = []
    
    for search_term in category["search_terms"][:8]:
        try:
            results = await fdc_client.search(search_term, page_size=1)
            if results:
                food = results[0]
                foods.append({
                    "id": food.get("fdcId"),
                    "fdc_id": food.get("fdcId"),
                    "description": food.get("description", ""),
                    "brand_owner": food.get("brandOwner"),
                    "data_type": food.get("dataType", ""),
                    "source": "usda",
                    "protein_per_100g": food.get("protein", 0),
                    "calories_per_100g": food.get("calories", 0),
                    "category": category_id
                })
        except Exception as e:
            print(f"Error fetching {search_term}: {e}")
            continue
    
    return {
        "category": {"id": category_id, "name": category["name"], "description": category["description"]},
        "foods": foods
    }

@router.get("/suggestions/time-based")
async def get_time_based_suggestions(current_user: dict = Depends(get_current_user)):
    """Get food suggestions based on current time of day"""
    current_hour = datetime.now().hour
    
    meal_type = "snacks"
    for key, meal in TIME_BASED_SUGGESTIONS.items():
        start, end = meal["hours"]
        if start <= current_hour < end:
            meal_type = key
            break
    
    meal = TIME_BASED_SUGGESTIONS[meal_type]
    foods = []
    
    # Try to fetch from USDA, but with a shorter timeout
    for search_term in meal["foods"][:4]:  # Reduced to 4 for speed
        try:
            results = await fdc_client.search(search_term, page_size=1)
            if results:
                food = results[0]
                foods.append({
                    "id": food.get("fdcId"),
                    "fdc_id": food.get("fdcId"),
                    "description": food.get("description", ""),
                    "brand_owner": food.get("brandOwner"),
                    "source": "usda",
                    "protein_per_100g": food.get("protein", 0),
                    "calories_per_100g": food.get("calories", 0),
                    "search_term": search_term
                })
        except Exception:
            # If USDA fails, add a fallback suggestion
            foods.append({
                "id": None,
                "fdc_id": None,
                "description": search_term.title(),
                "source": "suggestion",
                "protein_per_100g": 0,
                "calories_per_100g": 0,
                "search_term": search_term
            })
    
    return {
        "meal_type": meal_type,
        "meal_name": meal["name"],
        "time_range": f"{meal['hours'][0]}:00 - {meal['hours'][1]}:00",
        "suggestions": foods
    }

@router.get("/recent")
async def get_recent_foods(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get user's recently logged foods for quick re-logging"""
    logs = await db.food_logs.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "fdc_id": 1, "description": 1, "protein": 1, "calories": 1, "carbs": 1, "logged_at": 1}
    ).sort("logged_at", -1).limit(100).to_list(100)
    
    seen = set()
    unique_foods = []
    for log in logs:
        fdc_id = log.get("fdc_id")
        if fdc_id and fdc_id not in seen:
            seen.add(fdc_id)
            unique_foods.append({
                "fdc_id": fdc_id,
                "description": log.get("description", ""),
                "protein": log.get("protein", 0),
                "calories": log.get("calories", 0),
                "carbs": log.get("carbs", 0),
                "last_logged": log.get("logged_at")
            })
            if len(unique_foods) >= limit:
                break
    
    return {"recent_foods": unique_foods, "count": len(unique_foods)}

# ==================== FOOD DETAILS (catch-all route - MUST be last) ====================

@router.get("/{fdc_id}")
async def get_food_details(fdc_id: str, current_user: dict = Depends(get_current_user)):
    """Get detailed food information from any source"""
    
    # Handle custom foods
    if fdc_id.startswith("custom:"):
        custom_id = fdc_id.replace("custom:", "")
        food = await db.custom_foods.find_one({"id": custom_id, "user_id": current_user["id"]}, {"_id": 0})
        if not food:
            raise HTTPException(status_code=404, detail="Custom food not found")
        
        return {
            "fdc_id": fdc_id,
            "description": food["name"],
            "brand_owner": food.get("brand"),
            "source": "custom",
            "serving_size": food.get("serving_size", 100),
            "serving_unit": food.get("serving_unit", "g"),
            "calories": food.get("calories", 0),
            "protein": food.get("protein", 0),
            "fat": food.get("fat", 0),
            "carbs": food.get("carbs", 0),
            "fiber": food.get("fiber", 0),
            "sugar": food.get("sugar"),
            "sodium": food.get("sodium"),
            "amino_acids": [],
            "fatty_acids": [],
            "is_complete_protein": False,
            "missing_amino_acids": [],
            "protein_quality_score": 0,
            "omega3_total": 0,
            "omega6_total": 0,
            "omega_ratio": None,
            "has_amino_acids": False,
            "has_fatty_acids": False,
            "notes": food.get("notes")
        }
    
    # Handle Open Food Facts
    if fdc_id.startswith("off:"):
        barcode = fdc_id.replace("off:", "")
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}"
                params = {"fields": "code,product_name,brands,nutriments,image_url,serving_size,ingredients_text"}
                headers = {"User-Agent": "IsotopeNutritionTracker/1.0"}
                
                response = await client.get(url, params=params, headers=headers)
                if response.status_code != 200:
                    raise HTTPException(status_code=404, detail="Product not found")
                
                data = response.json()
                if data.get("status") != 1:
                    raise HTTPException(status_code=404, detail="Product not found")
                
                product = data.get("product", {})
                nutriments = product.get("nutriments", {})
                
                return {
                    "fdc_id": fdc_id,
                    "description": product.get("product_name", "Unknown Product"),
                    "brand_owner": product.get("brands"),
                    "source": "off",
                    "serving_size": 100,
                    "serving_unit": "g",
                    "calories": nutriments.get("energy-kcal_100g", 0) or 0,
                    "protein": nutriments.get("proteins_100g", 0) or 0,
                    "fat": nutriments.get("fat_100g", 0) or 0,
                    "carbs": nutriments.get("carbohydrates_100g", 0) or 0,
                    "fiber": nutriments.get("fiber_100g", 0) or 0,
                    "sugar": nutriments.get("sugars_100g"),
                    "sodium": nutriments.get("sodium_100g"),
                    "saturated_fat": nutriments.get("saturated-fat_100g"),
                    "amino_acids": [],
                    "fatty_acids": [],
                    "is_complete_protein": False,
                    "missing_amino_acids": [],
                    "protein_quality_score": 0,
                    "omega3_total": 0,
                    "omega6_total": 0,
                    "omega_ratio": None,
                    "has_amino_acids": False,
                    "has_fatty_acids": False,
                    "image_url": product.get("image_url"),
                    "ingredients": product.get("ingredients_text")
                }
            except httpx.HTTPError:
                raise HTTPException(status_code=404, detail="Product not found")
    
    # Handle USDA foods
    food_data = await fdc_client.get_food_details(fdc_id)
    if not food_data:
        # Try to provide a helpful error message
        raise HTTPException(
            status_code=404, 
            detail="Food not found. This item may have been removed from the USDA database. Please search again for similar foods."
        )
    
    food_detail = fdc_client.parse_food_detail(food_data)
    
    # Add source and availability flags
    data_type = food_data.get("dataType", "")
    has_amino = data_type in {"SR Legacy", "Foundation", "Survey (FNDDS)"}
    
    return {
        **food_detail.dict(),
        "source": "usda",
        "has_amino_acids": has_amino and len(food_detail.amino_acids) > 0,
        "has_fatty_acids": has_amino and len(food_detail.fatty_acids) > 0
    }


# ==================== CATEGORY BROWSING ====================

# Pre-defined food categories with USDA search terms and common foods
FOOD_CATEGORIES = {
    "proteins": {
        "name": "Proteins",
        "icon": "beef",
        "color": "red",
        "search_terms": ["chicken breast", "beef steak", "salmon", "eggs", "turkey", "pork chop", "tuna", "shrimp"],
        "description": "High-protein meats, fish & eggs"
    },
    "dairy": {
        "name": "Dairy",
        "icon": "milk",
        "color": "blue",
        "search_terms": ["cheese cheddar", "greek yogurt", "cottage cheese", "butter", "cream cheese", "milk whole"],
        "description": "Cheese, yogurt & dairy products"
    },
    "vegetables": {
        "name": "Vegetables",
        "icon": "leaf",
        "color": "green",
        "search_terms": ["spinach", "broccoli", "avocado", "cauliflower", "asparagus", "zucchini", "kale", "lettuce"],
        "description": "Low-carb keto-friendly veggies"
    },
    "fats": {
        "name": "Healthy Fats",
        "icon": "droplet",
        "color": "amber",
        "search_terms": ["olive oil", "coconut oil", "almonds", "walnuts", "macadamia nuts", "avocado oil"],
        "description": "Oils, nuts & healthy fat sources"
    },
    "seafood": {
        "name": "Seafood",
        "icon": "fish",
        "color": "cyan",
        "search_terms": ["salmon atlantic", "shrimp", "tuna", "cod", "sardines", "mackerel", "crab", "lobster"],
        "description": "Fish & shellfish high in Omega-3"
    },
    "snacks": {
        "name": "Keto Snacks",
        "icon": "cookie",
        "color": "purple",
        "search_terms": ["pork rinds", "cheese crisps", "beef jerky", "pepperoni", "olives", "pickles"],
        "description": "Quick low-carb snack options"
    }
}

# Time-based meal suggestions
TIME_BASED_SUGGESTIONS = {
    "breakfast": {  # 5 AM - 10 AM
        "name": "Breakfast",
        "foods": ["eggs scrambled", "bacon", "sausage", "avocado", "cheese omelet", "greek yogurt", "butter coffee"],
        "hours": (5, 10)
    },
    "lunch": {  # 11 AM - 2 PM
        "name": "Lunch",
        "foods": ["chicken salad", "tuna salad", "beef burger patty", "caesar salad", "grilled chicken", "egg salad"],
        "hours": (11, 14)
    },
    "dinner": {  # 5 PM - 9 PM
        "name": "Dinner",
        "foods": ["steak ribeye", "salmon fillet", "pork chop", "chicken thighs", "beef roast", "lamb chop"],
        "hours": (17, 21)
    },
    "snacks": {  # Other times
        "name": "Snacks",
        "foods": ["almonds", "cheese string", "pork rinds", "hard boiled egg", "celery", "olives"],
        "hours": (0, 24)
    }
}
