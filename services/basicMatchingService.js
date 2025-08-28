/**
 * Basic Matching Service
 * ======================
 * 
 * Simple fallback matching algorithm for when AI service is unavailable
 * Provides basic family and friend matching based on:
 * - Same parents (siblings)
 * - Same location
 * - Similar age
 * - Similar interests
 */

const { User } = require('../models');

class BasicMatchingService {
    /**
     * Find basic matches for a user
     */
    static async findBasicMatches(userId, options = {}) {
        try {
            const {
                matchTypes = ['all'],
                maxResults = 50,
                minConfidence = 0.1
            } = options;
            
            console.log(`🔍 Finding basic matches for user: ${userId}`);
            
            // Get the current user
            const currentUser = await User.findById(userId);
            if (!currentUser) {
                console.error(`User ${userId} not found`);
                return { matches: [], total: 0 };
            }
            
            // Get all other users
            const allUsers = await User.find({ 
                _id: { $ne: userId },
                // Exclude users with no basic info
                first_name: { $exists: true, $ne: null },
                last_name: { $exists: true, $ne: null }
            }).limit(200); // Limit for performance
            
            console.log(`Found ${allUsers.length} potential matches to evaluate`);
            
            // Calculate matches
            const matches = [];
            
            for (const user of allUsers) {
                const matchResult = this.calculateMatch(currentUser, user, matchTypes);
                
                if (matchResult && matchResult.confidence >= minConfidence) {
                    matches.push({
                        userId: user._id,
                        name: `${user.first_name} ${user.last_name}`,
                        profilePictureUrl: user.profilePictureUrl || null,
                        location: user.location || 'Unknown',
                        profession: user.profession || 'Not specified',
                        type: matchResult.type,
                        confidence: matchResult.confidence,
                        reasoning: matchResult.reasoning,
                        matchDetails: matchResult.details,
                        connectionStatus: this.getConnectionStatus(currentUser, user),
                        mutualConnections: 0,
                        createdAt: new Date()
                    });
                }
            }
            
            // Sort by confidence
            matches.sort((a, b) => b.confidence - a.confidence);
            
            // Limit results
            const limitedMatches = matches.slice(0, maxResults);
            
            console.log(`✅ Found ${limitedMatches.length} basic matches for user ${userId}`);
            
            return {
                matches: limitedMatches,
                total: limitedMatches.length,
                processing_time: 100,
                model_version: 'basic_v1',
                algorithms_used: ['basic']
            };
            
        } catch (error) {
            console.error('Basic matching error:', error);
            return { matches: [], total: 0, error: error.message };
        }
    }
    
    /**
     * Calculate match between two users
     */
    static calculateMatch(user1, user2, matchTypes) {
        const results = [];
        
        // Check for family matches
        if (matchTypes.includes('all') || matchTypes.includes('family')) {
            const familyMatch = this.checkFamilyMatch(user1, user2);
            if (familyMatch) results.push(familyMatch);
        }
        
        // Check for friend/community matches
        if (matchTypes.includes('all') || matchTypes.includes('friend') || matchTypes.includes('community')) {
            const friendMatch = this.checkFriendMatch(user1, user2);
            if (friendMatch) results.push(friendMatch);
        }
        
        // Return the best match
        if (results.length > 0) {
            return results.reduce((best, current) => 
                current.confidence > best.confidence ? current : best
            );
        }
        
        return null;
    }
    
