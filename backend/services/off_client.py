import httpx
import asyncio
import logging
from typing import Optional
from models.food import BarcodeProduct

logger = logging.getLogger(__name__)

class OpenFoodFactsClient:
    def __init__(self):
        self.base_url = "https://world.openfoodfacts.org/api/v2"
        self.user_agent = "IsotopeNutritionTracker/1.0 (contact@isotope.app)"
        self.semaphore = asyncio.Semaphore(3)
    
    async def lookup_barcode(self, barcode: str) -> Optional[BarcodeProduct]:
        async with self.semaphore:
            async with httpx.AsyncClient(timeout=15.0) as client:
                try:
                    url = f"{self.base_url}/product/{barcode}"
                    params = {
                        "fields": "code,product_name,brands,nutriments,image_url"
                    }
                    headers = {
                        "User-Agent": self.user_agent,
                        "Accept": "application/json"
                    }
                    
                    response = await client.get(url, params=params, headers=headers)
                    
                    if response.status_code == 404:
                        return None
                    
                    response.raise_for_status()
                    data = response.json()
                    
                    if data.get("status") != 1:
                        return None
                    
                    product = data.get("product", {})
                    nutriments = product.get("nutriments", {})
                    
                    return BarcodeProduct(
                        barcode=barcode,
                        product_name=product.get("product_name"),
                        brand=product.get("brands"),
                        protein_per_100g=nutriments.get("proteins_100g", 0) or 0,
                        calories_per_100g=nutriments.get("energy-kcal_100g", 0) or 0,
                        fat_per_100g=nutriments.get("fat_100g", 0) or 0,
                        carbs_per_100g=nutriments.get("carbohydrates_100g", 0) or 0,
                        fiber_per_100g=nutriments.get("fiber_100g", 0) or 0,
                        image_url=product.get("image_url"),
                        source="open_food_facts"
                    )
                    
                except httpx.HTTPError as e:
                    logger.error(f"Open Food Facts lookup error: {e}")
                    return None
                except Exception as e:
                    logger.error(f"Unexpected error in barcode lookup: {e}")
                    return None

off_client = OpenFoodFactsClient()
