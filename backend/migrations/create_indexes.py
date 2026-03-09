"""
MongoDB Index Migration Script

Run this script to create optimal indexes for the Keto Nutrition Tracker database.
These indexes improve query performance for common operations.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


async def create_indexes():
    """Create all necessary indexes for optimal performance."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"Connected to MongoDB: {DB_NAME}")
    print("Creating indexes...\n")
    
    # ==================== FOOD LOGS ====================
    print("📋 food_logs collection:")
    
    # Compound index for user's logs sorted by date (most common query)
    await db.food_logs.create_index(
        [("user_id", 1), ("logged_at", -1)],
        name="user_logs_by_date"
    )
    print("  ✅ user_id + logged_at (compound)")
    
    # Index for food lookups
    await db.food_logs.create_index(
        [("fdc_id", 1)],
        name="fdc_id_lookup"
    )
    print("  ✅ fdc_id")
    
    # ==================== FOODS (Local Cache) ====================
    print("\n🍎 foods collection:")
    
    # Primary key index (usually auto-created but explicit is better)
    await db.foods.create_index(
        [("_id", 1)],
        name="primary_id"
    )
    print("  ✅ _id")
    
    # Text search index for food names
    await db.foods.create_index(
        [("name", "text")],
        name="name_text_search"
    )
    print("  ✅ name (text search)")
    
    # ==================== FAVORITES ====================
    print("\n⭐ favorites collection:")
    
    # User's favorites lookup
    await db.favorites.create_index(
        [("user_id", 1)],
        name="user_favorites"
    )
    print("  ✅ user_id")
    
    # Compound for checking if food is favorited
    await db.favorites.create_index(
        [("user_id", 1), ("fdc_id", 1)],
        unique=True,
        name="user_food_unique"
    )
    print("  ✅ user_id + fdc_id (unique)")
    
    # ==================== CUSTOM MEALS ====================
    print("\n🍽️ custom_meals collection:")
    
    await db.custom_meals.create_index(
        [("user_id", 1)],
        name="user_meals"
    )
    print("  ✅ user_id")
    
    await db.custom_meals.create_index(
        [("is_public", 1)],
        name="public_meals"
    )
    print("  ✅ is_public")
    
    # ==================== CUSTOM FOODS ====================
    print("\n🥗 custom_foods collection:")
    
    await db.custom_foods.create_index(
        [("user_id", 1)],
        name="user_custom_foods"
    )
    print("  ✅ user_id")
    
    # ==================== FOOD POPULARITY ====================
    print("\n📊 food_popularity collection:")
    
    await db.food_popularity.create_index(
        [("count", -1)],
        name="popularity_ranking"
    )
    print("  ✅ count (descending)")
    
    await db.food_popularity.create_index(
        [("food_id", 1)],
        unique=True,
        name="food_id_unique"
    )
    print("  ✅ food_id (unique)")
    
    # ==================== USERS ====================
    print("\n👤 users collection:")
    
    await db.users.create_index(
        [("email", 1)],
        unique=True,
        name="email_unique"
    )
    print("  ✅ email (unique)")
    
    await db.users.create_index(
        [("id", 1)],
        unique=True,
        name="user_id_unique"
    )
    print("  ✅ id (unique)")
    
    # ==================== VERIFICATION ====================
    print("\n" + "="*50)
    print("Verifying indexes...\n")
    
    collections = ["food_logs", "foods", "favorites", "custom_meals", 
                   "custom_foods", "food_popularity", "users"]
    
    for coll_name in collections:
        indexes = await db[coll_name].index_information()
        print(f"{coll_name}: {len(indexes)} indexes")
        for idx_name, idx_info in indexes.items():
            if idx_name != "_id_":
                print(f"  - {idx_name}: {idx_info.get('key')}")
    
    print("\n✅ All indexes created successfully!")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(create_indexes())