    /**
     * Check for family relationship
     */
    static checkFamilyMatch(user1, user2) {
        const details = [];
        let confidence = 0;
        let relationshipType = null;
        
        // Check for siblings (same parents)
        const sameFather = user1.father_name && user2.father_name && 
                          user1.father_name.toLowerCase() === user2.father_name.toLowerCase();
        const sameMother = user1.mother_name && user2.mother_name && 
                          user1.mother_name.toLowerCase() === user2.mother_name.toLowerCase();
        
        if (sameFather && sameMother) {
            confidence = 0.95;
            relationshipType = 'Sibling';
            details.push('Same father and mother');
        } else if (sameFather || sameMother) {
            confidence = 0.7;
            relationshipType = sameFather ? 'Paternal connection' : 'Maternal connection';
            details.push(sameFather ? 'Same father' : 'Same mother');
        }
        
        // Check for same last name (possible family)
        if (!relationshipType && user1.last_name && user2.last_name &&
            user1.last_name.toLowerCase() === user2.last_name.toLowerCase()) {
            confidence = 0.3;
            relationshipType = 'Same last name';
            details.push('Share the same family name');
        }
        
        // Check for same location (increases confidence)
        if (relationshipType && user1.location && user2.location) {
            const loc1 = user1.location.toLowerCase();
            const loc2 = user2.location.toLowerCase();
            if (loc1.includes(loc2) || loc2.includes(loc1)) {
                confidence += 0.05;
                details.push('Same location');
            }
        }
        
        if (relationshipType) {
            return {
                type: 'family',
                confidence: Math.min(confidence, 1.0),
                reasoning: relationshipType,
                details
            };
        }
        
        return null;
    }
    
    /**
     * Check for friend/community match
     */
    static checkFriendMatch(user1, user2) {
        const details = [];
        let confidence = 0;
        
        // Location match
        if (user1.location && user2.location) {
            const loc1 = user1.location.toLowerCase();
            const loc2 = user2.location.toLowerCase();
            if (loc1 === loc2) {
                confidence += 0.3;
                details.push('Same exact location');
            } else if (loc1.includes(loc2) || loc2.includes(loc1)) {
                confidence += 0.2;
                details.push('Similar location');
            }
        }
        
        // Profession match
        if (user1.profession && user2.profession) {
            const prof1 = user1.profession.toLowerCase();
            const prof2 = user2.profession.toLowerCase();
            if (prof1 === prof2) {
                confidence += 0.2;
                details.push('Same profession');
            } else if (prof1.includes(prof2) || prof2.includes(prof1)) {
                confidence += 0.1;
                details.push('Related profession');
            }
        }
        
        // Age similarity (if birth dates available)
        if (user1.date_of_birth && user2.date_of_birth) {
            const age1 = new Date().getFullYear() - new Date(user1.date_of_birth).getFullYear();
            const age2 = new Date().getFullYear() - new Date(user2.date_of_birth).getFullYear();
            const ageDiff = Math.abs(age1 - age2);
            
            if (ageDiff <= 2) {
                confidence += 0.15;
                details.push('Similar age');
            } else if (ageDiff <= 5) {
                confidence += 0.1;
                details.push('Close in age');
            }
        }
        
        // Interests match
        if (user1.interests && user2.interests && Array.isArray(user1.interests) && Array.isArray(user2.interests)) {
            const commonInterests = user1.interests.filter(i => user2.interests.includes(i));
            if (commonInterests.length > 0) {
                confidence += Math.min(commonInterests.length * 0.1, 0.3);
                details.push(`${commonInterests.length} common interests`);
            }
        }
        
        // Heritage/culture match
        if (user1.heritage && user2.heritage) {
            const heritage1 = user1.heritage.toLowerCase();
            const heritage2 = user2.heritage.toLowerCase();
            if (heritage1 === heritage2) {
                confidence += 0.15;
                details.push('Same heritage');
            }
        }
        
        if (confidence >= 0.1) {
            const matchType = confidence >= 0.4 ? 'friend' : 'community';
            return {
                type: matchType,
                confidence: Math.min(confidence, 1.0),
                reasoning: details.length > 0 ? details[0] : 'Potential connection',
                details
            };
        }
        
        return null;
    }
    
    /**
     * Get connection status between users
     */
    static getConnectionStatus(user1, user2) {
        // Check if already connected
        if (user1.connections && user1.connections.some(c => c.toString() === user2._id.toString())) {
            return 'connected';
        }
        
        // Check if request sent
        if (user1.sent_requests && user1.sent_requests.some(r => r.toString() === user2._id.toString())) {
            return 'pending';
        }
        
        // Check if request received
        if (user1.received_requests && user1.received_requests.some(r => r.toString() === user2._id.toString())) {
            return 'received';
        }
        
        return 'none';
    }
}

module.exports = BasicMatchingService;