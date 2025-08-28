/**
 * Enhanced Matching Service
 * ========================
 * 
 * Intelligent matching algorithm that works well with partial profiles
 * Features:
 * - Smart scoring that handles missing data gracefully
 * - Multiple matching strategies
 * - Weighted scoring based on available information
 * - Partial match fallbacks
 */

const { User } = require('../models');

class EnhancedMatchingService {
    /**
     * Find matches for a user with intelligent handling of partial profiles
     */
    static async findMatches(userId, options = {}) {
        try {
            const {
                matchTypes = ['all'],
                maxResults = 50,
                minConfidence = 0.05, // Lower threshold for partial profiles
                includePartialMatches = true
            } = options;
            
            console.log(`🧠 Enhanced matching for user: ${userId}`);
            
            // Get the current user with all available data
            const currentUser = await User.findById(userId);
            if (!currentUser) {
                console.error(`User ${userId} not found`);
                return { matches: [], total: 0 };
            }

            // Analyze current user's profile completeness
            const profileAnalysis = this.analyzeProfile(currentUser);
            console.log(`📊 User profile completeness: ${profileAnalysis.completeness}%`);
            
            // Get potential matches with smart filtering
            const potentialMatches = await this.findPotentialMatches(currentUser, profileAnalysis);
            console.log(`Found ${potentialMatches.length} potential matches to evaluate`);
            
            // Calculate sophisticated matches
            const matches = [];
            
            for (const candidate of potentialMatches) {
                const matchResult = this.calculateEnhancedMatch(currentUser, candidate, profileAnalysis, matchTypes);
                
                if (matchResult && matchResult.confidence >= minConfidence) {
                    matches.push({
                        userId: candidate._id,
                        name: this.getDisplayName(candidate),
                        profilePictureUrl: candidate.profilePictureUrl || candidate.profile_photo_url || null,
                        location: this.getDisplayLocation(candidate),
                        profession: candidate.profession || candidate.occupation || 'Not specified',
                        age: this.calculateAge(candidate.date_of_birth),
                        type: matchResult.type,
                        confidence: matchResult.confidence,
                        reasoning: matchResult.reasoning,
                        matchDetails: matchResult.details,
                        matchScore: matchResult.score,
                        dataQuality: matchResult.dataQuality,
                        connectionStatus: this.getConnectionStatus(currentUser, candidate),
                        mutualConnections: this.calculateMutualConnections(currentUser, candidate),
                        createdAt: new Date(),
                        profileCompleteness: this.analyzeProfile(candidate).completeness
                    });
                }
            }
            
            // Advanced sorting: confidence + data quality + profile completeness
            matches.sort((a, b) => {
                const scoreA = a.confidence * 0.6 + (a.dataQuality / 100) * 0.2 + (a.profileCompleteness / 100) * 0.2;
                const scoreB = b.confidence * 0.6 + (b.dataQuality / 100) * 0.2 + (b.profileCompleteness / 100) * 0.2;
                return scoreB - scoreA;
            });
            
            // Limit results
            const limitedMatches = matches.slice(0, maxResults);
            
            console.log(`✅ Found ${limitedMatches.length} enhanced matches for user ${userId}`);
            
            return {
                matches: limitedMatches,
                total: limitedMatches.length,
                processing_time: 150,
                model_version: 'enhanced_v2',
                algorithms_used: ['enhanced_scoring', 'partial_profile_handling'],
                user_profile_completeness: profileAnalysis.completeness,
                matching_strategy: profileAnalysis.strategy
            };
            
        } catch (error) {
            console.error('Enhanced matching error:', error);
            return { matches: [], total: 0, error: error.message };
        }
    }

