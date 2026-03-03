from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import httpx
import asyncio
from core.database import db
from core.security import get_current_user
from services.fdc_client import fdc_client

router = APIRouter(prefix="/foods", tags=["Foods"])

# Open Food Facts search
async def search_open_food_facts(query: str, page_size: int = 20) -> list:
    """Search Open Food Facts database"""
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            url = "https://world.openfoodfacts.org/cgi/search.pl"
            params = {
                "search_terms": query,
                "search_simple": 1,
                "action": "process",
                "json": 1,
                "page_size": page_size,
                "fields": "code,product_name,brands,nutriments,image_small_url"
            }
            headers = {
                "User-Agent": "IsotopeNutritionTracker/1.0 (https://isotope.app)"
            }
            
            response = await client.get(url, params=params, headers=headers)
            if response.status_code != 200:
                print(f"Open Food Facts returned status {response.status_code}")
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
                    "image_url": product.get("image_small_url"),
                    "has_amino_acids": False,
                    "has_fatty_acids": False
                })
            
            return results
    except httpx.TimeoutException:
        print(f"Open Food Facts search timeout for query: {query}")
        return []
    except Exception as e:
        print(f"Open Food Facts search error: {type(e).__name__}: {e}")
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
    include_branded: bool = Query(True, description="Include USDA branded foods"),
    current_user: dict = Depends(get_current_user)
):
    """
    Unified food search across all sources:
    - USDA FoodData Central (with amino acid data)
    - Open Food Facts (2M+ products)
    - User's custom foods
    """
    source = source or "all"
    all_results = []
    
    # Build tasks for parallel execution
    async def safe_search(name, coro):
        try:
            result = await coro
            return (name, result)
        except Exception as e:
            print(f"Search error for {name}: {e}")
            return (name, [] if name != "usda" else {"foods": []})
    
    tasks = []
    
    if source in ["all", "usda"]:
        tasks.append(safe_search("usda", fdc_client.search_foods(query, page_size, page)))
    
    if source in ["all", "off"]:
        tasks.append(safe_search("off", search_open_food_facts(query, page_size)))
    
    if source in ["all", "custom"]:
        tasks.append(safe_search("custom", search_custom_foods(query, current_user["id"])))
    
    # Execute searches in parallel
    results = await asyncio.gather(*tasks)
    results_by_source = dict(results)
    
    # Process USDA results
    if "usda" in results_by_source:
        usda_data = results_by_source["usda"]
        
        # Data types with reliable amino acid data
        AMINO_ACID_SOURCES = {"SR Legacy", "Foundation", "Survey (FNDDS)"}
        
        for food in usda_data.get("foods", []):
            food_data_type = food.get("dataType", "")
            
            # Skip branded if not requested
            if not include_branded and food_data_type == "Branded":
                continue
            
            protein = 0
            for nutrient in food.get("foodNutrients", []):
                if nutrient.get("nutrientId") == 1003:
                    protein = nutrient.get("value", 0) or 0
                    break
            
            has_amino = food_data_type in AMINO_ACID_SOURCES
            
            all_results.append({
                "id": str(food.get("fdcId", "")),
                "fdc_id": str(food.get("fdcId", "")),
                "description": food.get("description", ""),
                "brand_owner": food.get("brandOwner"),
                "data_type": food_data_type,
                "source": "usda",
                "protein_per_100g": round(protein, 2),
                "has_amino_acids": has_amino,
                "has_fatty_acids": has_amino
            })
    
    # Add Open Food Facts results
    if "off" in results_by_source:
        off_results = results_by_source["off"]
        all_results.extend(off_results)
    
    # Add custom foods results (prioritize at top)
    if "custom" in results_by_source:
        custom_results = results_by_source["custom"]
        all_results = custom_results + all_results
    
    # Sort: Custom first, then interleave USDA with amino acids with other sources
    # Group results by priority
    custom_foods = [f for f in all_results if f["source"] == "custom"]
    usda_with_amino = [f for f in all_results if f["source"] == "usda" and f.get("has_amino_acids")]
    usda_branded = [f for f in all_results if f["source"] == "usda" and not f.get("has_amino_acids")]
    off_foods = [f for f in all_results if f["source"] == "off"]
    
    # Interleave results: custom first, then mix USDA amino + OFF, then branded
    final_results = custom_foods.copy()
    
    # Interleave USDA amino and OFF results
    max_len = max(len(usda_with_amino), len(off_foods))
    for i in range(max_len):
        if i < len(usda_with_amino):
            final_results.append(usda_with_amino[i])
        if i < len(off_foods):
            final_results.append(off_foods[i])
    
    # Add branded USDA at the end
    final_results.extend(usda_branded)
    
    return {
        "foods": final_results[:page_size],
        "total_hits": len(final_results),
        "current_page": page,
        "page_size": page_size,
        "sources": list(set(f["source"] for f in all_results))
    }

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
        raise HTTPException(status_code=404, detail="Food not found in USDA database")
    
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
