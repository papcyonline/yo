"""
Real AI Matching Engine
========================

Production matching engine that analyzes real user data to find meaningful connections.
Uses multiple algorithms to calculate similarity and relationship predictions.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, date
import re
import unicodedata
from difflib import SequenceMatcher
import math

logger = logging.getLogger(__name__)

class RealMatchingEngine:
    """Production AI matching engine using real user data"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Matching algorithm weights
        self.weights = {
            'name_similarity': 0.35,
            'location_proximity': 0.25, 
            'demographic_match': 0.20,
            'interests_overlap': 0.15,
            'temporal_proximity': 0.05
        }
        
        # Common family name patterns
        self.family_indicators = {
            'same_last_name': 0.8,
            'similar_last_name': 0.6,
            'common_cultural_names': 0.4,
            'location_family_clusters': 0.5
        }
    
    def calculate_name_similarity(self, user1: Dict, user2: Dict) -> Tuple[float, List[str]]:
        """Calculate name-based similarity and matching reasons"""
        reasons = []
        score = 0.0
        
        # Extract names
        name1_first = self.normalize_name(user1.get('first_name', ''))
        name1_last = self.normalize_name(user1.get('last_name', ''))
        name2_first = self.normalize_name(user2.get('first_name', ''))
        name2_last = self.normalize_name(user2.get('last_name', ''))
        
        # Exact last name match (strong family indicator)
        if name1_last and name2_last and name1_last == name2_last:
            score += 0.8
            reasons.append(f"Same last name: {name1_last}")
        
        # Similar last name (fuzzy match)
        elif name1_last and name2_last:
            similarity = SequenceMatcher(None, name1_last, name2_last).ratio()
            if similarity > 0.8:
                score += 0.6 * similarity
                reasons.append(f"Similar last name: {name1_last} / {name2_last}")
        
        # First name similarity
        if name1_first and name2_first:
            first_similarity = SequenceMatcher(None, name1_first, name2_first).ratio()
            if first_similarity > 0.7:
                score += 0.3 * first_similarity
                reasons.append(f"Similar first name: {name1_first} / {name2_first}")
        
        # Cultural name patterns (Arabic, Western, etc.)
        cultural_score = self.analyze_cultural_names(user1, user2)
        if cultural_score > 0:
            score += cultural_score * 0.4
            reasons.append("Similar cultural naming patterns")
        
        return min(score, 1.0), reasons
    
    def calculate_location_proximity(self, user1: Dict, user2: Dict) -> Tuple[float, List[str]]:
        """Calculate location-based similarity"""
        reasons = []
        score = 0.0
        
        loc1 = user1.get('location', '')
        loc2 = user2.get('location', '')
        
        if not loc1 or not loc2:
            return 0.0, reasons
        
        loc1_norm = self.normalize_location(loc1)
        loc2_norm = self.normalize_location(loc2)
        
        # Exact location match
        if loc1_norm == loc2_norm:
            score = 0.9
            reasons.append(f"Same location: {loc1}")
        
        # City/region similarity
        elif self.locations_nearby(loc1_norm, loc2_norm):
            score = 0.6
            reasons.append(f"Nearby locations: {loc1} / {loc2}")
        
        # Country/state level match
        elif self.same_region(loc1_norm, loc2_norm):
            score = 0.3
            reasons.append(f"Same region: {loc1} / {loc2}")
        
        return score, reasons
    
    def calculate_demographic_match(self, user1: Dict, user2: Dict) -> Tuple[float, List[str]]:
        """Calculate demographic compatibility"""
        reasons = []
        score = 0.0
        
        # Age proximity
        age_score = self.calculate_age_proximity(user1, user2)
        if age_score > 0:
            score += age_score * 0.5
            if age_score > 0.7:
                reasons.append("Similar age group")
        
        # Gender complementarity (for friend matching)
        gender_score = self.calculate_gender_compatibility(user1, user2)
        score += gender_score * 0.3
        
        # Professional similarity
        prof_score = self.calculate_professional_match(user1, user2)
        if prof_score > 0:
            score += prof_score * 0.2
            if prof_score > 0.7:
                reasons.append("Similar profession")
        
        return min(score, 1.0), reasons
    
    def calculate_interests_overlap(self, user1: Dict, user2: Dict) -> Tuple[float, List[str]]:
        """Calculate shared interests and hobbies"""
        reasons = []
        
        interests1 = self.extract_interests(user1)
        interests2 = self.extract_interests(user2)
        
        if not interests1 or not interests2:
            return 0.0, reasons
        
        # Calculate Jaccard similarity
        intersection = interests1.intersection(interests2)
        union = interests1.union(interests2)
        
        if not union:
            return 0.0, reasons
        
        score = len(intersection) / len(union)
        
        if intersection:
            common_interests = list(intersection)[:3]  # Top 3
            reasons.append(f"Common interests: {', '.join(common_interests)}")
        
        return score, reasons
    
    def calculate_temporal_proximity(self, user1: Dict, user2: Dict) -> Tuple[float, List[str]]:
        """Calculate temporal relationship (joined around same time, etc.)"""
        reasons = []
        
        created1 = user1.get('created_at')
        created2 = user2.get('created_at')
        
        if not created1 or not created2:
            return 0.0, reasons
        
        # Convert to datetime if string
        if isinstance(created1, str):
            created1 = datetime.fromisoformat(created1.replace('Z', '+00:00'))
        if isinstance(created2, str):
            created2 = datetime.fromisoformat(created2.replace('Z', '+00:00'))
        
        # Calculate time difference in days
        time_diff = abs((created1 - created2).days)
        
        # Score based on temporal proximity
        if time_diff <= 7:  # Same week
            score = 0.8
            reasons.append("Joined around the same time")
        elif time_diff <= 30:  # Same month
            score = 0.5
        elif time_diff <= 90:  # Same quarter
            score = 0.2
        else:
            score = 0.0
        
        return score, reasons
    
    def predict_relationship_type(self, user1: Dict, user2: Dict, overall_score: float, name_score: float, match_context: str = "general") -> Tuple[str, str, float]:
        """Predict the type of relationship and confidence based on match context"""
        
        # Extract ages for relationship logic
        age1 = self.extract_age(user1)
        age2 = self.extract_age(user2)
        age_diff = abs(age1 - age2) if age1 and age2 else 0
        
        # Extract locations and professions for context
        loc1 = user1.get('location', '').lower()
        loc2 = user2.get('location', '').lower()
        prof1 = (user1.get('profession') or '').lower()
        prof2 = (user2.get('profession') or '').lower()
        
        same_location = loc1 and loc2 and (loc1 in loc2 or loc2 in loc1)
        same_profession = prof1 and prof2 and prof1 == prof2
        
        # FAMILY CONTEXT - Only family relationship predictions
        if match_context == "family":
            if name_score > 0.6:  # Strong name similarity
                if age_diff <= 3:
                    return "family", "possible twin", 0.9
                elif age_diff <= 8:
                    return "family", "possible sibling", 0.85
                elif age_diff <= 15:
                    return "family", "possible cousin", 0.8
                elif age_diff <= 25:
                    if age1 and age2 and age1 > age2:
                        return "family", "possible uncle/aunt", 0.8
                    else:
                        return "family", "possible nephew/niece", 0.8
                elif age_diff <= 40:
                    if age1 and age2 and age1 > age2:
                        return "family", "possible parent", 0.85
                    else:
                        return "family", "possible child", 0.85
                else:
                    return "family", "possible grandparent/grandchild", 0.75
            
            elif name_score > 0.2 or same_location:  # Moderate name similarity or location
                if age_diff <= 5:
                    return "family", "possible sibling", 0.75
                elif age_diff <= 15:
                    return "family", "possible cousin", 0.7
                elif age_diff <= 30:
                    return "family", "possible uncle/aunt or nephew/niece", 0.7
                else:
                    return "family", "possible distant relative", 0.65
            
            else:  # Lower similarity
                if age_diff <= 10:
                    return "family", "possible distant cousin", 0.6
                elif age_diff <= 25:
                    return "family", "possible distant relative", 0.55
                else:
                    return "family", "possible extended family", 0.5
        
        # FRIEND CONTEXT - Only friendship relationship predictions  
        elif match_context == "friend":
            if same_profession and age_diff <= 10:
                return "friend", "possible colleague", 0.8
            elif same_location:
                if age_diff <= 5:
                    return "friend", "possible childhood friend", 0.8
                elif age_diff <= 15:
                    return "friend", "possible classmate", 0.75
                else:
                    return "friend", "possible neighbor", 0.7
            elif name_score > 0.3:  # Similar names
                if age_diff <= 5:
                    return "friend", "possible old friend", 0.75
                elif age_diff <= 15:
                    return "friend", "possible school friend", 0.7
                else:
                    return "friend", "possible acquaintance", 0.65
            elif same_profession:
                return "friend", "possible work colleague", 0.7
            elif overall_score > 0.3:
                if age_diff <= 5:
                    return "friend", "possible close friend", 0.7
                elif age_diff <= 15:
                    return "friend", "possible old friend", 0.65
                else:
                    return "friend", "possible acquaintance", 0.6
            else:
                return "friend", "possible social connection", 0.55
        
        # COMMUNITY CONTEXT - Only community relationship predictions
        elif match_context == "community":
            if same_location and same_profession:
                return "community", "possible local professional", 0.75
            elif same_location:
                if age_diff <= 10:
                    return "community", "possible neighbor", 0.7
                else:
                    return "community", "possible local resident", 0.65
            elif same_profession:
                return "community", "possible industry peer", 0.7
            elif overall_score > 0.3:
                return "community", "possible community member", 0.6
            else:
                return "community", "possible connection", 0.5
        
        # DEFAULT GENERAL CONTEXT - Mixed predictions (fallback)
        else:
            if name_score > 0.7:
                return "family", "possible relative", 0.8
            elif overall_score > 0.6:
                return "friend", "possible friend", 0.7
            else:
                return "community", "possible connection", 0.5
    
    def normalize_name(self, name: str) -> str:
        """Normalize name for comparison"""
        if not name:
            return ""
        
        # Convert to string if not already
        name = str(name)
        
        # Remove diacritics and normalize unicode
        name = unicodedata.normalize('NFD', name.lower())
        name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
        
        # Remove special characters and extra spaces
        name = re.sub(r'[^\w\s]', '', name)
        name = ' '.join(name.split())
        
        return name
    
    def normalize_location(self, location: str) -> str:
        """Normalize location for comparison"""
        if not location:
            return ""
        
        # Convert to string if not already
        location = str(location).lower().strip()
        # Remove common words
        location = re.sub(r'\b(city|town|village|area|district)\b', '', location)
        location = ' '.join(location.split())
        
        return location
    
    def analyze_cultural_names(self, user1: Dict, user2: Dict) -> float:
        """Analyze cultural naming patterns"""
        # Simple heuristic - could be enhanced with ML models
        name1 = f"{user1.get('first_name', '')} {user1.get('last_name', '')}".lower()
        name2 = f"{user2.get('first_name', '')} {user2.get('last_name', '')}".lower()
        
        # Arabic names pattern
        arabic_patterns = ['ahmed', 'mohammad', 'hassan', 'omar', 'ali', 'fatima', 'aisha', 'zahra']
        arabic1 = any(pattern in name1 for pattern in arabic_patterns)
        arabic2 = any(pattern in name2 for pattern in arabic_patterns)
        
        if arabic1 and arabic2:
            return 0.6
        
        return 0.0
    
    def locations_nearby(self, loc1: str, loc2: str) -> bool:
        """Check if locations are nearby (simple heuristic)"""
        # This could be enhanced with actual geographic distance calculation
        return SequenceMatcher(None, loc1, loc2).ratio() > 0.6
    
    def same_region(self, loc1: str, loc2: str) -> bool:
        """Check if locations are in the same region"""
        # Simple word overlap
        words1 = set(loc1.split())
        words2 = set(loc2.split())
        return len(words1.intersection(words2)) > 0
    
    def calculate_age_proximity(self, user1: Dict, user2: Dict) -> float:
        """Calculate age-based compatibility"""
        age1 = self.extract_age(user1)
        age2 = self.extract_age(user2)
        
        if not age1 or not age2:
            return 0.0
        
        age_diff = abs(age1 - age2)
        
        # Age proximity scoring
        if age_diff <= 2:
            return 1.0
        elif age_diff <= 5:
            return 0.8
        elif age_diff <= 10:
            return 0.6
        elif age_diff <= 20:
            return 0.3
        else:
            return 0.1
    
    def extract_age(self, user: Dict) -> Optional[int]:
        """Extract age from user data"""
        dob = user.get('date_of_birth')
        if not dob:
            return None
        
        try:
            if isinstance(dob, str):
                birth_date = datetime.fromisoformat(dob.replace('Z', '+00:00')).date()
            else:
                birth_date = dob
            
            today = date.today()
            age = today.year - birth_date.year
            if today.month < birth_date.month or (today.month == birth_date.month and today.day < birth_date.day):
                age -= 1
            
            return age
        except:
            return None
    
    def calculate_gender_compatibility(self, user1: Dict, user2: Dict) -> float:
        """Calculate gender-based compatibility"""
        gender1 = user1.get('gender') or ''
        gender2 = user2.get('gender') or ''
        
        if gender1:
            gender1 = str(gender1).lower()
        if gender2:
            gender2 = str(gender2).lower()
        
        if not gender1 or not gender2:
            return 0.5  # Neutral if unknown
        
        # Same gender gets slightly higher score for friendship
        return 0.7 if gender1 == gender2 else 0.5
    
    def calculate_professional_match(self, user1: Dict, user2: Dict) -> float:
        """Calculate professional similarity"""
        prof1 = user1.get('profession') or ''
        prof2 = user2.get('profession') or ''
        
        if prof1:
            prof1 = str(prof1).lower()
        if prof2:
            prof2 = str(prof2).lower()
        
        if not prof1 or not prof2:
            return 0.0
        
        return SequenceMatcher(None, prof1, prof2).ratio()
    
    def extract_interests(self, user: Dict) -> set:
        """Extract interests from user data"""
        interests = user.get('interests', [])
        if isinstance(interests, str):
            # Split by comma if it's a string
            interests = [i.strip().lower() for i in interests.split(',')]
        elif isinstance(interests, list):
            interests = [str(i).strip().lower() for i in interests]
        else:
            interests = []
        
        return set(interests)
    
    async def find_matches(self, target_user_id: str, all_users: List[Dict], max_results: int = 50, min_confidence: float = 0.1, match_context: str = "general") -> List[Dict]:
        """Find matches for a target user with specific context"""
        target_user = None
        candidate_users = []
        
        # Find target user and candidates
        for user in all_users:
            if str(user['_id']) == target_user_id:
                target_user = user
            else:
                candidate_users.append(user)
        
        if not target_user:
            logger.error(f"Target user {target_user_id} not found")
            return []
        
        matches = []
        
        for candidate in candidate_users:
            match_result = await self.calculate_match_with_context(target_user, candidate, match_context)
            if match_result['confidence_score'] >= min_confidence:
                matches.append(match_result)
        
        # Sort by confidence score (descending)
        matches.sort(key=lambda x: x['confidence_score'], reverse=True)
        
        return matches[:max_results]
    
    async def calculate_match(self, user1: Dict, user2: Dict) -> Dict:
        """Calculate comprehensive match between two users (general context)"""
        return await self.calculate_match_with_context(user1, user2, "general")
    
    async def calculate_match_with_context(self, user1: Dict, user2: Dict, match_context: str = "general") -> Dict:
        """Calculate comprehensive match between two users with specific context"""
        
        # Calculate individual similarity scores
        name_score, name_reasons = self.calculate_name_similarity(user1, user2)
        location_score, location_reasons = self.calculate_location_proximity(user1, user2)
        demo_score, demo_reasons = self.calculate_demographic_match(user1, user2)
        interests_score, interests_reasons = self.calculate_interests_overlap(user1, user2)
        temporal_score, temporal_reasons = self.calculate_temporal_proximity(user1, user2)
        
        # Calculate weighted overall score
        overall_score = (
            name_score * self.weights['name_similarity'] +
            location_score * self.weights['location_proximity'] +
            demo_score * self.weights['demographic_match'] +
            interests_score * self.weights['interests_overlap'] +
            temporal_score * self.weights['temporal_proximity']
        )
        
        # Predict relationship type with context
        match_type, predicted_relationship, relationship_confidence = self.predict_relationship_type(
            user1, user2, overall_score, name_score, match_context
        )
        
        # Combine all reasons
        all_reasons = name_reasons + location_reasons + demo_reasons + interests_reasons + temporal_reasons
        
        # Determine confidence level
        if overall_score >= 0.8:
            confidence_level = "high"
        elif overall_score >= 0.6:
            confidence_level = "medium"
        else:
            confidence_level = "low"
        
        return {
            "user_id": str(user2['_id']),
            "confidence_score": round(overall_score, 3),
            "confidence_level": confidence_level,
            "match_type": match_type,
            "algorithm_scores": {
                "name_similarity": round(name_score, 3),
                "location_proximity": round(location_score, 3),
                "demographic_match": round(demo_score, 3),
                "interests_overlap": round(interests_score, 3),
                "temporal_proximity": round(temporal_score, 3)
            },
            "match_reasons": all_reasons[:5],  # Top 5 reasons
            "predicted_relationship": predicted_relationship,
            "relationship_confidence": round(relationship_confidence, 3)
        }