    /**
     * Analyze profile completeness and determine matching strategy
     */
    static analyzeProfile(user) {
        const fields = {
            basic: ['first_name', 'last_name'],
            family: ['father_name', 'mother_name', 'date_of_birth'],
            location: ['location', 'city', 'country'],
            personal: ['profession', 'occupation', 'interests', 'heritage'],
            contact: ['email', 'phone'],
            optional: ['bio', 'education', 'hobbies']
        };

        let totalFields = 0;
        let filledFields = 0;
        let categoryScores = {};

        for (const [category, fieldList] of Object.entries(fields)) {
            let categoryFilled = 0;
            fieldList.forEach(field => {
                totalFields++;
                if (user[field] && user[field] !== '' && user[field] !== null) {
                    filledFields++;
                    categoryFilled++;
                }
            });
            categoryScores[category] = (categoryFilled / fieldList.length) * 100;
        }

        const completeness = Math.round((filledFields / totalFields) * 100);
        
        // Determine matching strategy based on completeness
        let strategy = 'basic';
        if (completeness >= 70) strategy = 'comprehensive';
        else if (completeness >= 40) strategy = 'moderate';
        else if (completeness >= 20) strategy = 'minimal';

        return {
            completeness,
            strategy,
            categoryScores,
            strongCategories: Object.entries(categoryScores).filter(([_, score]) => score >= 60).map(([cat, _]) => cat),
            weakCategories: Object.entries(categoryScores).filter(([_, score]) => score < 30).map(([cat, _]) => cat)
        };
    }

    /**
     * Smart filtering of potential matches based on profile analysis
     */
    static async findPotentialMatches(currentUser, profileAnalysis) {
        let query = {
            _id: { $ne: currentUser._id },
            $or: [
                { first_name: { $exists: true, $ne: null, $ne: '' } },
                { last_name: { $exists: true, $ne: null, $ne: '' } }
            ]
        };

        // If user has location info, prioritize nearby users
        if (profileAnalysis.categoryScores.location > 30) {
            const nearbyQuery = { ...query };
            if (currentUser.location) {
                nearbyQuery.location = { $regex: currentUser.location.split(',')[0], $options: 'i' };
            }
            const nearbyUsers = await User.find(nearbyQuery).limit(100);
            
            // Also get general users as fallback
            const generalUsers = await User.find(query).limit(150);
            
            // Combine and deduplicate
            const combined = [...nearbyUsers, ...generalUsers];
            const unique = combined.filter((user, index, self) => 
                index === self.findIndex(u => u._id.toString() === user._id.toString())
            );
            
            return unique;
        }

        return await User.find(query).limit(200);
    }

    /**
     * Enhanced matching algorithm with intelligent partial profile handling
     */
    static calculateEnhancedMatch(user1, user2, profileAnalysis, matchTypes) {
        const results = [];
        
        // Family matching with partial data handling
        if (matchTypes.includes('all') || matchTypes.includes('family')) {
            const familyMatch = this.checkEnhancedFamilyMatch(user1, user2, profileAnalysis);
            if (familyMatch) results.push(familyMatch);
        }
        
        // Friend/community matching with smart weighting
        if (matchTypes.includes('all') || matchTypes.includes('friend') || matchTypes.includes('community')) {
            const friendMatch = this.checkEnhancedFriendMatch(user1, user2, profileAnalysis);
            if (friendMatch) results.push(friendMatch);
        }

        // Name-based matching for minimal profiles
        if (profileAnalysis.completeness < 30) {
            const nameMatch = this.checkNameBasedMatch(user1, user2);
            if (nameMatch) results.push(nameMatch);
        }
        
        // Return the best match with enhanced scoring
        if (results.length > 0) {
            const bestMatch = results.reduce((best, current) => 
                current.score > best.score ? current : best
            );
            
            return {
                ...bestMatch,
                dataQuality: this.calculateDataQuality(user1, user2)
            };
        }
        
        return null;
    }

