"""
Advanced NLP Name & Location Matching Service
=============================================

Sophisticated natural language processing for genealogy matching.
Handles cultural name variations, historical linguistics, and geographic similarity.

Key Features:
- BERT-based semantic similarity
- Fuzzy string matching with cultural context
- Historical name evolution analysis
- Geographic distance and cultural region matching
- Multi-language name normalization
"""

import logging
import asyncio
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
import re
from dataclasses import dataclass

# NLP libraries
import spacy
from fuzzywuzzy import fuzz, process
from sentence_transformers import SentenceTransformer
import nltk
from nltk.corpus import wordnet
from nltk.metrics.distance import edit_distance

logger = logging.getLogger(__name__)

@dataclass
class NameVariation:
    """Represents a name variation with cultural context."""
    original: str
    variation: str
    culture: str
    confidence: float
    source: str  # "historical", "cultural", "phonetic"

class CulturalNameAnalyzer:
    """
    Analyzes names within cultural and historical context.
    
    Handles variations like:
    - Irish: O'Brien -> Brien, Ó Briain
    - Jewish: Cohen -> Kohen, Kohn
    - German: Schmidt -> Smith, Schmitt
    """
    
    def __init__(self):
        self.cultural_patterns = self._load_cultural_patterns()
        self.historical_mappings = self._load_historical_mappings()
        
    def _load_cultural_patterns(self) -> Dict[str, List[Dict]]:
        """Load cultural naming patterns."""
        return {
            "irish": [
                {"pattern": r"^O'(.+)", "variations": ["Ó {}", "{}"]},
                {"pattern": r"^Mac(.+)", "variations": ["Mc{}", "M'{}", "{}"]},
            ],
            "jewish": [
                {"pattern": r"Cohen", "variations": ["Kohen", "Kohn", "Cohn"]},
                {"pattern": r"Levy", "variations": ["Levi", "Levey", "Levie"]},
            ],
            "german": [
                {"pattern": r"Schmidt", "variations": ["Smith", "Schmitt", "Smidt"]},
                {"pattern": r"Mueller", "variations": ["Miller", "Müller", "Muller"]},
            ],
            "italian": [
                {"pattern": r"(.+)i$", "variations": ["{}o", "{}a"]},
                {"pattern": r"Di (.+)", "variations": ["De {}", "D'{}", "{}"]},
            ]
        }
    
    def _load_historical_mappings(self) -> Dict[str, List[str]]:
        """Load historical name evolution mappings."""
        return {
            "william": ["wilhelm", "guillaume", "guillermo", "bill", "billy", "will", "willy"],
            "john": ["johann", "juan", "jean", "giovanni", "jack", "johnny"],
            "mary": ["maria", "marie", "maja", "maja", "molly", "polly"],
            "james": ["jacques", "diego", "giacomo", "jim", "jimmy", "jamie"],
            "michael": ["mikhail", "miguel", "michele", "mike", "micky", "mick"]
        }
    
    def find_name_variations(self, name: str, culture: Optional[str] = None) -> List[NameVariation]:
        """Find all possible variations of a name."""
        variations = []
        name_lower = name.lower()
        
        # Cultural pattern matching
        if culture and culture.lower() in self.cultural_patterns:
            patterns = self.cultural_patterns[culture.lower()]
            for pattern_data in patterns:
                pattern = pattern_data["pattern"]
                match = re.match(pattern, name, re.IGNORECASE)
                if match:
                    for var_template in pattern_data["variations"]:
                        variation = var_template.format(*match.groups())
                        variations.append(NameVariation(
                            original=name,
                            variation=variation,
                            culture=culture,
                            confidence=0.9,
                            source="cultural"
                        ))
        
        # Historical name evolution
        if name_lower in self.historical_mappings:
            for historical_var in self.historical_mappings[name_lower]:
                variations.append(NameVariation(
                    original=name,
                    variation=historical_var.title(),
                    culture="historical",
                    confidence=0.8,
                    source="historical"
                ))
        
        # Phonetic variations using Soundex-like algorithm
        phonetic_vars = self._generate_phonetic_variations(name)
        for phonetic_var in phonetic_vars:
            variations.append(NameVariation(
                original=name,
                variation=phonetic_var,
                culture="phonetic",
                confidence=0.6,
                source="phonetic"
            ))
        
        return variations
    
    def _generate_phonetic_variations(self, name: str) -> List[str]:
        """Generate phonetic variations of a name."""
        variations = []
        
        # Common phonetic substitutions
        substitutions = [
            ('ph', 'f'), ('gh', 'f'), ('ck', 'k'), ('c', 'k'),
            ('s', 'z'), ('z', 's'), ('i', 'y'), ('y', 'i'),
            ('th', 't'), ('v', 'w'), ('w', 'v')
        ]
        
        current_variations = [name.lower()]
        
        for old, new in substitutions:
            new_variations = []
            for var in current_variations:
                if old in var:
                    new_variations.append(var.replace(old, new))
            current_variations.extend(new_variations)
        
        # Capitalize and deduplicate
        variations = list(set([var.title() for var in current_variations if var != name.lower()]))
        
        return variations[:5]  # Limit to top 5 variations

