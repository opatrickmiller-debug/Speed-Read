from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    mongo_url: str = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name: str = os.environ.get('DB_NAME', 'test_database')
    fdc_api_key: str = os.environ.get('FDC_API_KEY', '')
    fdc_base_url: str = "https://api.nal.usda.gov/fdc/v1"
    jwt_secret: str = os.environ.get('JWT_SECRET', 'keto-tracker-super-secret-key-2024')
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

settings = Settings()