    /**
     * Enhanced family matching with partial data intelligence
     */
    static checkEnhancedFamilyMatch(user1, user2, profileAnalysis) {
        const details = [];
        let confidence = 0;
        let score = 0;
        let relationshipType = null;
        
        // Parent matching with fuzzy logic
        const fatherMatch = this.fuzzyNameMatch(user1.father_name, user2.father_name);
        const motherMatch = this.fuzzyNameMatch(user1.mother_name, user2.mother_name);
        
        if (fatherMatch.isMatch && motherMatch.isMatch) {
            confidence = 0.95 * Math.min(fatherMatch.similarity, motherMatch.similarity);
            score = confidence * 100;
            relationshipType = 'Sibling (high confidence)';
            details.push(`Father match: ${fatherMatch.similarity}%, Mother match: ${motherMatch.similarity}%`);
        } else if (fatherMatch.isMatch || motherMatch.isMatch) {
            const match = fatherMatch.isMatch ? fatherMatch : motherMatch;
            confidence = 0.7 * match.similarity;
            score = confidence * 100;
            relationshipType = fatherMatch.isMatch ? 'Paternal sibling' : 'Maternal sibling';
            details.push(`${fatherMatch.isMatch ? 'Father' : 'Mother'} match: ${match.similarity}%`);
        }

        // Last name matching with enhanced logic
        if (!relationshipType) {
            const lastNameMatch = this.fuzzyNameMatch(user1.last_name, user2.last_name);
            if (lastNameMatch.isMatch) {
                confidence = 0.25 + (lastNameMatch.similarity - 80) * 0.005; // Dynamic scoring
                score = confidence * 100;
                relationshipType = lastNameMatch.similarity > 95 ? 'Same family name' : 'Similar family name';
                details.push(`Last name similarity: ${lastNameMatch.similarity}%`);
            }
        }

        // Location boost for family matches
        if (relationshipType) {
            const locationBoost = this.calculateLocationBoost(user1, user2);
            confidence += locationBoost;
            score += locationBoost * 50;
            if (locationBoost > 0) {
                details.push('Same/similar location');
            }
        }

        // Age appropriateness for siblings
        if (relationshipType && relationshipType.includes('sibling')) {
            const ageCheck = this.checkSiblingAgeAppropriatenesss(user1, user2);
            if (ageCheck.appropriate) {
                confidence += 0.05;
                details.push(`Age difference: ${ageCheck.yearDiff} years`);
            } else if (ageCheck.yearDiff > 25) {
                confidence *= 0.7; // Reduce confidence for very large age gaps
                details.push(`Large age gap: ${ageCheck.yearDiff} years`);
            }
        }

        if (relationshipType) {
            return {
                type: 'family',
                confidence: Math.min(confidence, 1.0),
                score: Math.min(score, 100),
                reasoning: relationshipType,
                details
            };
        }
        
        return null;
    }

    /**
     * Enhanced friend matching with intelligent weighting
     */
    static checkEnhancedFriendMatch(user1, user2, profileAnalysis) {
        const details = [];
        let confidence = 0;
        let score = 0;
        const weights = this.getMatchingWeights(profileAnalysis);
        
        // Location matching with multiple levels
        const locationScore = this.calculateLocationMatch(user1, user2);
        if (locationScore > 0) {
            confidence += locationScore * weights.location;
            score += locationScore * 20 * weights.location;
            details.push(locationScore > 0.8 ? 'Same city' : locationScore > 0.5 ? 'Same region' : 'Similar area');
        }
        
        // Profession/occupation matching
        const professionScore = this.calculateProfessionMatch(user1, user2);
        if (professionScore > 0) {
            confidence += professionScore * weights.profession;
            score += professionScore * 15 * weights.profession;
            details.push(professionScore > 0.8 ? 'Same profession' : 'Related profession');
        }
        
        // Age compatibility
        const ageScore = this.calculateAgeCompatibility(user1, user2);
        if (ageScore > 0) {
            confidence += ageScore * weights.age;
            score += ageScore * 10 * weights.age;
            details.push('Compatible age range');
        }
        
        // Interests overlap
        const interestScore = this.calculateInterestOverlap(user1, user2);
        if (interestScore > 0) {
            confidence += interestScore * weights.interests;
            score += interestScore * 25 * weights.interests;
            details.push(`${Math.round(interestScore * 10)} shared interests`);
        }
        
        // Heritage/culture match
        const heritageScore = this.calculateHeritageMatch(user1, user2);
        if (heritageScore > 0) {
            confidence += heritageScore * weights.heritage;
            score += heritageScore * 15 * weights.heritage;
            details.push('Shared heritage');
        }

        // Education level compatibility
        const educationScore = this.calculateEducationMatch(user1, user2);
        if (educationScore > 0) {
            confidence += educationScore * weights.education;
            score += educationScore * 10 * weights.education;
            details.push('Similar education');
        }
        
        if (confidence >= 0.05) {
            const matchType = confidence >= 0.4 ? 'friend' : 'community';
            return {
                type: matchType,
                confidence: Math.min(confidence, 1.0),
                score: Math.min(score, 100),
                reasoning: details.length > 0 ? details[0] : 'Potential connection',
                details
            };
        }
        
        return null;
    }