class GeographicMatcher:
    """
    Advanced geographic matching for locations.
    
    Handles:
    - City/state/country hierarchies
    - Historical place name changes
    - Cultural region similarities
    - Migration pattern analysis
    """
    
    def __init__(self):
        self.place_hierarchies = self._load_place_hierarchies()
        self.historical_places = self._load_historical_places()
        self.cultural_regions = self._load_cultural_regions()
    
    def _load_place_hierarchies(self) -> Dict[str, Dict]:
        """Load geographic hierarchies."""
        return {
            "new_york": {
                "city": "New York",
                "state": "New York",
                "country": "United States",
                "region": "Northeast",
                "aliases": ["NYC", "New York City", "Manhattan"]
            },
            "dublin": {
                "city": "Dublin",
                "county": "Dublin",
                "country": "Ireland",
                "region": "Leinster",
                "aliases": ["Baile Átha Cliath"]
            },
            "london": {
                "city": "London",
                "country": "United Kingdom",
                "region": "England",
                "aliases": ["Greater London", "The City"]
            }
        }
    
    def _load_historical_places(self) -> Dict[str, List[str]]:
        """Load historical place name changes."""
        return {
            "istanbul": ["constantinople", "byzantium"],
            "mumbai": ["bombay"],
            "beijing": ["peking"],
            "sri_lanka": ["ceylon"],
            "zimbabwe": ["rhodesia"]
        }
    
    def _load_cultural_regions(self) -> Dict[str, List[str]]:
        """Load cultural region mappings."""
        return {
            "celtic": ["ireland", "scotland", "wales", "cornwall", "brittany"],
            "scandinavian": ["norway", "sweden", "denmark", "iceland"],
            "mediterranean": ["italy", "spain", "greece", "malta", "cyprus"],
            "germanic": ["germany", "austria", "switzerland", "netherlands"]
        }
    
    def calculate_location_similarity(self, loc1: str, loc2: str) -> float:
        """Calculate similarity between two locations."""
        if not loc1 or not loc2:
            return 0.0
        
        loc1_clean = self._normalize_location(loc1)
        loc2_clean = self._normalize_location(loc2)
        
        # Exact match
        if loc1_clean == loc2_clean:
            return 1.0
        
        # Fuzzy string similarity
        fuzzy_score = fuzz.ratio(loc1_clean, loc2_clean) / 100.0
        
        # Hierarchical matching
        hierarchy_score = self._calculate_hierarchy_similarity(loc1_clean, loc2_clean)
        
        # Cultural region similarity
        cultural_score = self._calculate_cultural_similarity(loc1_clean, loc2_clean)
        
        # Weighted combination
        final_score = (
            fuzzy_score * 0.4 +
            hierarchy_score * 0.4 +
            cultural_score * 0.2
        )
        
        return min(final_score, 1.0)
    
    def _normalize_location(self, location: str) -> str:
        """Normalize location string."""
        # Remove common suffixes and prefixes
        location = re.sub(r'\b(city|town|village|county|state|province)\b', '', location, flags=re.IGNORECASE)
        # Clean whitespace and convert to lowercase
        return ' '.join(location.strip().lower().split())
    
    def _calculate_hierarchy_similarity(self, loc1: str, loc2: str) -> float:
        """Calculate similarity based on geographic hierarchy."""
        # Check if locations are in same hierarchical region
        for key, data in self.place_hierarchies.items():
            if loc1 in [key] + data.get("aliases", []):
                if loc2 in [key] + data.get("aliases", []):
                    return 1.0
                # Check if same state/country
                if loc2 == data.get("state", "").lower() or loc2 == data.get("country", "").lower():
                    return 0.7
                if loc2 == data.get("region", "").lower():
                    return 0.5
        
        return 0.0
    
    def _calculate_cultural_similarity(self, loc1: str, loc2: str) -> float:
        """Calculate similarity based on cultural regions."""
        for region, places in self.cultural_regions.items():
            loc1_in_region = any(place in loc1 for place in places)
            loc2_in_region = any(place in loc2 for place in places)
            
            if loc1_in_region and loc2_in_region:
                return 0.6  # Same cultural region
        
        return 0.0

