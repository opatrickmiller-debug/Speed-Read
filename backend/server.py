from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import logging

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI(title="Keto Nutrition Tracker API")

# Create main API router with /api prefix
api_router = APIRouter(prefix="/api")

# Import and include route modules
from routes.auth import router as auth_router
from routes.foods import router as foods_router
from routes.logs import router as logs_router
from routes.stats import router as stats_router
from routes.barcode import router as barcode_router
from routes.suggestions import router as suggestions_router
from routes.meals import router as meals_router
from routes.keto_score import router as keto_score_router

api_router.include_router(auth_router)
api_router.include_router(foods_router)
api_router.include_router(logs_router)
api_router.include_router(stats_router)
api_router.include_router(barcode_router)
api_router.include_router(suggestions_router)
api_router.include_router(meals_router)
api_router.include_router(keto_score_router)

# Root routes
@api_router.get("/")
async def root():
    return {"message": "Keto Nutrition Tracker API", "version": "2.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include main router
app.include_router(api_router)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