    /**
     * Name-based matching for very incomplete profiles
     */
    static checkNameBasedMatch(user1, user2) {
        const details = [];
        let confidence = 0;
        let score = 0;

        // Check for similar first names (might indicate family)
        const firstNameSim = this.calculateStringSimilarity(user1.first_name || '', user2.first_name || '');
        if (firstNameSim > 0.6) {
            confidence += 0.1;
            score += 10;
            details.push('Similar first names');
        }

        // Last name similarity
        const lastNameSim = this.calculateStringSimilarity(user1.last_name || '', user2.last_name || '');
        if (lastNameSim > 0.8) {
            confidence += 0.2;
            score += 20;
            details.push('Very similar surnames');
        } else if (lastNameSim > 0.6) {
            confidence += 0.1;
            score += 10;
            details.push('Similar surnames');
        }

        if (confidence >= 0.1) {
            return {
                type: 'potential',
                confidence: Math.min(confidence, 1.0),
                score: Math.min(score, 100),
                reasoning: 'Name-based match (limited data)',
                details
            };
        }

        return null;
    }

    // Utility methods
    static fuzzyNameMatch(name1, name2) {
        if (!name1 || !name2) return { isMatch: false, similarity: 0 };
        
        const similarity = this.calculateStringSimilarity(
            name1.toLowerCase().trim(),
            name2.toLowerCase().trim()
        ) * 100;
        
        return {
            isMatch: similarity >= 80,
            similarity: Math.round(similarity)
        };
    }

    static calculateStringSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        // Simple Levenshtein distance implementation
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        const editDistance = this.levenshteinDistance(longer, shorter);
        
