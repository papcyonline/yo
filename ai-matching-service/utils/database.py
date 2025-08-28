"""
Database Manager for AI Matching Service
========================================

Handles connections to MongoDB and data access for matching service.
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Manages database connections and user data operations."""
    
    def __init__(self):
        self.mongo_client = None
        self.mongo_db = None
        self.users_collection = None
        self.is_initialized = False
    
    async def initialize(self):
        """Initialize database connections."""
        try:
            # Use same MongoDB URI as backend
            mongo_url = os.getenv("MONGODB_URI", "mongodb://localhost:27017/yofam-dev")
            self.mongo_client = AsyncIOMotorClient(mongo_url)
            
            # Get database name from URI
            db_name = mongo_url.split('/')[-1] if '/' in mongo_url else 'yofam'
            self.mongo_db = self.mongo_client[db_name]
            self.users_collection = self.mongo_db.users
            
            # Test MongoDB connection
            await self.mongo_client.admin.command('ping')
            logger.info(f"✅ AI Service connected to MongoDB: {mongo_url}")
            
            self.is_initialized = True
            
        except Exception as e:
            logger.error(f"Database initialization failed: {str(e)}")
            raise
    
    async def get_all_users(self) -> List[Dict[str, Any]]:
        """Get all active users from the database"""
        try:
            users_cursor = self.users_collection.find({
                "is_active": True,
                "first_name": {"$exists": True, "$ne": None},
                "last_name": {"$exists": True, "$ne": None}
            }, {
                "_id": 1,
                "first_name": 1,
                "last_name": 1,
                "phone": 1,
                "email": 1,
                "date_of_birth": 1,
                "gender": 1,
                "location": 1,
                "profession": 1,
                "interests": 1,
                "created_at": 1
            })
            
            users = await users_cursor.to_list(length=None)
            logger.info(f"📊 Retrieved {len(users)} active users from database")
            return users
            
        except Exception as e:
            logger.error(f"❌ Failed to get users: {e}")
            return []
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific user by ID"""
        try:
            user = await self.users_collection.find_one(
                {"_id": ObjectId(user_id), "is_active": True},
                {
                    "_id": 1,
                    "first_name": 1,
                    "last_name": 1,
                    "phone": 1,
                    "email": 1,
                    "date_of_birth": 1,
                    "gender": 1,
                    "location": 1,
                    "profession": 1,
                    "interests": 1,
                    "created_at": 1
                }
            )
            return user
            
        except Exception as e:
            logger.error(f"❌ Failed to get user {user_id}: {e}")
            return None
    
    async def get_users_excluding(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all active users except the specified one"""
        try:
            users_cursor = self.users_collection.find({
                "_id": {"$ne": ObjectId(user_id)},
                "is_active": True,
                "first_name": {"$exists": True, "$ne": None},
                "last_name": {"$exists": True, "$ne": None}
            }, {
                "_id": 1,
                "first_name": 1,
                "last_name": 1,
                "phone": 1,
                "email": 1,
                "date_of_birth": 1,
                "gender": 1,
                "location": 1,
                "profession": 1,
                "interests": 1,
                "created_at": 1
            })
            
            users = await users_cursor.to_list(length=None)
            return users
            
        except Exception as e:
            logger.error(f"❌ Failed to get users excluding {user_id}: {e}")
            return []
    
    async def health_check(self) -> bool:
        """Check database health."""
        try:
            if not self.is_initialized:
                return False
            
            # Test MongoDB
            await self.mongo_client.admin.command('ping')
            return True
            
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            return False
    
    async def close(self):
        """Close database connections."""
        if self.mongo_client:
            self.mongo_client.close()
        logger.info("Database connections closed")