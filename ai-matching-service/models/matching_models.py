"""
Pydantic Models for AI Matching Service
=======================================

Data models for request/response handling, validation, and type safety.
"""

from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum

class MatchType(str, Enum):
    """Types of matches the system can find."""
    FAMILY = "family"
    FRIEND = "friend"
    COMMUNITY = "community"
    HERITAGE = "heritage"
    ALL = "all"

class ConfidenceLevel(str, Enum):
    """Confidence levels for matches."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class MatchRequest(BaseModel):
    """Request for finding matches."""
    user_id: str = Field(..., description="ID of the user to find matches for")
    match_types: Optional[List[MatchType]] = Field(
        default=[MatchType.ALL], 
        description="Types of matches to find"
    )
    max_results: Optional[int] = Field(
        default=50, 
        ge=1, 
        le=1000, 
        description="Maximum number of results to return"
    )
    min_confidence: Optional[float] = Field(
        default=0.5, 
        ge=0.0, 
        le=1.0, 
        description="Minimum confidence score for matches"
    )
    match_context: Optional[str] = Field(
        default="general",
        description="Context for matching: family, friend, community, or general"
    )
    include_reasons: bool = Field(
        default=True, 
        description="Include match reasoning in results"
    )
    algorithms: Optional[List[str]] = Field(
        default=None,
        description="Specific algorithms to use (optional)"
    )
    
    @validator('user_id')
    def validate_user_id(cls, v):
        if not v or not v.strip():
            raise ValueError('user_id cannot be empty')
        return v.strip()

class BatchMatchRequest(BaseModel):
    """Request for batch matching multiple users."""
    user_ids: List[str] = Field(..., description="List of user IDs to process")
    match_types: Optional[List[MatchType]] = Field(default=[MatchType.ALL])
    max_results: Optional[int] = Field(default=20, ge=1, le=100)
    min_confidence: Optional[float] = Field(default=0.5, ge=0.0, le=1.0)
    
    @validator('user_ids')
    def validate_user_ids(cls, v):
        if not v:
            raise ValueError('user_ids cannot be empty')
        if len(v) > 100:
            raise ValueError('Cannot process more than 100 users in a batch')
        return v

class UserProfile(BaseModel):
    """User profile data for matching."""
    user_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    maiden_name: Optional[str] = None
    
    birth_date: Optional[str] = None
    birth_location: Optional[str] = None
    current_location: Optional[str] = None
    
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    mother_maiden_name: Optional[str] = None
    
    profession: Optional[str] = None
    education: Optional[Dict[str, Any]] = None
    
    cultural_background: Optional[str] = None
    family_origin: Optional[str] = None
    primary_language: Optional[str] = None
    languages_spoken: Optional[List[str]] = None
    
    # Genetic data (if available)
    dna_data: Optional[Dict[str, Any]] = None
    genetic_markers: Optional[List[str]] = None
    haplogroups: Optional[Dict[str, str]] = None
    
    # Social connections
    known_relatives: Optional[List[str]] = None
    connections: Optional[List[str]] = None
    
    # AI responses and interests
    ai_questionnaire_responses: Optional[Dict[str, Any]] = None
    interests: Optional[List[str]] = None
    
    # Metadata
    profile_completeness: Optional[float] = None
    last_updated: Optional[datetime] = None
    
    class Config:
        extra = "allow"  # Allow additional fields

class MatchResult(BaseModel):
    """Individual match result."""
    user_id: str = Field(..., description="ID of the matched user")
    confidence_score: float = Field(
        ..., 
        ge=0.0, 
        le=1.0, 
        description="Confidence score (0-1)"
    )
    confidence_level: ConfidenceLevel = Field(
        ..., 
        description="Categorical confidence level"
    )
    match_type: MatchType = Field(..., description="Type of match")
    
    # Detailed scoring
    algorithm_scores: Optional[Dict[str, float]] = Field(
        default=None,
        description="Individual algorithm scores"
    )
    ensemble_score: Optional[float] = Field(
        default=None,
        description="Raw ensemble score before calibration"
    )
    
    # Match explanation
    match_reasons: Optional[List[str]] = Field(
        default=None,
        description="Human-readable reasons for the match"
    )
    contributing_algorithms: Optional[List[str]] = Field(
        default=None,
        description="Algorithms that contributed to this match"
    )
    
    # User information (optional)
    matched_user_info: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Basic info about matched user"
    )
    
    # Relationship prediction
    predicted_relationship: Optional[str] = Field(
        default=None,
        description="Predicted family relationship (if applicable)"
    )
    relationship_confidence: Optional[float] = Field(
        default=None,
        description="Confidence in relationship prediction"
    )
    
    # Metadata
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    
    @validator('confidence_level', pre=True, always=True)
    def determine_confidence_level(cls, v, values):
        if v is not None:
            return v
        
        if hasattr(values, 'get'):
            confidence_score = values.get('confidence_score', 0)
        else:
            confidence_score = getattr(values, 'confidence_score', 0)
            
        if confidence_score >= 0.8:
            return ConfidenceLevel.HIGH
        elif confidence_score >= 0.6:
            return ConfidenceLevel.MEDIUM
        else:
            return ConfidenceLevel.LOW

class MatchResponse(BaseModel):
    """Response containing match results."""
    user_id: str = Field(..., description="ID of the user matches were found for")
    matches: List[MatchResult] = Field(..., description="List of matches")
    total_matches: int = Field(..., description="Total number of matches found")
    
    # Performance metrics
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")
    algorithms_used: Optional[List[str]] = Field(
        default=None,
        description="Algorithms used in matching"
    )
    
    # Model information
    model_version: str = Field(..., description="Version of the matching model")
    confidence_threshold: float = Field(
        ...,
        description="Confidence threshold used for filtering"
    )
    
    # Request parameters
    max_results: Optional[int] = Field(default=None)
    match_types_requested: Optional[List[MatchType]] = Field(default=None)
    
    # Statistics
    statistics: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Matching statistics and breakdown"
    )
    
    created_at: datetime = Field(default_factory=datetime.utcnow)

class MatchingConfig(BaseModel):
    """Configuration for matching algorithms."""
    
    # Algorithm weights
    tensorflow_weight: float = Field(default=0.35, ge=0.0, le=1.0)
    nlp_weight: float = Field(default=0.25, ge=0.0, le=1.0)
    graph_weight: float = Field(default=0.25, ge=0.0, le=1.0)
    genetic_weight: float = Field(default=0.15, ge=0.0, le=1.0)
    
    # Confidence thresholds
    family_threshold: float = Field(default=0.8, ge=0.0, le=1.0)
    friend_threshold: float = Field(default=0.6, ge=0.0, le=1.0)
    community_threshold: float = Field(default=0.4, ge=0.0, le=1.0)
    
    # Performance settings
    max_candidates: int = Field(default=1000, ge=10, le=10000)
    timeout_seconds: int = Field(default=30, ge=1, le=300)
    enable_caching: bool = Field(default=True)
    cache_ttl_seconds: int = Field(default=3600, ge=60)
    
    # Feature flags
    enable_tensorflow: bool = Field(default=True)
    enable_nlp: bool = Field(default=True)
    enable_graph: bool = Field(default=True)
    enable_genetic: bool = Field(default=True)
    
    # Advanced settings
    adaptive_weighting: bool = Field(default=True)
    confidence_calibration: bool = Field(default=True)
    cultural_analysis: bool = Field(default=True)
    
    @validator('tensorflow_weight', 'nlp_weight', 'graph_weight', 'genetic_weight')
    def check_weights_sum(cls, v):
        # Note: This is a simplified check. In practice, you'd want to validate
        # the sum of all weights equals 1.0 in a separate validator
        return v

class SimilarityRequest(BaseModel):
    """Request to calculate similarity between two users."""
    user_id_1: str = Field(..., description="First user ID")
    user_id_2: str = Field(..., description="Second user ID")
    algorithms: Optional[List[str]] = Field(
        default=None,
        description="Specific algorithms to use"
    )
    include_breakdown: bool = Field(
        default=False,
        description="Include algorithm-by-algorithm breakdown"
    )

class SimilarityResponse(BaseModel):
    """Response with similarity calculation."""
    user_id_1: str
    user_id_2: str
    similarity_score: float = Field(ge=0.0, le=1.0)
    
    algorithm_breakdown: Optional[Dict[str, float]] = None
    predicted_relationship: Optional[str] = None
    confidence_level: ConfidenceLevel
    
    processing_time_ms: float
    model_version: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Overall health status")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    service: str = Field(default="yofam-ai-matching")
    version: str = Field(default="1.0.0")
    
    components: Optional[Dict[str, str]] = Field(
        default=None,
        description="Status of individual components"
    )
    
    uptime_seconds: Optional[float] = None
    memory_usage_mb: Optional[float] = None
    cpu_usage_percent: Optional[float] = None

class ModelStatusResponse(BaseModel):
    """Model status response."""
    ensemble_version: str
    initialized: bool
    
    tensorflow_status: Dict[str, Any]
    nlp_status: Dict[str, Any] 
    graph_status: Dict[str, Any]
    genetic_status: Dict[str, Any]
    
    performance_metrics: Optional[Dict[str, Any]] = None
    last_training: Optional[datetime] = None
    model_accuracy: Optional[float] = None

class ErrorResponse(BaseModel):
    """Error response model."""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    detail: Optional[str] = Field(default=None, description="Detailed error information")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = Field(default=None)

# Request/Response type aliases for convenience
MatchRequestType = Union[MatchRequest, BatchMatchRequest]
MatchResponseType = Union[MatchResponse, List[MatchResponse]]