        return (longer.length - editDistance) / longer.length;
    }

    static levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }

    static calculateLocationMatch(user1, user2) {
        if (!user1.location || !user2.location) return 0;
        
        const loc1 = user1.location.toLowerCase();
        const loc2 = user2.location.toLowerCase();
        
        if (loc1 === loc2) return 1.0;
        if (loc1.includes(loc2) || loc2.includes(loc1)) return 0.7;
        
        // Check for city/state similarity
        const loc1Parts = loc1.split(',').map(p => p.trim());
        const loc2Parts = loc2.split(',').map(p => p.trim());
        
        let matches = 0;
        for (const part1 of loc1Parts) {
            for (const part2 of loc2Parts) {
                if (part1 === part2) matches++;
            }
        }
        
        return matches > 0 ? 0.5 + (matches * 0.2) : 0;
    }

    static calculateProfessionMatch(user1, user2) {
        const prof1 = (user1.profession || user1.occupation || '').toLowerCase();
        const prof2 = (user2.profession || user2.occupation || '').toLowerCase();
        
        if (!prof1 || !prof2) return 0;
        if (prof1 === prof2) return 1.0;
        
        return this.calculateStringSimilarity(prof1, prof2);
    }

    static calculateAgeCompatibility(user1, user2) {
        if (!user1.date_of_birth || !user2.date_of_birth) return 0;
        
        const age1 = this.calculateAge(user1.date_of_birth);
        const age2 = this.calculateAge(user2.date_of_birth);
        
        if (!age1 || !age2) return 0;
        
        const ageDiff = Math.abs(age1 - age2);
        if (ageDiff <= 2) return 1.0;
        if (ageDiff <= 5) return 0.8;
        if (ageDiff <= 10) return 0.5;
        if (ageDiff <= 15) return 0.3;
        
        return 0;
    }

    static calculateInterestOverlap(user1, user2) {
        const interests1 = user1.interests || [];
        const interests2 = user2.interests || [];
        
        if (!Array.isArray(interests1) || !Array.isArray(interests2) || 
            interests1.length === 0 || interests2.length === 0) return 0;
        
        const common = interests1.filter(i => interests2.includes(i));
        const total = new Set([...interests1, ...interests2]).size;
        
        return common.length / Math.max(interests1.length, interests2.length);
    }

    static calculateHeritageMatch(user1, user2) {
        if (!user1.heritage || !user2.heritage) return 0;
        
        const heritage1 = user1.heritage.toLowerCase();
        const heritage2 = user2.heritage.toLowerCase();
        
        return heritage1 === heritage2 ? 1.0 : 0;
    }

    static calculateEducationMatch(user1, user2) {
        if (!user1.education || !user2.education) return 0;
        
        const education1 = typeof user1.education === 'string' ? user1.education : String(user1.education);
        const education2 = typeof user2.education === 'string' ? user2.education : String(user2.education);
        
        return this.calculateStringSimilarity(
            education1.toLowerCase(),
            education2.toLowerCase()
        );
    }

    static getMatchingWeights(profileAnalysis) {
        // Adjust weights based on profile completeness
        const base = {
            location: 0.3,
            profession: 0.2,
            age: 0.15,
            interests: 0.2,
            heritage: 0.1,
            education: 0.05
        };

        // If certain categories are strong, increase their weight
        if (profileAnalysis.strongCategories.includes('location')) base.location += 0.1;
        if (profileAnalysis.strongCategories.includes('personal')) {
            base.profession += 0.1;
            base.interests += 0.1;
        }

        return base;
    }

    static calculateAge(dateOfBirth) {
        if (!dateOfBirth) return null;
        const today = new Date();
        const birth = new Date(dateOfBirth);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }

    static calculateLocationBoost(user1, user2) {
        const locationMatch = this.calculateLocationMatch(user1, user2);
        return locationMatch * 0.1; // Max boost of 0.1
    }

    static checkSiblingAgeAppropriatenesss(user1, user2) {
        const age1 = this.calculateAge(user1.date_of_birth);
        const age2 = this.calculateAge(user2.date_of_birth);
        
        if (!age1 || !age2) return { appropriate: true, yearDiff: 0 };
        
        const yearDiff = Math.abs(age1 - age2);
        return {
            appropriate: yearDiff <= 20, // Reasonable sibling age gap
            yearDiff
        };
    }

    static calculateDataQuality(user1, user2) {
        const user2Analysis = this.analyzeProfile(user2);
        return user2Analysis.completeness;
    }

    static getDisplayName(user) {
        const first = user.first_name || user.firstName || '';
        const last = user.last_name || user.lastName || '';
        return `${first} ${last}`.trim() || 'Unknown';
    }

    static getDisplayLocation(user) {
        return user.location || user.city || user.country || 'Unknown';
    }

    static calculateMutualConnections(user1, user2) {
        // Implementation for mutual connections count
        // This would require checking against connections collection
        return 0; // Placeholder
    }

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

module.exports = EnhancedMatchingService;