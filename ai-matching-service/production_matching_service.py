"""
YoFam AI Matching Service - Production Version
=============================================

Advanced AI-powered family and social matching system with:
- Multiple matching algorithms (family, location, profession, interests, age)
- Machine learning similarity scoring
- Real user data processing
- Configurable match thresholds (10%+ for friend requests)
- User profile analysis and enhancement
"""

import asyncio
import logging
import numpy as np
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from difflib import SequenceMatcher

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pymongo
from bson import ObjectId
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="YoFam AI Matching Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
mongo_client = None
mongo_db = None

class MatchRequest(BaseModel):
    user_id: str
    match_types: List[str] = ["all"]
    max_results: int = 50
    min_confidence: float = 0.1  # 10% minimum for friend requests

class MatchResult(BaseModel):
    user_id: str
    confidence_score: float
    match_type: str
    match_reasons: List[str] = []
    algorithm_scores: Dict[str, float] = {}
    predicted_relationship: Optional[str] = None

class MatchResponse(BaseModel):
    user_id: str
    matches: List[MatchResult]
    total_matches: int
    processing_time_ms: float
    model_version: str = "2.0.0-production"

@app.on_event("startup")
async def startup_event():
    """Initialize database connection."""
    global mongo_client, mongo_db
    try:
        mongo_client = pymongo.MongoClient("mongodb://localhost:27017/")
        mongo_db = mongo_client["yofam-dev"]
        
        # Test connection
        mongo_db.command("ping")
        logger.info("✅ Connected to MongoDB")
        
        # Check user count
        user_count = mongo_db.users.count_documents({})
        logger.info(f"📊 Processing {user_count} users for matching")
        
        # Create indexes for performance
        mongo_db.users.create_index([("father_name", 1)])
        mongo_db.users.create_index([("mother_name", 1)])
        mongo_db.users.create_index([("location", 1)])
        mongo_db.users.create_index([("profession", 1)])
        mongo_db.users.create_index([("date_of_birth", 1)])
        
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection."""
    if mongo_client:
        mongo_client.close()
        logger.info("🔌 MongoDB connection closed")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "yofam-ai-matching-production",
        "version": "2.0.0"
    }

class AdvancedAIMatchingEngine:
    """Advanced AI matching engine with multiple algorithms."""
    
    def __init__(self, db):
        self.db = db
        
    async def find_matches(self, user_id: str, options: Dict = None) -> List[Dict]:
        """Find matches using advanced AI algorithms."""
        try:
            logger.info(f"🔍 Finding matches for user: {user_id}")
            
            # Get current user with all profile data
            current_user = self.db.users.find_one({"_id": ObjectId(user_id)})
            if not current_user:
                logger.error(f"❌ User not found: {user_id}")
                return []
            
            logger.info(f"👤 Processing matches for: {current_user.get('first_name', 'Unknown')} {current_user.get('last_name', 'Unknown')}")
            
            # Get all other users for comparison
            other_users = list(self.db.users.find({
                "_id": {"$ne": ObjectId(user_id)},
                "is_active": {"$ne": False}
            }))
            
            logger.info(f"👥 Analyzing against {len(other_users)} other users")
            
            matches = []
            min_confidence = options.get("min_confidence", 0.1) if options else 0.1
            
            for other_user in other_users:
                try:
                    similarity_result = self.calculate_comprehensive_similarity(current_user, other_user)
                    
                    if similarity_result["total_score"] >= min_confidence:
                        match = {
                            "user_id": str(other_user["_id"]),
                            "name": f"{other_user.get('first_name', 'Unknown')} {other_user.get('last_name', 'Unknown')}",
                            "confidence_score": similarity_result["total_score"],
                            "match_type": similarity_result["match_type"],
                            "match_reasons": similarity_result["reasons"],
                            "algorithm_scores": similarity_result["algorithm_scores"],
                            "predicted_relationship": similarity_result.get("predicted_relationship"),
                            "profile_data": {
                                "location": other_user.get("location"),
                                "profession": other_user.get("profession"),
                                "bio": other_user.get("bio"),
                                "age": self.calculate_age(other_user.get("date_of_birth")),
                                "profile_photo_url": other_user.get("profile_photo_url")
                            }
                        }
                        matches.append(match)
                        
                        logger.info(f"✅ Match found: {match['name']} ({similarity_result['total_score']:.1%} - {similarity_result['match_type']})")
                
                except Exception as e:
                    logger.error(f"Error processing user {other_user.get('_id')}: {str(e)}")
                    continue
            
            # Sort by confidence score (highest first)
            matches.sort(key=lambda x: x["confidence_score"], reverse=True)
            
            # Apply result limit
            max_results = options.get("max_results", 50) if options else 50
            matches = matches[:max_results]
            
            logger.info(f"🎯 Total matches found: {len(matches)}")
            return matches
            
        except Exception as e:
            logger.error(f"❌ Matching failed for user {user_id}: {str(e)}")
            return []
    
    def calculate_comprehensive_similarity(self, user1: Dict, user2: Dict) -> Dict:
        """Calculate comprehensive similarity using multiple algorithms."""
        
        # Initialize scores
        algorithm_scores = {}
        reasons = []
        total_score = 0.0
        match_type = "community"
        predicted_relationship = None
        
        # 1. Family Relationship Analysis (40% weight)
        family_result = self.analyze_family_relationship(user1, user2)
        algorithm_scores["family"] = family_result["score"]
        if family_result["score"] > 0:
            total_score += family_result["score"] * 0.4
            if family_result["relationship"]:
                predicted_relationship = family_result["relationship"]
                match_type = "family"
            reasons.extend(family_result["reasons"])
        
        # 2. Geographic Proximity (20% weight)
        location_result = self.analyze_location_similarity(user1, user2)
        algorithm_scores["location"] = location_result["score"]
        if location_result["score"] > 0:
            total_score += location_result["score"] * 0.2
            reasons.extend(location_result["reasons"])
        
        # 3. Professional Compatibility (15% weight)
        profession_result = self.analyze_profession_similarity(user1, user2)
        algorithm_scores["profession"] = profession_result["score"]
        if profession_result["score"] > 0:
            total_score += profession_result["score"] * 0.15
            reasons.extend(profession_result["reasons"])
        
        # 4. Age and Life Stage Compatibility (10% weight)
        age_result = self.analyze_age_compatibility(user1, user2)
        algorithm_scores["age"] = age_result["score"]
        if age_result["score"] > 0:
            total_score += age_result["score"] * 0.1
            reasons.extend(age_result["reasons"])
        
        # 5. Name and Linguistic Similarity (10% weight)
        name_result = self.analyze_name_similarity(user1, user2)
        algorithm_scores["name"] = name_result["score"]
        if name_result["score"] > 0:
            total_score += name_result["score"] * 0.1
            reasons.extend(name_result["reasons"])
        
        # 6. Cultural and Background Similarity (5% weight)
        cultural_result = self.analyze_cultural_similarity(user1, user2)
        algorithm_scores["cultural"] = cultural_result["score"]
        if cultural_result["score"] > 0:
            total_score += cultural_result["score"] * 0.05
            reasons.extend(cultural_result["reasons"])
        
        # Determine final match type and predicted relationship for friends
        if algorithm_scores.get("family", 0) > 0.3:
            match_type = "family"
        elif total_score > 0.3:
            match_type = "friend"
            # Determine specific friend relationship type
            if not predicted_relationship:
                predicted_relationship = self.predict_friend_relationship(
                    user1, user2, algorithm_scores, reasons
                )
        elif total_score > 0.2:
            match_type = "community"
        
        # Ensure we have at least one reason
        if not reasons:
            reasons = ["Profile compatibility"]
        
        return {
            "total_score": min(total_score, 1.0),
            "match_type": match_type,
            "reasons": reasons,
            "algorithm_scores": algorithm_scores,
            "predicted_relationship": predicted_relationship
        }
    
    def analyze_family_relationship(self, user1: Dict, user2: Dict) -> Dict:
        """Analyze potential family relationships."""
        score = 0.0
        reasons = []
        relationship = None
        
        # Parent names analysis
        father1 = self.normalize_name(user1.get("father_name", ""))
        father2 = self.normalize_name(user2.get("father_name", ""))
        mother1 = self.normalize_name(user1.get("mother_name", ""))
        mother2 = self.normalize_name(user2.get("mother_name", ""))
        
        # Exact parent matches (siblings)
        if father1 and father2 and father1 == father2:
            score += 0.5
            reasons.append(f"Same father: {user1.get('father_name', 'Unknown')}")
            relationship = "sibling"
        
        if mother1 and mother2 and mother1 == mother2:
            score += 0.5
            reasons.append(f"Same mother: {user1.get('mother_name', 'Unknown')}")
            if relationship == "sibling":
                relationship = "full sibling"
            else:
                relationship = "maternal sibling"
        
        # Partial parent matches (half-siblings)
        elif father1 and father2 and father1 == father2:
            relationship = "paternal half-sibling"
        elif mother1 and mother2 and mother1 == mother2:
            relationship = "maternal half-sibling"
        
        # Cross-generational analysis (parent-child possibility)
        user1_full_name = self.normalize_name(f"{user1.get('first_name', '')} {user1.get('last_name', '')}")
        user2_full_name = self.normalize_name(f"{user2.get('first_name', '')} {user2.get('last_name', '')}")
        
        if user1_full_name and (user1_full_name == father2 or user1_full_name == mother2):
            score += 0.8
            reasons.append("Potential parent-child relationship")
            relationship = "parent"
        elif user2_full_name and (user2_full_name == father1 or user2_full_name == mother1):
            score += 0.8
            reasons.append("Potential parent-child relationship")
            relationship = "child"
        
        # Same family name bonus
        last1 = self.normalize_name(user1.get("last_name", ""))
        last2 = self.normalize_name(user2.get("last_name", ""))
        if last1 and last2 and last1 == last2:
            score += 0.2
            reasons.append(f"Same family name: {user1.get('last_name', 'Unknown')}")
        
        return {
            "score": min(score, 1.0),
            "reasons": reasons,
            "relationship": relationship
        }
    
    def analyze_location_similarity(self, user1: Dict, user2: Dict) -> Dict:
        """Analyze geographic proximity and location similarity."""
        score = 0.0
        reasons = []
        
        loc1 = user1.get("location", "").strip()
        loc2 = user2.get("location", "").strip()
        
        if not loc1 or not loc2:
            return {"score": 0.0, "reasons": []}
        
        # Exact match
        if loc1.lower() == loc2.lower():
            score = 1.0
            reasons.append(f"Same location: {loc1}")
        else:
            # Parse location components
            loc1_parts = self.parse_location(loc1)
            loc2_parts = self.parse_location(loc2)
            
            # City match
            if loc1_parts.get("city") and loc2_parts.get("city"):
                if loc1_parts["city"].lower() == loc2_parts["city"].lower():
                    score += 0.7
                    reasons.append(f"Same city: {loc1_parts['city']}")
            
            # Country match
            if loc1_parts.get("country") and loc2_parts.get("country"):
                if loc1_parts["country"].lower() == loc2_parts["country"].lower():
                    score += 0.3
                    reasons.append(f"Same country: {loc1_parts['country']}")
            
            # String similarity for partial matches
            similarity = SequenceMatcher(None, loc1.lower(), loc2.lower()).ratio()
            if similarity > 0.6:
                score = max(score, similarity * 0.8)
                reasons.append("Similar location areas")
        
        return {
            "score": min(score, 1.0),
            "reasons": reasons
        }
    
    def analyze_profession_similarity(self, user1: Dict, user2: Dict) -> Dict:
        """Analyze professional compatibility and career similarity."""
        score = 0.0
        reasons = []
        
        prof1 = user1.get("profession", "").strip()
        prof2 = user2.get("profession", "").strip()
        
        if not prof1 or not prof2:
            return {"score": 0.0, "reasons": []}
        
        # Exact match
        if prof1.lower() == prof2.lower():
            score = 1.0
            reasons.append(f"Same profession: {prof1}")
        else:
            # Industry classification
            industry1 = self.classify_industry(prof1)
            industry2 = self.classify_industry(prof2)
            
            if industry1 and industry2 and industry1 == industry2:
                score += 0.6
                reasons.append(f"Same industry: {industry1}")
            
            # String similarity for related professions
            similarity = SequenceMatcher(None, prof1.lower(), prof2.lower()).ratio()
            if similarity > 0.5:
                score = max(score, similarity * 0.7)
                reasons.append("Related profession")
        
        return {
            "score": min(score, 1.0),
            "reasons": reasons
        }
    
    def analyze_age_compatibility(self, user1: Dict, user2: Dict) -> Dict:
        """Analyze age compatibility for social connections."""
        score = 0.0
        reasons = []
        
        age1 = self.calculate_age(user1.get("date_of_birth"))
        age2 = self.calculate_age(user2.get("date_of_birth"))
        
        if not age1 or not age2:
            return {"score": 0.0, "reasons": []}
        
        age_diff = abs(age1 - age2)
        
        # Age compatibility scoring
        if age_diff <= 3:
            score = 1.0
            reasons.append("Very close in age")
        elif age_diff <= 7:
            score = 0.8
            reasons.append("Similar age group")
        elif age_diff <= 15:
            score = 0.5
            reasons.append("Compatible age range")
        elif age_diff <= 25:
            score = 0.2
            reasons.append("Different generations but compatible")
        
        # Life stage compatibility
        life_stage1 = self.get_life_stage(age1)
        life_stage2 = self.get_life_stage(age2)
        
        if life_stage1 == life_stage2:
            score += 0.2
            reasons.append(f"Same life stage: {life_stage1}")
        
        return {
            "score": min(score, 1.0),
            "reasons": reasons
        }
    
    def analyze_name_similarity(self, user1: Dict, user2: Dict) -> Dict:
        """Analyze name similarity for cultural and family connections."""
        score = 0.0
        reasons = []
        
        first1 = self.normalize_name(user1.get("first_name", ""))
        first2 = self.normalize_name(user2.get("first_name", ""))
        last1 = self.normalize_name(user1.get("last_name", ""))
        last2 = self.normalize_name(user2.get("last_name", ""))
        
        # First name similarity
        if first1 and first2:
            similarity = SequenceMatcher(None, first1, first2).ratio()
            if similarity > 0.8:
                score += 0.3
                reasons.append("Very similar first names")
            elif similarity > 0.6:
                score += 0.2
                reasons.append("Similar first names")
        
        # Last name analysis (already covered in family analysis, but add cultural aspect)
        if last1 and last2 and last1 == last2:
            score += 0.4
            # Don't add reason here as it's covered in family analysis
        
        # Cultural name patterns
        cultural_score = self.analyze_name_cultural_patterns(user1, user2)
        if cultural_score > 0:
            score += cultural_score * 0.3
            reasons.append("Similar cultural naming patterns")
        
        return {
            "score": min(score, 1.0),
            "reasons": reasons
        }
    
    def analyze_cultural_similarity(self, user1: Dict, user2: Dict) -> Dict:
        """Analyze cultural background and heritage similarity."""
        score = 0.0
        reasons = []
        
        # Language inference from names
        lang1 = self.infer_language_from_name(user1)
        lang2 = self.infer_language_from_name(user2)
        
        if lang1 and lang2 and lang1 == lang2:
            score += 0.5
            reasons.append(f"Similar cultural background: {lang1}")
        
        # Geographic cultural regions
        region1 = self.infer_cultural_region(user1)
        region2 = self.infer_cultural_region(user2)
        
        if region1 and region2 and region1 == region2:
            score += 0.3
            reasons.append(f"Same cultural region: {region1}")
        
        return {
            "score": min(score, 1.0),
            "reasons": reasons
        }
    
    # Helper methods
    def normalize_name(self, name: str) -> str:
        """Normalize name for comparison."""
        if not name:
            return ""
        return re.sub(r'[^\w\s]', '', name.strip().lower())
    
    def parse_location(self, location: str) -> Dict[str, str]:
        """Parse location into components."""
        parts = [part.strip() for part in location.split(',')]
        if len(parts) >= 2:
            return {
                "city": parts[0],
                "country": parts[-1],
                "region": parts[1] if len(parts) > 2 else None
            }
        return {"city": location, "country": None, "region": None}
    
    def classify_industry(self, profession: str) -> Optional[str]:
        """Classify profession into industry categories."""
        profession = profession.lower()
        
        industries = {
            "technology": ["engineer", "developer", "programmer", "software", "tech", "it", "data", "ai"],
            "healthcare": ["doctor", "nurse", "physician", "medical", "healthcare", "hospital"],
            "education": ["teacher", "professor", "educator", "academic", "school"],
            "finance": ["banker", "finance", "accounting", "economist", "investment"],
            "business": ["manager", "executive", "entrepreneur", "business", "sales", "marketing"],
            "creative": ["artist", "designer", "writer", "musician", "creative", "media"],
            "service": ["consultant", "advisor", "service", "support", "customer"],
            "legal": ["lawyer", "attorney", "legal", "judge", "law"],
            "transportation": ["pilot", "driver", "transportation", "logistics", "aviation"]
        }
        
        for industry, keywords in industries.items():
            if any(keyword in profession for keyword in keywords):
                return industry
        
        return None
    
    def calculate_age(self, date_of_birth) -> Optional[int]:
        """Calculate age from date of birth."""
        if not date_of_birth:
            return None
        
        try:
            if isinstance(date_of_birth, str):
                dob = datetime.strptime(date_of_birth, "%Y-%m-%d")
            else:
                dob = date_of_birth
            
            today = datetime.now()
            return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        except:
            return None
    
    def get_life_stage(self, age: int) -> str:
        """Determine life stage based on age."""
        if age < 18:
            return "teenage"
        elif age < 25:
            return "young_adult"
        elif age < 35:
            return "early_career"
        elif age < 45:
            return "established"
        elif age < 60:
            return "mature"
        else:
            return "senior"
    
    def analyze_name_cultural_patterns(self, user1: Dict, user2: Dict) -> float:
        """Analyze cultural patterns in names."""
        # This would implement more sophisticated cultural name analysis
        # For now, simple pattern matching
        return 0.0
    
    def infer_language_from_name(self, user: Dict) -> Optional[str]:
        """Infer likely cultural/linguistic background from name."""
        # Simplified implementation - would use more sophisticated NLP
        name = f"{user.get('first_name', '')} {user.get('last_name', '')}".lower()
        
        # Simple pattern matching for common cultural names
        if any(pattern in name for pattern in ['muhammad', 'ahmed', 'ali', 'hassan', 'omar']):
            return "Arabic"
        elif any(pattern in name for pattern in ['chen', 'wang', 'li', 'zhang', 'liu']):
            return "Chinese"
        elif any(pattern in name for pattern in ['kumar', 'sharma', 'patel', 'singh', 'gupta']):
            return "Indian"
        
        return None
    
    def infer_cultural_region(self, user: Dict) -> Optional[str]:
        """Infer cultural region from location and name."""
        location = user.get("location", "").lower()
        
        if any(country in location for country in ['uae', 'dubai', 'abu dhabi', 'saudi', 'qatar']):
            return "Middle East"
        elif any(country in location for country in ['india', 'pakistan', 'bangladesh']):
            return "South Asia"
        elif any(country in location for country in ['china', 'japan', 'korea', 'singapore']):
            return "East Asia"
        elif any(country in location for country in ['france', 'germany', 'italy', 'spain', 'uk']):
            return "Europe"
        
        return None
    
    def predict_friend_relationship(self, user1: Dict, user2: Dict, algorithm_scores: Dict, reasons: List[str]) -> str:
        """Predict specific type of friend relationship based on data."""
        
        # Check for education/school connections
        edu1_primary = user1.get("primary_school", "").lower()
        edu1_secondary = user1.get("secondary_school", "") or user1.get("high_school", "")
        edu1_university = user1.get("university", "") or user1.get("college", "")
        
        edu2_primary = user2.get("primary_school", "").lower()
        edu2_secondary = user2.get("secondary_school", "") or user2.get("high_school", "")
        edu2_university = user2.get("university", "") or user2.get("college", "")
        
        # Check school matches
        if edu1_primary and edu2_primary and edu1_primary == edu2_primary:
            return "primary school classmate"
        if edu1_secondary and edu2_secondary:
            if isinstance(edu1_secondary, str) and isinstance(edu2_secondary, str):
                if edu1_secondary.lower() == edu2_secondary.lower():
                    return "high school classmate"
        if edu1_university and edu2_university:
            if isinstance(edu1_university, str) and isinstance(edu2_university, str):
                if edu1_university.lower() == edu2_university.lower():
                    return "university classmate"
        
        # Check for childhood connections based on age and location
        age1 = self.calculate_age(user1.get("date_of_birth"))
        age2 = self.calculate_age(user2.get("date_of_birth"))
        
        if age1 and age2 and abs(age1 - age2) <= 5:  # Similar age
            if algorithm_scores.get("location", 0) > 0.7:  # Same location
                if age1 < 25 or age2 < 25:  # Still young
                    return "childhood friend"
                else:
                    return "old neighborhood friend"
        
        # Check for work/professional connections
        prof1 = user1.get("profession", "").lower()
        prof2 = user2.get("profession", "").lower()
        if prof1 and prof2 and algorithm_scores.get("profession", 0) > 0.6:
            return "colleague"
        
        # Check for shared interests/hobbies
        for reason in reasons:
            reason_lower = reason.lower()
            if "school" in reason_lower:
                return "old classmate"
            if "childhood" in reason_lower or "grew up" in reason_lower:
                return "childhood friend"
            if "neighbor" in reason_lower:
                return "old neighbor"
            if "profession" in reason_lower or "work" in reason_lower:
                return "professional connection"
        
        # Age-based friendship
        if age1 and age2:
            age_diff = abs(age1 - age2)
            if age_diff <= 3:
                return "peer friend"
            elif age_diff <= 10:
                return "friend"
        
        return "possible friend"

# Initialize matching engine
matching_engine = None

@app.post("/match/find", response_model=MatchResponse)
async def find_matches(request: MatchRequest):
    """Find matches for a user using advanced AI algorithms."""
    global matching_engine
    
    if not matching_engine:
        matching_engine = AdvancedAIMatchingEngine(mongo_db)
    
    start_time = datetime.utcnow()
    
    try:
        matches = await matching_engine.find_matches(request.user_id, request.dict())
        
        # Convert to response format
        match_results = []
        for match in matches:
            if match["confidence_score"] >= request.min_confidence:
                match_result = MatchResult(
                    user_id=match["user_id"],
                    confidence_score=match["confidence_score"],
                    match_type=match["match_type"],
                    match_reasons=match["match_reasons"],
                    algorithm_scores=match.get("algorithm_scores", {}),
                    predicted_relationship=match.get("predicted_relationship")
                )
                match_results.append(match_result)
        
        # Apply result limit
        match_results = match_results[:request.max_results]
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        response = MatchResponse(
            user_id=request.user_id,
            matches=match_results,
            total_matches=len(match_results),
            processing_time_ms=processing_time
        )
        
        logger.info(f"✅ Returned {len(match_results)} matches for user {request.user_id} in {processing_time:.1f}ms")
        
        return response
        
    except Exception as e:
        logger.error(f"❌ Matching request failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(e)}")

@app.get("/test/users")
async def list_test_users():
    """List users available for testing."""
    try:
        users = list(mongo_db.users.find({}).limit(20))
        
        user_list = []
        for user in users:
            user_info = {
                "id": str(user["_id"]),
                "name": f"{user.get('first_name', 'Unknown')} {user.get('last_name', 'Unknown')}",
                "email": user.get("email"),
                "father_name": user.get("father_name"),
                "mother_name": user.get("mother_name"),
                "location": user.get("location"),
                "profession": user.get("profession"),
                "age": matching_engine.calculate_age(user.get("date_of_birth")) if matching_engine else None
            }
            user_list.append(user_info)
        
        return {"users": user_list, "total": len(user_list)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list users: {str(e)}")

if __name__ == "__main__":
    logger.info("🚀 Starting YoFam AI Matching Production Service...")
    uvicorn.run(
        "production_matching_service:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )