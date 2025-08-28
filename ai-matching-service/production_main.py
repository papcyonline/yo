"""
YoFam Production AI Matching Service
===================================

Complete production-ready AI matching service that works with your existing database.
Provides real AI matching using your actual user data.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
import os
from datetime import datetime
import time

import uvicorn
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field

# Import our modules
from models.matching_models import (
    MatchRequest, MatchResponse, UserProfile, 
    MatchResult, BatchMatchRequest, MatchingConfig
)
from utils.database import DatabaseManager
from utils.cache import CacheManager
from services.real_matching_engine import RealMatchingEngine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global services
database_manager: Optional[DatabaseManager] = None
cache_manager: Optional[CacheManager] = None
matching_engine: Optional[RealMatchingEngine] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global database_manager, cache_manager, matching_engine
    
    logger.info("🚀 Starting YoFam Production AI Matching Service...")
    
    try:
        # Initialize database
        database_manager = DatabaseManager()
        await database_manager.initialize()
        logger.info("✅ Database connected")
        
        # Initialize cache
        cache_manager = CacheManager()
        await cache_manager.initialize()
        logger.info("✅ Cache initialized")
        
        # Initialize matching engine
        matching_engine = RealMatchingEngine()
        logger.info("✅ AI Matching Engine ready")
        
        logger.info("🌟 YoFam AI Matching Service is ready!")
        
        yield
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize services: {e}")
        raise
    finally:
        # Cleanup
        logger.info("🛑 Shutting down AI Matching Service...")
        if database_manager:
            await database_manager.close()
        if cache_manager:
            await cache_manager.close()
        logger.info("✅ Shutdown complete")

# Initialize FastAPI app
app = FastAPI(
    title="YoFam AI Matching Service",
    description="Production AI matching service using real user data",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Dependencies
async def get_database() -> DatabaseManager:
    """Get database manager instance"""
    if database_manager is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return database_manager

async def get_matching_engine() -> RealMatchingEngine:
    """Get matching engine instance"""
    if matching_engine is None:
        raise HTTPException(status_code=503, detail="Matching engine not available")
    return matching_engine

async def get_cache() -> CacheManager:
    """Get cache manager instance"""
    if cache_manager is None:
        raise HTTPException(status_code=503, detail="Cache not available")
    return cache_manager

# Health check endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0-production",
        "database": await database_manager.health_check() if database_manager else False,
        "cache": await cache_manager.health_check() if cache_manager else False,
    }

@app.get("/ready")
async def readiness_check():
    """Readiness check endpoint"""
    if not database_manager or not matching_engine:
        raise HTTPException(status_code=503, detail="Service not ready")
    
    db_healthy = await database_manager.health_check()
    if not db_healthy:
        raise HTTPException(status_code=503, detail="Database not ready")
    
    return {
        "status": "ready",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/models/status")
async def models_status():
    """AI model status endpoint"""
    return {
        "status": "ready",
        "models": {
            "name_similarity": "loaded",
            "location_proximity": "loaded", 
            "demographic_match": "loaded",
            "interests_overlap": "loaded",
            "temporal_proximity": "loaded"
        },
        "version": "1.0.0-production"
    }

# Main matching endpoints
@app.post("/match/find", response_model=MatchResponse)
async def find_matches(
    request: MatchRequest,
    db: DatabaseManager = Depends(get_database),
    engine: RealMatchingEngine = Depends(get_matching_engine)
):
    """Find matches for a user using real AI analysis"""
    start_time = time.time()
    
    logger.info(f"🔍 Finding matches for user: {request.user_id}")
    
    try:
        # Get all users from database
        all_users = await db.get_all_users()
        
        if not all_users:
            logger.warning("No users found in database")
            return MatchResponse(
                user_id=request.user_id,
                matches=[],
                total_matches=0,
                processing_time_ms=int((time.time() - start_time) * 1000),
                model_version="1.0.0-production"
            )
        
        logger.info(f"📊 Analyzing {len(all_users)} users for matches")
        
        # Find matches using real AI engine (with context if provided)
        match_context = getattr(request, 'match_context', 'general')
        matches = await engine.find_matches(
            target_user_id=request.user_id,
            all_users=all_users,
            max_results=request.max_results,
            min_confidence=request.min_confidence,
            match_context=match_context
        )
        
        # Convert to response format
        match_results = []
        for match in matches:
            match_result = MatchResult(
                user_id=match["user_id"],
                confidence_score=match["confidence_score"],
                confidence_level=match["confidence_level"],
                match_type=match["match_type"],
                algorithm_scores=match["algorithm_scores"],
                match_reasons=match["match_reasons"],
                predicted_relationship=match.get("predicted_relationship"),
                relationship_confidence=match.get("relationship_confidence")
            )
            match_results.append(match_result)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"✅ Found {len(match_results)} matches in {processing_time}ms")
        
        return MatchResponse(
            user_id=request.user_id,
            matches=match_results,
            total_matches=len(match_results),
            processing_time_ms=processing_time,
            model_version="1.0.0-production",
            confidence_threshold=request.min_confidence or 0.1
        )
        
    except Exception as e:
        logger.error(f"❌ Error finding matches: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to find matches: {str(e)}")

@app.post("/match/batch")
async def batch_matches(
    request: BatchMatchRequest,
    db: DatabaseManager = Depends(get_database),
    engine: RealMatchingEngine = Depends(get_matching_engine)
):
    """Process multiple users in batch"""
    start_time = time.time()
    
    logger.info(f"🔄 Batch processing {len(request.user_ids)} users")
    
    try:
        # Get all users once
        all_users = await db.get_all_users()
        
        results = {}
        for user_id in request.user_ids:
            matches = await engine.find_matches(
                target_user_id=user_id,
                all_users=all_users,
                max_results=request.max_results,
                min_confidence=request.min_confidence
            )
            
            results[user_id] = {
                "matches": matches,
                "total_matches": len(matches)
            }
        
        processing_time = int((time.time() - start_time) * 1000)
        
        logger.info(f"✅ Batch completed in {processing_time}ms")
        
        return {
            "results": results,
            "total_users_processed": len(request.user_ids),
            "processing_time_ms": processing_time,
            "model_version": "1.0.0-production"
        }
        
    except Exception as e:
        logger.error(f"❌ Error in batch processing: {e}")
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

@app.get("/match/similarity")
async def calculate_similarity(
    user_id_1: str,
    user_id_2: str,
    db: DatabaseManager = Depends(get_database),
    engine: RealMatchingEngine = Depends(get_matching_engine)
):
    """Calculate similarity between two specific users"""
    start_time = time.time()
    
    try:
        # Get both users
        user1 = await db.get_user_by_id(user_id_1)
        user2 = await db.get_user_by_id(user_id_2)
        
        if not user1 or not user2:
            raise HTTPException(status_code=404, detail="One or both users not found")
        
        # Calculate match
        match_result = await engine.calculate_match(user1, user2)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "user_id_1": user_id_1,
            "user_id_2": user_id_2,
            "similarity_score": match_result["confidence_score"],
            "algorithm_breakdown": match_result["algorithm_scores"],
            "match_reasons": match_result["match_reasons"],
            "predicted_relationship": match_result.get("predicted_relationship"),
            "processing_time_ms": processing_time
        }
        
    except Exception as e:
        logger.error(f"❌ Error calculating similarity: {e}")
        raise HTTPException(status_code=500, detail=f"Similarity calculation failed: {str(e)}")

@app.get("/metrics")
async def metrics():
    """Basic metrics endpoint"""
    return {
        "service": "yofam-ai-matching",
        "version": "1.0.0-production",
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database_connected": await database_manager.health_check() if database_manager else False
    }

@app.get("/users/count")
async def get_user_count(db: DatabaseManager = Depends(get_database)):
    """Get total count of users in database"""
    try:
        users = await db.get_all_users()
        return {
            "total_users": len(users),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Error getting user count: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user count")

if __name__ == "__main__":
    logger.info("🚀 Starting YoFam Production AI Matching Service...")
    logger.info("📍 Service will be available at: http://localhost:8000")
    logger.info("🏥 Health check: http://localhost:8000/health")
    logger.info("📊 Metrics: http://localhost:8000/metrics")
    logger.info("📖 API docs: http://localhost:8000/docs")
    logger.info("💾 Using real database with your existing users")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True
    )