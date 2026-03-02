import httpx
import asyncio
import logging
from typing import Dict, List, Optional
from core.config import settings
from core.constants import ALL_AMINO_ACIDS, ESSENTIAL_AMINO_ACIDS
from models.food import AminoAcid, FoodDetail

logger = logging.getLogger(__name__)

class FDCClient:
    def __init__(self):
        self.base_url = settings.fdc_base_url
        self.api_key = settings.fdc_api_key
        self.semaphore = asyncio.Semaphore(5)
    
    async def search_foods(self, query: str, page_size: int = 25, page: int = 1, data_type: Optional[str] = None) -> Dict:
        async with self.semaphore:
            async with httpx.AsyncClient(timeout=30.0) as client:
                json_body = {
                    "query": query,
                    "pageSize": page_size,
                    "pageNumber": page - 1
                }
                if data_type:
                    json_body["dataType"] = [data_type]
                
                try:
                    response = await client.post(
                        f"{self.base_url}/foods/search",
                        params={"api_key": self.api_key},
                        json=json_body
                    )
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPError as e:
                    logger.error(f"FDC search error: {e}")
                    return {"foods": [], "totalHits": 0}
    
    async def get_food_details(self, fdc_id: str) -> Optional[Dict]:
        async with self.semaphore:
            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    response = await client.get(
                        f"{self.base_url}/food/{fdc_id}",
                        params={"api_key": self.api_key}
                    )
                    response.raise_for_status()
                    return response.json()
                except httpx.HTTPError as e:
                    logger.error(f"FDC details error: {e}")
                    return None
    
    def extract_nutrient(self, food_data: Dict, nutrient_id: int) -> float:
        nutrients = food_data.get("foodNutrients", [])
        for nutrient in nutrients:
            n_info = nutrient.get("nutrient", {})
            if n_info.get("id") == nutrient_id:
                return nutrient.get("amount", 0) or 0
        return 0
    
    def extract_amino_acids(self, food_data: Dict) -> List[AminoAcid]:
        amino_acids = []
        nutrients = food_data.get("foodNutrients", [])
        
        for aa_name, aa_info in ALL_AMINO_ACIDS.items():
            aa_id = aa_info.get("id")
            is_essential = aa_name in ESSENTIAL_AMINO_ACIDS
            
            for nutrient in nutrients:
                n_info = nutrient.get("nutrient", {})
                if n_info.get("id") == aa_id:
                    value = nutrient.get("amount", 0) or 0
                    if value > 0:
                        amino_acids.append(AminoAcid(
                            name=aa_name,
                            value=round(value, 3),
                            unit="g",
                            is_essential=is_essential
                        ))
                    break
        
        return amino_acids
    
    def analyze_protein_completeness(self, amino_acids: List[AminoAcid]) -> tuple:
        present_essential = {aa.name for aa in amino_acids if aa.is_essential and aa.value > 0}
        all_essential = set(ESSENTIAL_AMINO_ACIDS.keys())
        missing = list(all_essential - present_essential)
        is_complete = len(missing) == 0
        
        if not present_essential:
            quality_score = 0
        else:
            quality_score = (len(present_essential) / len(all_essential)) * 100
        
        return is_complete, missing, round(quality_score, 1)
    
    def parse_food_detail(self, food_data: Dict) -> FoodDetail:
        amino_acids = self.extract_amino_acids(food_data)
        is_complete, missing, quality_score = self.analyze_protein_completeness(amino_acids)
        
        return FoodDetail(
            fdc_id=str(food_data.get("fdcId", "")),
            description=food_data.get("description", ""),
            brand_owner=food_data.get("brandOwner"),
            serving_size=100,
            serving_unit="g",
            calories=self.extract_nutrient(food_data, 1008),
            protein=self.extract_nutrient(food_data, 1003),
            fat=self.extract_nutrient(food_data, 1004),
            carbs=self.extract_nutrient(food_data, 1005),
            fiber=self.extract_nutrient(food_data, 1079),
            amino_acids=amino_acids,
            is_complete_protein=is_complete,
            missing_amino_acids=missing,
            protein_quality_score=quality_score
        )

fdc_client = FDCClient()