class NLPNameLocationMatcher:
    """
    Production-grade NLP matching engine for names and locations.
    
    Uses advanced NLP techniques including BERT embeddings, cultural analysis,
    and geographic intelligence for accurate genealogy matching.
    """
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.bert_model: Optional[SentenceTransformer] = None
        self.nlp_model = None
        
        self.cultural_analyzer = CulturalNameAnalyzer()
        self.geo_matcher = GeographicMatcher()
        
        self.is_initialized = False
        
        logger.info("NLP Name & Location Matcher initialized")
    
    async def initialize(self):
        """Initialize NLP models."""
        try:
            logger.info("Loading NLP models...")
            
            # Load BERT model for semantic similarity
            self.bert_model = SentenceTransformer(self.model_name)
            
            # Load spaCy model for NER and linguistic analysis
            try:
                self.nlp_model = spacy.load("en_core_web_sm")
            except OSError:
                logger.warning("spaCy English model not found, using basic processing")
                self.nlp_model = None
            
            # Download NLTK data if needed
            try:
                nltk.data.find('corpora/wordnet')
            except LookupError:
                nltk.download('wordnet')
            
            self.is_initialized = True
            logger.info("✅ NLP models loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize NLP models: {str(e)}")
            raise
    
    async def find_matches(self, user_profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Find matches using advanced NLP techniques.
        
        Args:
            user_profile: User profile with name and location data
            
        Returns:
            List of potential matches with NLP-based confidence scores
        """
        if not self.is_initialized:
            raise RuntimeError("NLP matcher not initialized")
        
        try:
            matches = []
            user_id = user_profile.get("user_id")
            
            # Extract names and locations
            first_name = user_profile.get("first_name", "")
            last_name = user_profile.get("last_name", "")
            location = user_profile.get("location", "")
            cultural_background = user_profile.get("cultural_background", "")
            
            # Generate name variations
            first_name_vars = self.cultural_analyzer.find_name_variations(
                first_name, cultural_background
            )
            last_name_vars = self.cultural_analyzer.find_name_variations(
                last_name, cultural_background
            )
            
            # Find matches using NLP similarity
            # In production, this would query a database of users
            candidate_users = await self._get_candidate_users(user_profile)
            
            for candidate in candidate_users:
                similarity_score = await self._calculate_nlp_similarity(
                    user_profile, candidate
                )
                
                if similarity_score > 0.3:  # Minimum threshold
                    matches.append({
                        "user_id": candidate["user_id"],
                        "confidence_score": similarity_score,
                        "match_type": self._determine_match_type(similarity_score),
                        "match_reasons": await self._generate_match_reasons(user_profile, candidate),
                        "name_similarity": await self._calculate_name_similarity(user_profile, candidate),
                        "location_similarity": self._calculate_location_similarity(
                            user_profile.get("location", ""),
                            candidate.get("location", "")
                        ),
                        "model_source": "nlp_bert_fuzzy"
                    })
            
            # Sort by confidence
            matches.sort(key=lambda x: x["confidence_score"], reverse=True)
            
            logger.info(f"NLP matcher found {len(matches)} matches")
            return matches
            
        except Exception as e:
            logger.error(f"NLP matching error: {str(e)}")
            return []
    
    async def _get_candidate_users(self, user_profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get candidate users for matching (mock implementation)."""
        # In production, this would query the database intelligently
        # using name prefixes, location proximity, etc.
        
        return [
            {
                "user_id": "candidate_1",
                "first_name": "John",
                "last_name": "Smith", 
                "location": "Boston, MA",
                "cultural_background": "Irish-American"
            },
            {
                "user_id": "candidate_2",
                "first_name": "Sean",
                "last_name": "Smith",
                "location": "New York, NY", 
                "cultural_background": "Irish-American"
            },
            {
                "user_id": "candidate_3",
                "first_name": "Johann",
                "last_name": "Schmidt",
                "location": "Berlin, Germany",
                "cultural_background": "German"
            }
        ]
    
    async def _calculate_nlp_similarity(
        self,
        profile1: Dict[str, Any],
        profile2: Dict[str, Any]
    ) -> float:
        """Calculate overall NLP-based similarity between profiles."""
        
        # Name similarity
        name_sim = await self._calculate_name_similarity(profile1, profile2)
        
        # Location similarity
        location_sim = self.geo_matcher.calculate_location_similarity(
            profile1.get("location", ""), 
            profile2.get("location", "")
        )
        
        # Cultural background similarity
        cultural_sim = self._calculate_cultural_similarity(
            profile1.get("cultural_background", ""),
            profile2.get("cultural_background", "")
        )
        
        # Semantic similarity using BERT
        semantic_sim = await self._calculate_semantic_similarity(profile1, profile2)
        
        # Weighted combination
        overall_similarity = (
            name_sim * 0.4 +
            location_sim * 0.25 +
            cultural_sim * 0.20 +
            semantic_sim * 0.15
        )
        
        return min(overall_similarity, 1.0)
    
    async def _calculate_name_similarity(
        self,
        profile1: Dict[str, Any],
        profile2: Dict[str, Any]
    ) -> float:
        """Calculate name similarity with cultural context."""
        
        first1 = profile1.get("first_name", "").lower()
        last1 = profile1.get("last_name", "").lower()
        first2 = profile2.get("first_name", "").lower()
        last2 = profile2.get("last_name", "").lower()
        
        if not all([first1, last1, first2, last2]):
            return 0.0
        
        # Exact matches
        if first1 == first2 and last1 == last2:
            return 1.0
        
        # Calculate individual name similarities
        first_sim = self._calculate_single_name_similarity(
            first1, first2, profile1.get("cultural_background")
        )
        last_sim = self._calculate_single_name_similarity(
            last1, last2, profile1.get("cultural_background")
        )
        
        # Combined similarity (last name weighted more heavily for genealogy)
        combined_sim = first_sim * 0.3 + last_sim * 0.7
        
        return combined_sim
    
    def _calculate_single_name_similarity(
        self,
        name1: str,
        name2: str,
        cultural_context: Optional[str] = None
    ) -> float:
        """Calculate similarity between two individual names."""
        
        if name1 == name2:
            return 1.0
        
        # Fuzzy string matching
        fuzzy_score = fuzz.ratio(name1, name2) / 100.0
        
        # Cultural variation matching
        cultural_score = 0.0
        if cultural_context:
            variations1 = self.cultural_analyzer.find_name_variations(name1, cultural_context)
            variations2 = self.cultural_analyzer.find_name_variations(name2, cultural_context)
            
            # Check if names are cultural variations of each other
            for var1 in variations1:
                if var1.variation.lower() == name2:
                    cultural_score = var1.confidence
                    break
            
            for var2 in variations2:
                if var2.variation.lower() == name1:
                    cultural_score = max(cultural_score, var2.confidence)
                    break
        
        # Edit distance penalty
        edit_dist = edit_distance(name1, name2)
        max_len = max(len(name1), len(name2))
        edit_score = 1 - (edit_dist / max_len) if max_len > 0 else 0
        
        # Weighted combination
        final_score = max(
            fuzzy_score * 0.4 + cultural_score * 0.4 + edit_score * 0.2,
            cultural_score  # Cultural variations can override fuzzy matching
        )
        
        return min(final_score, 1.0)
    
    def _calculate_cultural_similarity(self, culture1: str, culture2: str) -> float:
        """Calculate cultural background similarity."""
        if not culture1 or not culture2:
            return 0.0
        
        culture1 = culture1.lower()
        culture2 = culture2.lower()
        
        if culture1 == culture2:
            return 1.0
        
        # Check if cultures are related
        cultural_groups = {
            "celtic": ["irish", "scottish", "welsh"],
            "germanic": ["german", "dutch", "austrian"],
            "scandinavian": ["norwegian", "swedish", "danish"],
            "slavic": ["polish", "russian", "czech", "slovak"]
        }
        
        for group, cultures in cultural_groups.items():
            if any(c in culture1 for c in cultures) and any(c in culture2 for c in cultures):
                return 0.7
        
        # Fuzzy matching for compound cultures (e.g., "Irish-American")
        return fuzz.ratio(culture1, culture2) / 100.0 * 0.5
    
    async def _calculate_semantic_similarity(
        self,
        profile1: Dict[str, Any],
        profile2: Dict[str, Any]
    ) -> float:
        """Calculate semantic similarity using BERT embeddings."""
        
        if not self.bert_model:
            return 0.0
        
        try:
            # Create profile text representations
            text1 = self._create_profile_text(profile1)
            text2 = self._create_profile_text(profile2)
            
            if not text1 or not text2:
                return 0.0
            
            # Generate embeddings
            embeddings = self.bert_model.encode([text1, text2])
            
            # Calculate cosine similarity
            similarity = np.dot(embeddings[0], embeddings[1]) / (
                np.linalg.norm(embeddings[0]) * np.linalg.norm(embeddings[1])
            )
            
            return float(similarity)
            
        except Exception as e:
            logger.error(f"BERT similarity calculation error: {str(e)}")
            return 0.0
    
    def _create_profile_text(self, profile: Dict[str, Any]) -> str:
        """Create text representation of user profile for BERT analysis."""
        text_parts = []
        
        # Add name information
        first_name = profile.get("first_name", "")
        last_name = profile.get("last_name", "")
        if first_name and last_name:
            text_parts.append(f"Name: {first_name} {last_name}")
        
        # Add location
        location = profile.get("location", "")
        if location:
            text_parts.append(f"Location: {location}")
        
        # Add cultural background
        culture = profile.get("cultural_background", "")
        if culture:
            text_parts.append(f"Culture: {culture}")
        
        # Add profession
        profession = profile.get("profession", "")
        if profession:
            text_parts.append(f"Profession: {profession}")
        
        return ". ".join(text_parts)
    
    def _calculate_location_similarity(self, loc1: str, loc2: str) -> float:
        """Calculate location similarity using geographic matcher."""
        return self.geo_matcher.calculate_location_similarity(loc1, loc2)
    
    async def _generate_match_reasons(
        self,
        profile1: Dict[str, Any],
        profile2: Dict[str, Any]
    ) -> List[str]:
        """Generate human-readable reasons for the match."""
        reasons = []
        
        # Name similarity reasons
        name_sim = await self._calculate_name_similarity(profile1, profile2)
        if name_sim > 0.8:
            reasons.append("Very similar names")
        elif name_sim > 0.6:
            reasons.append("Similar names with possible variations")
        
        # Location reasons
        loc_sim = self._calculate_location_similarity(
            profile1.get("location", ""), 
            profile2.get("location", "")
        )
        if loc_sim > 0.9:
            reasons.append("Same location")
        elif loc_sim > 0.6:
            reasons.append("Similar geographic region")
        
        # Cultural reasons
        culture1 = profile1.get("cultural_background", "")
        culture2 = profile2.get("cultural_background", "")
        if culture1 and culture2:
            cultural_sim = self._calculate_cultural_similarity(culture1, culture2)
            if cultural_sim > 0.9:
                reasons.append("Same cultural background")
            elif cultural_sim > 0.6:
                reasons.append("Related cultural heritage")
        
        return reasons if reasons else ["General profile similarity"]
    
    def _determine_match_type(self, confidence: float) -> str:
        """Determine match type based on confidence score."""
        if confidence >= 0.80:
            return "family"
        elif confidence >= 0.60:
            return "friend" 
        else:
            return "community"
    
    async def calculate_name_similarity(
        self,
        profile1: Dict[str, Any],
        profile2: Dict[str, Any]
    ) -> float:
        """Public method to calculate name similarity between profiles."""
        return await self._calculate_name_similarity(profile1, profile2)
    
    async def health_check(self) -> bool:
        """Check if NLP engine is healthy."""
        try:
            if not self.is_initialized:
                return False
            
            # Test BERT model
            if self.bert_model:
                test_embeddings = self.bert_model.encode(["test"])
                if test_embeddings is None or len(test_embeddings) == 0:
                    return False
            
            # Test cultural analyzer
            test_variations = self.cultural_analyzer.find_name_variations("John", "Irish")
            
            return True
            
        except Exception as e:
            logger.error(f"NLP health check failed: {str(e)}")
            return False
    
    async def get_status(self) -> Dict[str, Any]:
        """Get status information about NLP engine."""
        return {
            "initialized": self.is_initialized,
            "bert_model": self.model_name,
            "bert_loaded": self.bert_model is not None,
            "spacy_loaded": self.nlp_model is not None,
            "cultural_patterns": len(self.cultural_analyzer.cultural_patterns),
            "historical_mappings": len(self.cultural_analyzer.historical_mappings),
            "place_hierarchies": len(self.geo_matcher.place_hierarchies)
        }
    
    async def update_models(self):
        """Update NLP models with new data."""
        logger.info("Updating NLP models...")
        # In production, this would retrain or update models
        # For now, just reload cultural patterns
        self.cultural_analyzer = CulturalNameAnalyzer()
        self.geo_matcher = GeographicMatcher()
        logger.info("✅ NLP models updated")