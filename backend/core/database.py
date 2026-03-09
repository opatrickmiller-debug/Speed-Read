from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

client = AsyncIOMotorClient(settings.mongo_url)
db = client[settings.db_name]


async def ensure_indexes():
    """Ensure all necessary indexes exist for optimal performance."""
    from pymongo.errors import OperationFailure
    
    async def safe_create_index(collection, keys, **kwargs):
        """Create index, ignoring if already exists."""
        try:
            await collection.create_index(keys, **kwargs)
        except OperationFailure:
            pass  # Index already exists
    
    # food_logs: user queries by date
    await safe_create_index(db.food_logs, [("user_id", 1), ("logged_at", -1)])
    await safe_create_index(db.food_logs, [("fdc_id", 1)])
    
    # foods: text search
    await safe_create_index(db.foods, [("name", "text")])
    
    # favorites: user lookups
    await safe_create_index(db.favorites, [("user_id", 1)])
    await safe_create_index(db.favorites, [("user_id", 1), ("fdc_id", 1)], unique=True)
    
    # custom_meals
    await safe_create_index(db.custom_meals, [("user_id", 1)])
    await safe_create_index(db.custom_meals, [("is_public", 1)])
    
    # custom_foods
    await safe_create_index(db.custom_foods, [("user_id", 1)])
    
    # food_popularity
    await safe_create_index(db.food_popularity, [("count", -1)])
    await safe_create_index(db.food_popularity, [("food_id", 1)], unique=True)
    
    # users
    await safe_create_index(db.users, [("email", 1)], unique=True)
    await safe_create_index(db.users, [("id", 1)], unique=True)
