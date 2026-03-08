from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
import uuid
from core.database import db
from core.security import get_current_user
from services.off_client import off_client

router = APIRouter(prefix="/barcode", tags=["Barcode"])


@router.get("/lookup/{barcode}")
async def lookup_barcode(barcode: str, current_user: dict = Depends(get_current_user)):
    """
    Look up a barcode in Open Food Facts database.
    
    Returns product info if found, 404 if not found.
    Frontend should navigate to /food/{fdc_id} on success.
    """
    if not barcode.isdigit() or not (8 <= len(barcode) <= 14):
        raise HTTPException(status_code=400, detail="Invalid barcode format. Must be 8-14 digits.")
    
    product = await off_client.lookup_barcode(barcode)
    
    if not product:
        raise HTTPException(status_code=404, detail="Food not found")
    
    # Return with fdc_id for navigation
    return {
        "found": True,
        "fdc_id": f"barcode:{barcode}",
        "barcode": barcode,
        "product_name": product.product_name,
        "brand": product.brand,
        "calories": product.calories_per_100g,
        "protein": product.protein_per_100g,
        "fat": product.fat_per_100g,
        "carbs": product.carbs_per_100g,
        "fiber": product.fiber_per_100g,
        "image_url": product.image_url
    }


# Keep old endpoint for backwards compatibility
@router.get("/{barcode}")
async def lookup_barcode_legacy(barcode: str, current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - use /lookup/{barcode} instead"""
    if not barcode.isdigit() or not (8 <= len(barcode) <= 14):
        raise HTTPException(status_code=400, detail="Invalid barcode format. Must be 8-14 digits.")
    
    product = await off_client.lookup_barcode(barcode)
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found in Open Food Facts database")
    
    return product

@router.post("/log")
async def log_barcode_product(
    barcode: str = Query(...),
    servings: float = Query(1.0),
    serving_size: float = Query(100.0),
    meal_type: str = Query("snack"),
    current_user: dict = Depends(get_current_user)
):
    product = await off_client.lookup_barcode(barcode)
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    log_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    scale = serving_size / 100.0
    
    log_doc = {
        "id": log_id,
        "user_id": current_user["id"],
        "fdc_id": f"barcode:{barcode}",
        "description": f"{product.product_name or 'Unknown Product'} ({product.brand or 'Unknown Brand'})",
        "serving_size": serving_size,
        "serving_unit": "g",
        "servings": servings,
        "calories": product.calories_per_100g * scale,
        "protein": product.protein_per_100g * scale,
        "fat": product.fat_per_100g * scale,
        "carbs": product.carbs_per_100g * scale,
        "fiber": product.fiber_per_100g * scale,
        "amino_acids": [],
        "meal_type": meal_type,
        "logged_at": now.isoformat(),
        "created_at": now.isoformat(),
        "barcode": barcode,
        "image_url": product.image_url
    }
    
    await db.food_logs.insert_one(log_doc)
    
    return {
        "message": "Product added to log",
        "log_id": log_id,
        "product": product
    }
