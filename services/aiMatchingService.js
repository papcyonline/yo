/**
 * AI Matching Service Integration
 * ===============================
 * 
 * Connects the Node.js backend to the Python AI Matching Service
 * Provides a seamless interface for the existing codebase
 */

const axios = require('axios');
const { User, Notification, BlockedUser } = require('../models');
const BasicMatchingService = require('./basicMatchingService');
const EnhancedMatchingServiceImport = require('./enhancedMatchingService');

class AIMatchingServiceClient {
    constructor() {
        this.baseURL = process.env.AI_MATCHING_SERVICE_URL || 'http://localhost:8000';
        this.timeout = 30000; // 30 seconds
        this.retryAttempts = 3;
        
        // Create axios instance with default config
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Add request/response interceptors for logging
        this.client.interceptors.request.use(
            (config) => {
                console.log(`🤖 AI Service Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('🤖 AI Service Request Error:', error.message);
                return Promise.reject(error);
            }
        );
        
        this.client.interceptors.response.use(
            (response) => {
                console.log(`✅ AI Service Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                console.error(`❌ AI Service Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
                return Promise.reject(error);
            }
        );
        
        console.log('🧠 AI Matching Service Client initialized');
    }
    
    /**
     * Check if AI matching service is available
     */
    async isAvailable() {
        try {
            const response = await this.client.get('/health', { timeout: 5000 });
            return response.status === 200;
        } catch (error) {
            console.warn('⚠️ AI Matching Service not available, will use fallback:', error.message);
            return false;
        }
    }
    
    /**
     * Find enhanced matches using AI algorithms
     */
    async findEnhancedMatches(userId, options = {}) {
        try {
            const {
                matchTypes = ['all'],
                maxResults = 50,
                minConfidence = 0.1,  // Lower to 10% to show more matches for friend requests
                includeReasons = true
            } = options;
            
            console.log(`🔍 Finding AI matches for user: ${userId}`);
            
            const requestData = {
                user_id: userId,
                match_types: matchTypes,
                max_results: maxResults,
                min_confidence: minConfidence,
                include_reasons: includeReasons
            };
            
            const response = await this.client.post('/match/find', requestData);
            
            if (response.data && response.data.matches) {
                console.log(`✅ Found ${response.data.matches.length} AI matches for user ${userId}`);
                
                // Transform AI response to match existing format
                const transformedMatches = await this.transformAIMatches(response.data.matches);
                
                return {
                    matches: transformedMatches,
                    total: response.data.total_matches,
                    processing_time: response.data.processing_time_ms,
                    model_version: response.data.model_version,
                    algorithms_used: response.data.algorithms_used || ['ensemble']
                };
            }
            
            return { matches: [], total: 0 };
            
        } catch (error) {
            console.error(`Failed to get AI matches for user ${userId}:`, error.message);
            
            // Return fallback response if AI service fails
            console.log('🔄 AI service unavailable, returning empty matches...');
            
            return {
                matches: [],
                total: 0,
                fallback: true,
                error: error.message,
                reason: 'AI matching service unavailable'
            };
        }
    }
    
    /**
     * Calculate similarity between two users
     */
    async calculateSimilarity(userId1, userId2) {
        try {
            const response = await this.client.post('/match/similarity', null, {
                params: {
                    user_id_1: userId1,
                    user_id_2: userId2
                }
            });
            
            return response.data.similarity_score || 0;
            
        } catch (error) {
            console.error(`Failed to calculate similarity between ${userId1} and ${userId2}:`, error.message);
            return 0;
        }
    }
    
    /**
     * Process batch matches for multiple users
     */
    async batchFindMatches(userIds, options = {}) {
        try {
            if (!Array.isArray(userIds) || userIds.length === 0) {
                return [];
            }
            
            // Limit batch size
            const batchSize = Math.min(userIds.length, 50);
            const limitedUserIds = userIds.slice(0, batchSize);
            
            const requestData = {
                user_ids: limitedUserIds,
                match_types: options.matchTypes || ['all'],
                max_results: options.maxResults || 20,
                min_confidence: options.minConfidence || 0.5
            };
            
            const response = await this.client.post('/match/batch', requestData);
            
            if (response.data && Array.isArray(response.data)) {
                const batchResults = [];
                for (const result of response.data) {
                    batchResults.push({
                        userId: result.user_id,
                        matches: await this.transformAIMatches(result.matches),
                        total: result.total_matches
                    });
                }
                return batchResults;
            }
            
            return [];
            
        } catch (error) {
            console.error('Batch matching failed:', error.message);
            return [];
        }
    }
    
    /**
     * Get AI matching service status and model information
     */
    async getServiceStatus() {
        try {
            const [healthResponse, modelsResponse] = await Promise.all([
                this.client.get('/health'),
                this.client.get('/models/status')
            ]);
            
            return {
                health: healthResponse.data,
                models: modelsResponse.data,
                available: true
            };
            
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }
    
    /**
     * Transform AI service match format to existing YoFam format
     */
    async transformAIMatches(aiMatches) {
        const { User } = require('../models');
        
        const transformedMatches = [];
        
        for (const match of aiMatches) {
            try {
                // Get full user data from database
                const userDoc = await User.findById(match.user_id);
                const fullName = userDoc ? `${userDoc.first_name || 'Unknown'} ${userDoc.last_name || ''}`.trim() : `User ${match.user_id}`;
                
                transformedMatches.push({
                    userId: match.user_id,
                    name: fullName,
                    score: Math.round(match.confidence_score * 100), // Convert to percentage
                    type: match.match_type,
                    confidence: match.confidence_score, // Keep original confidence
                    reason: match.match_reasons ? match.match_reasons.join(', ') : 'AI-powered analysis',
                    algorithmScores: match.algorithm_scores || {},
                    ensembleScore: match.confidence_score,
                    contributingAlgorithms: Object.keys(match.algorithm_scores || {}),
                    predictedRelationship: match.predicted_relationship,
                    profileData: {
                        ...match.profile_data,
                        // Add database user data
                        first_name: userDoc?.first_name,
                        last_name: userDoc?.last_name,
                        bio: userDoc?.bio,
                        location: userDoc?.location,
                        profession: userDoc?.profession,
                        profile_photo_url: userDoc?.profile_photo_url
                    },
                    aiEnhanced: true,
                    source: 'ai_matching_service'
                });
            } catch (error) {
                console.error(`Error fetching user data for ${match.user_id}:`, error);
                // Fallback without database lookup
                transformedMatches.push({
                    userId: match.user_id,
                    name: match.name || `User ${match.user_id}`,
                    score: Math.round(match.confidence_score * 100),
                    type: match.match_type,
                    confidence: match.confidence_score,
                    reason: match.match_reasons ? match.match_reasons.join(', ') : 'AI-powered analysis',
                    algorithmScores: match.algorithm_scores || {},
                    ensembleScore: match.confidence_score,
                    contributingAlgorithms: Object.keys(match.algorithm_scores || {}),
                    predictedRelationship: match.predicted_relationship,
                    profileData: match.profile_data || {},
                    aiEnhanced: true,
                    source: 'ai_matching_service'
                });
            }
        }
        
        return transformedMatches;
    }
    
    /**
     * Trigger model retraining (admin function)
     */
    async triggerRetraining() {
        try {
            const response = await this.client.post('/models/retrain');
            console.log('🔄 AI model retraining triggered');
            return response.data;
        } catch (error) {
            console.error('Failed to trigger retraining:', error.message);
            throw error;
        }
    }
}

// Enhanced AI Matching Service that combines AI and basic matching
class EnhancedAIMatchingService {
    constructor() {
        this.aiClient = new AIMatchingServiceClient();
        this.isAIAvailable = false;
        this.io = null; // Will be set from server.js
        
        // AI service disabled - using enhanced matching fallback only
        console.log('🤖 AI Service disabled - using enhanced matching service');
        
        // Disable periodic health checks to reduce log noise
        // setInterval(() => {
        //     this.checkAIAvailability();
        // }, 60000); // Check every minute
    }
    
    /**
     * Set Socket.io instance for real-time updates
     */
    setSocketIO(io) {
        this.io = io;
        console.log('🔌 Socket.io connected to Enhanced Matching Service');
        
        // Set up periodic match refresh for connected users
        this.setupPeriodicRefresh();
    }
    
    /**
     * Setup periodic refresh of matches for connected users
     */
    setupPeriodicRefresh() {
        // Refresh matches every 30 seconds for connected users
        setInterval(async () => {
            if (!this.io) return;
            
            // Get all connected sockets
            const sockets = await this.io.fetchSockets();
            const connectedUserIds = [...new Set(sockets.map(s => s.userId).filter(Boolean))];
            
            if (connectedUserIds.length > 0) {
                console.log(`🔄 Refreshing matches for ${connectedUserIds.length} connected users`);
                
                // Refresh matches for each connected user
                for (const userId of connectedUserIds) {
                    try {
                        const result = await this.findMatches(userId, {
                            matchTypes: ['all'],
                            maxResults: 20,
                            minConfidence: 0.1
                        });
                        
                        // Emit updates only if matches found
                        if (result.matches && result.matches.length > 0) {
                            this.emitMatchUpdate(userId, result.matches);
                        }
                    } catch (error) {
                        console.error(`Failed to refresh matches for user ${userId}:`, error.message);
                    }
                }
            }
        }, 30000); // Every 30 seconds
    }
    
    async checkAIAvailability() {
        this.isAIAvailable = await this.aiClient.isAvailable();
        console.log(`🤖 AI Service Status: ${this.isAIAvailable ? 'Available' : 'Unavailable'}`);
    }
    
    /**
     * Filter out blocked users from match results
     */
    async filterBlockedUsers(userId, matches) {
        try {
            if (!matches || matches.length === 0) {
                return matches;
            }
            
            // Get all user IDs from matches
            const matchUserIds = matches.map(match => match.userId || match.user_id || match.id);
            
            // Check which users are blocked
            const blockedUserIds = [];
            for (const matchUserId of matchUserIds) {
                const isBlocked = await BlockedUser.isBlockedEither(userId, matchUserId);
                if (isBlocked) {
                    blockedUserIds.push(matchUserId);
                }
            }
            
            if (blockedUserIds.length > 0) {
                console.log(`🚫 Filtering out ${blockedUserIds.length} blocked users from matches`);
            }
            
            // Filter out blocked users
            const filteredMatches = matches.filter(match => {
                const matchUserId = match.userId || match.user_id || match.id;
                return !blockedUserIds.includes(matchUserId);
            });
            
            return filteredMatches;
            
        } catch (error) {
            console.error('Error filtering blocked users:', error);
            // Return original matches if filtering fails
            return matches;
        }
    }
    
    /**
     * Find matches using best available algorithm
     */
    async findMatches(userId, options = {}) {
        try {
            // Use AI if available
            if (this.isAIAvailable) {
                console.log('🧠 Using AI Enhanced Matching');
                const result = await this.aiClient.findEnhancedMatches(userId, options);
                
                // Filter out blocked users
                const filteredMatches = await this.filterBlockedUsers(userId, result.matches);
                const filteredResult = {
                    ...result,
                    matches: filteredMatches,
                    total: filteredMatches.length
                };
                
                // Save AI matches to database for future reference
                await this.saveMatchesToDatabase(userId, filteredResult.matches, 'ai_enhanced');
                
                return filteredResult;
            } else {
                // AI service unavailable, use enhanced matching fallback
                console.log('🔧 AI service unavailable, using enhanced matching fallback');
                
                const result = await EnhancedMatchingServiceImport.findMatches(userId, options);
                
                // Filter out blocked users
                const filteredMatches = await this.filterBlockedUsers(userId, result.matches);
                const filteredResult = {
                    ...result,
                    matches: filteredMatches,
                    total: filteredMatches.length,
                    fallback: true,
                    reason: 'Using basic matching (AI service unavailable)'
                };
                
                // Save basic matches to database
                await this.saveMatchesToDatabase(userId, filteredResult.matches, 'basic');
                
                return filteredResult;
            }
        } catch (error) {
            console.error(`Enhanced matching failed for user ${userId}:`, error.message);
            
            // Final fallback - use enhanced matching
            console.log('🔧 Final fallback - using enhanced matching');
            
            try {
                const result = await EnhancedMatchingServiceImport.findMatches(userId, options);
                
                // Filter out blocked users
                const filteredMatches = await this.filterBlockedUsers(userId, result.matches);
                
                return {
                    ...result,
                    matches: filteredMatches,
                    total: filteredMatches.length,
                    fallback: true,
                    error: error.message,
                    reason: 'Using enhanced matching (error fallback)'
                };
            } catch (fallbackError) {
                console.error('Basic matching also failed:', fallbackError.message);
                return {
                    matches: [],
                    total: 0,
                    fallback: true,
                    error: fallbackError.message
                };
            }
        }
    }
    
    /**
     * Save match results to MongoDB for caching and analytics
     */
    async saveMatchesToDatabase(userId, matches, source) {
        try {
            const matchData = matches.map(match => ({
                ...match,
                created_at: new Date(),
                source,
                version: '1.0.0'
            }));
            
            await User.findByIdAndUpdate(userId, {
                $set: {
                    ai_matches: matchData,
                    matches_last_updated: new Date(),
                    match_source: source
                }
            });
            
            console.log(`💾 Saved ${matches.length} matches for user ${userId}`);
            
            // Emit real-time update to the user
            this.emitMatchUpdate(userId, matches);
            
            // Create notifications for high-confidence matches
            await this.createMatchNotifications(userId, matches);
            
        } catch (error) {
            console.error(`Failed to save matches for user ${userId}:`, error.message);
        }
    }
    
    /**
     * Emit real-time match updates via Socket.io
     */
    emitMatchUpdate(userId, matches) {
        if (!this.io) {
            console.log('⚠️ Socket.io not available for real-time updates');
            return;
        }
        
        try {
            // Emit to specific user room
            this.io.to(`user_${userId}`).emit('matches_updated', {
                type: 'matches_updated',
                userId,
                matchCount: matches.length,
                matches: matches.slice(0, 10), // Send top 10 matches
                timestamp: new Date().toISOString()
            });
            
            // High-confidence matches are now handled via the notification system
            // instead of socket emissions to avoid popup interruptions
            const highMatches = matches.filter(m => m.confidence >= 0.65);
            if (highMatches.length > 0) {
                console.log(`📱 ${highMatches.length} high-confidence matches found - notifications created instead of popup`);
            }
            
            console.log(`📡 Emitted match updates to user ${userId}`);
        } catch (error) {
            console.error('Failed to emit match update:', error);
        }
    }
    
    /**
     * Create notifications for new high-quality matches
     */
    async createMatchNotifications(userId, matches) {
        try {
            const NotificationService = require('./notificationService');
            
            // Notify for high-confidence matches (65%+)
            const highConfidenceMatches = matches.filter(match => {
                // Handle both percentage (0-100) and decimal (0-1) formats
                const confidence = match.confidence || match.score;
                const score = confidence > 1 ? confidence : confidence * 100;
                return score >= 65;
            });
            
            if (highConfidenceMatches.length > 0) {
                console.log(`📬 Creating notifications for ${highConfidenceMatches.length} high-confidence matches`);
                
                // Individual notifications for each high match
                for (const match of highConfidenceMatches) {
                    const score = match.confidence > 1 ? match.confidence : match.confidence * 100;
                    
                    // Use our new high match notification method
                    if (score >= 65) {
                        await Notification.createHighMatchNotification(userId, {
                            userId: match.userId,
                            name: match.name,
                            score: match.confidence || match.score,
                            type: match.type,
                            reason: match.reason,
                            predictedRelationship: match.predictedRelationship
                        });
                    }
                }
                
                // Create specific notifications for family matches
                const familyMatches = highConfidenceMatches.filter(m => m.type === 'family');
                if (familyMatches.length > 0) {
                    console.log(`👨‍👩‍👧‍👦 Found ${familyMatches.length} high-confidence family matches`);
                }
                
                // Create specific notifications for friend matches
                const friendMatches = highConfidenceMatches.filter(m => m.type === 'friend');
                if (friendMatches.length > 0) {
                    console.log(`👫 Found ${friendMatches.length} high-confidence friend matches`);
                }
            }
            
        } catch (error) {
            console.error(`Failed to create match notifications for user ${userId}:`, error.message);
        }
    }
    
    /**
     * Get service status including AI availability
     */
    async getStatus() {
        const aiStatus = await this.aiClient.getServiceStatus();
        
        return {
            ai_service_available: this.isAIAvailable,
            ai_service_url: this.aiClient.baseURL,
            ai_status: aiStatus,
            enhanced_matching_enabled: true,
            fallback_available: true
        };
    }
}

// Create singleton instance
const enhancedMatchingService = new EnhancedAIMatchingService();

module.exports = {
    enhancedMatchingService,
    AIMatchingServiceClient
};