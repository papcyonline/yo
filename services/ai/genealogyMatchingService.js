// Try to import existing AI matching service, fallback if not available
let enhancedMatchingService = null;
try {
  const aiService = require('../aiMatchingService');
  enhancedMatchingService = aiService.enhancedMatchingService || aiService;
} catch (error) {
  console.warn('AI matching service not found, using basic matching only');
}

const FamilyMember = require('../../models/FamilyMember');
const User = require('../../models/User');

class GenealogyMatchingService {
  constructor() {
    this.confidenceThreshold = 70; // Minimum confidence for auto-suggestions
    this.matchingFields = [
      'name', 'dateOfBirth', 'placeOfBirth', 'parents', 'siblings'
    ];
  }

  /**
   * Find potential family matches for a user using AI
   */
  async findFamilyMatches(userId, userProfile) {
    try {
      console.log(`🔍 Finding family matches for user ${userId}`);
      
      // Get user's existing family tree members to avoid self-matches
      const existingMembers = await FamilyMember.find({ 
        $or: [
          { userId: userId },
          { 'claimedBy.userId': userId }
        ]
      });
      
      const excludeIds = existingMembers.map(m => m._id.toString());

      // Search for potential matches based on various criteria
      const nameMatches = await this.findNameMatches(userProfile, excludeIds);
      const locationMatches = await this.findLocationMatches(userProfile, excludeIds);
      const dateMatches = await this.findDateMatches(userProfile, excludeIds);

      // Combine and score matches
      const allMatches = this.combineMatches([nameMatches, locationMatches, dateMatches]);
      
      // Use existing AI matching service to enhance results if available
      const enhancedMatches = enhancedMatchingService ? 
        await this.enhanceWithAI(userId, userProfile, allMatches) : 
        allMatches.map(match => ({
          ...match,
          aiEnhanced: false,
          reasons: this.generateMatchReasons(userProfile, match.member, match.matchingFields)
        }));
      
      // Filter by confidence threshold
      const qualifiedMatches = enhancedMatches.filter(
        match => match.confidence >= this.confidenceThreshold
      );

      console.log(`✅ Found ${qualifiedMatches.length} potential family matches`);
      return qualifiedMatches;

    } catch (error) {
      console.error('Error finding family matches:', error);
      throw error;
    }
  }

  /**
   * Find matches based on name similarity
   */
  async findNameMatches(userProfile, excludeIds) {
    const nameVariations = this.generateNameVariations(userProfile);
    
    const matches = await FamilyMember.find({
      _id: { $nin: excludeIds },
      visibility: { $in: ['public', 'family_only'] },
      $or: nameVariations
    }).populate('familyTreeId', 'name familySurname allowCollaboration')
      .limit(50);

    return matches.map(member => ({
      member,
      type: 'name_match',
      confidence: this.calculateNameConfidence(userProfile, member),
      matchingFields: this.getNameMatchingFields(userProfile, member)
    }));
  }

  /**
   * Find matches based on location
   */
  async findLocationMatches(userProfile, excludeIds) {
    if (!userProfile.placeOfBirth && !userProfile.currentLocation) {
      return [];
    }

    const locationQueries = [];
    
    if (userProfile.placeOfBirth) {
      locationQueries.push(
        { placeOfBirth: new RegExp(userProfile.placeOfBirth, 'i') },
        { currentLocation: new RegExp(userProfile.placeOfBirth, 'i') }
      );
    }

    if (userProfile.currentLocation && userProfile.currentLocation !== userProfile.placeOfBirth) {
      locationQueries.push(
        { placeOfBirth: new RegExp(userProfile.currentLocation, 'i') },
        { currentLocation: new RegExp(userProfile.currentLocation, 'i') }
      );
    }

    if (locationQueries.length === 0) return [];

    const matches = await FamilyMember.find({
      _id: { $nin: excludeIds },
      visibility: { $in: ['public', 'family_only'] },
      $or: locationQueries
    }).populate('familyTreeId', 'name familySurname allowCollaboration')
      .limit(30);

    return matches.map(member => ({
      member,
      type: 'location_match',
      confidence: this.calculateLocationConfidence(userProfile, member),
      matchingFields: this.getLocationMatchingFields(userProfile, member)
    }));
  }

  /**
   * Find matches based on birth dates (same generation, siblings, etc.)
   */
  async findDateMatches(userProfile, excludeIds) {
    if (!userProfile.dateOfBirth) return [];

    const birthYear = new Date(userProfile.dateOfBirth).getFullYear();
    const yearRange = 5; // Look for people born within 5 years

    const matches = await FamilyMember.find({
      _id: { $nin: excludeIds },
      visibility: { $in: ['public', 'family_only'] },
      dateOfBirth: {
        $gte: new Date(birthYear - yearRange, 0, 1),
        $lte: new Date(birthYear + yearRange, 11, 31)
      }
    }).populate('familyTreeId', 'name familySurname allowCollaboration')
      .limit(30);

    return matches.map(member => ({
      member,
      type: 'date_match',
      confidence: this.calculateDateConfidence(userProfile, member),
      matchingFields: ['dateOfBirth']
    }));
  }

  /**
   * Enhance matches using existing AI matching service
   */
  async enhanceWithAI(userId, userProfile, preliminaryMatches) {
    try {
      // Check if AI service is available
      if (!enhancedMatchingService || typeof enhancedMatchingService.calculateCompatibility !== 'function') {
        console.warn('AI matching service not available, using basic matching');
        return preliminaryMatches.map(match => ({
          ...match,
          aiEnhanced: false,
          reasons: this.generateMatchReasons(userProfile, match.member, match.matchingFields)
        }));
      }
      // Convert user profile to matching format
      const userMatchingData = {
        userId: userId,
        name: userProfile.name || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim(),
        age: userProfile.age,
        location: userProfile.currentLocation || userProfile.placeOfBirth,
        interests: userProfile.interests || [],
        bio: userProfile.bio || '',
        // Add genealogy-specific data
        dateOfBirth: userProfile.dateOfBirth,
        placeOfBirth: userProfile.placeOfBirth,
        familyName: userProfile.lastName || userProfile.familySurname
      };

      const enhancedMatches = [];

      for (const match of preliminaryMatches) {
        try {
          // Convert family member to matching format
          const memberMatchingData = {
            userId: match.member.userId?.toString(),
            name: match.member.name,
            location: match.member.currentLocation || match.member.placeOfBirth,
            bio: match.member.bio || '',
            dateOfBirth: match.member.dateOfBirth,
            placeOfBirth: match.member.placeOfBirth,
            familyName: match.member.lastName
          };

          // Use existing AI matching service for enhanced scoring
          const aiScore = await enhancedMatchingService.calculateCompatibility(
            userMatchingData, 
            memberMatchingData
          );

          // Combine preliminary confidence with AI score
          const combinedConfidence = Math.round((match.confidence + aiScore.overall) / 2);

          enhancedMatches.push({
            ...match,
            confidence: combinedConfidence,
            aiEnhanced: true,
            aiScores: aiScore,
            reasons: this.generateMatchReasons(userProfile, match.member, match.matchingFields)
          });

        } catch (aiError) {
          console.warn(`AI enhancement failed for member ${match.member._id}:`, aiError.message);
          // Keep original match without AI enhancement
          enhancedMatches.push({
            ...match,
            aiEnhanced: false,
            reasons: this.generateMatchReasons(userProfile, match.member, match.matchingFields)
          });
        }
      }

      return enhancedMatches.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      console.error('Error enhancing matches with AI:', error);
      // Return original matches if AI enhancement fails
      return preliminaryMatches.map(match => ({
        ...match,
        aiEnhanced: false,
        reasons: this.generateMatchReasons(userProfile, match.member, match.matchingFields)
      }));
    }
  }

  /**
   * Generate variations of a name for matching
   */
  generateNameVariations(userProfile) {
    const variations = [];
    const firstName = userProfile.firstName || '';
    const lastName = userProfile.lastName || '';
    const fullName = userProfile.name || `${firstName} ${lastName}`.trim();

    if (firstName) {
      variations.push(
        { firstName: new RegExp(firstName, 'i') },
        { name: new RegExp(firstName, 'i') }
      );
    }

    if (lastName) {
      variations.push(
        { lastName: new RegExp(lastName, 'i') },
        { name: new RegExp(lastName, 'i') }
      );
    }

    if (fullName) {
      variations.push({ name: new RegExp(fullName, 'i') });
    }

    return variations;
  }

  /**
   * Combine multiple match arrays and remove duplicates
   */
  combineMatches(matchArrays) {
    const combined = [];
    const seenIds = new Set();

    matchArrays.forEach(matches => {
      matches.forEach(match => {
        const id = match.member._id.toString();
        if (!seenIds.has(id)) {
          seenIds.add(id);
          combined.push(match);
        } else {
          // If we've seen this member, update with highest confidence
          const existingIndex = combined.findIndex(m => m.member._id.toString() === id);
          if (existingIndex > -1 && match.confidence > combined[existingIndex].confidence) {
            combined[existingIndex] = match;
          }
        }
      });
    });

    return combined;
  }

  /**
   * Calculate confidence scores for different match types
   */
  calculateNameConfidence(userProfile, member) {
    let confidence = 0;
    
    const userFirstName = (userProfile.firstName || '').toLowerCase();
    const userLastName = (userProfile.lastName || '').toLowerCase();
    const memberFirstName = (member.firstName || '').toLowerCase();
    const memberLastName = (member.lastName || '').toLowerCase();

    // Exact name matches
    if (userFirstName && userFirstName === memberFirstName) confidence += 40;
    if (userLastName && userLastName === memberLastName) confidence += 40;

    // Partial matches
    if (userFirstName && memberFirstName.includes(userFirstName)) confidence += 20;
    if (userLastName && memberLastName.includes(userLastName)) confidence += 20;

    // Name similarity (simple Levenshtein-like)
    if (userFirstName && memberFirstName) {
      const similarity = this.calculateStringSimilarity(userFirstName, memberFirstName);
      confidence += Math.round(similarity * 30);
    }

    return Math.min(confidence, 100);
  }

  calculateLocationConfidence(userProfile, member) {
    let confidence = 0;
    
    const userLocations = [
      userProfile.placeOfBirth?.toLowerCase(),
      userProfile.currentLocation?.toLowerCase()
    ].filter(Boolean);

    const memberLocations = [
      member.placeOfBirth?.toLowerCase(),
      member.currentLocation?.toLowerCase()
    ].filter(Boolean);

    for (const userLoc of userLocations) {
      for (const memberLoc of memberLocations) {
        if (userLoc === memberLoc) {
          confidence += 50;
        } else if (userLoc.includes(memberLoc) || memberLoc.includes(userLoc)) {
          confidence += 30;
        }
      }
    }

    return Math.min(confidence, 100);
  }

  calculateDateConfidence(userProfile, member) {
    if (!userProfile.dateOfBirth || !member.dateOfBirth) return 0;

    const userYear = new Date(userProfile.dateOfBirth).getFullYear();
    const memberYear = new Date(member.dateOfBirth).getFullYear();
    const yearDiff = Math.abs(userYear - memberYear);

    // Higher confidence for closer birth years (potential siblings)
    if (yearDiff === 0) return 80;
    if (yearDiff === 1) return 70;
    if (yearDiff <= 2) return 60;
    if (yearDiff <= 5) return 40;
    if (yearDiff <= 10) return 20;
    
    return 10;
  }

  /**
   * Get matching fields for different match types
   */
  getNameMatchingFields(userProfile, member) {
    const fields = [];
    
    if ((userProfile.firstName || '').toLowerCase() === (member.firstName || '').toLowerCase()) {
      fields.push('firstName');
    }
    if ((userProfile.lastName || '').toLowerCase() === (member.lastName || '').toLowerCase()) {
      fields.push('lastName');
    }
    
    return fields;
  }

  getLocationMatchingFields(userProfile, member) {
    const fields = [];
    
    const userBirth = userProfile.placeOfBirth?.toLowerCase();
    const userCurrent = userProfile.currentLocation?.toLowerCase();
    const memberBirth = member.placeOfBirth?.toLowerCase();
    const memberCurrent = member.currentLocation?.toLowerCase();

    if (userBirth && (userBirth === memberBirth || userBirth === memberCurrent)) {
      fields.push('placeOfBirth');
    }
    if (userCurrent && (userCurrent === memberBirth || userCurrent === memberCurrent)) {
      fields.push('currentLocation');
    }

    return fields;
  }

  /**
   * Generate human-readable match reasons
   */
  generateMatchReasons(userProfile, member, matchingFields) {
    const reasons = [];

    if (matchingFields.includes('firstName') && matchingFields.includes('lastName')) {
      reasons.push(`Same name: ${member.name}`);
    } else if (matchingFields.includes('lastName')) {
      reasons.push(`Same family name: ${member.lastName}`);
    } else if (matchingFields.includes('firstName')) {
      reasons.push(`Same first name: ${member.firstName}`);
    }

    if (matchingFields.includes('placeOfBirth')) {
      reasons.push(`Born in same place: ${member.placeOfBirth}`);
    }

    if (matchingFields.includes('currentLocation')) {
      reasons.push(`Lives in same area: ${member.currentLocation}`);
    }

    if (matchingFields.includes('dateOfBirth')) {
      const userYear = new Date(userProfile.dateOfBirth).getFullYear();
      const memberYear = new Date(member.dateOfBirth).getFullYear();
      const yearDiff = Math.abs(userYear - memberYear);
      
      if (yearDiff === 0) {
        reasons.push('Born in the same year');
      } else if (yearDiff <= 2) {
        reasons.push('Born around the same time');
      } else {
        reasons.push('Similar generation');
      }
    }

    if (reasons.length === 0) {
      reasons.push('Potential family connection found');
    }

    return reasons;
  }

  /**
   * Simple string similarity calculation
   */
  calculateStringSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / maxLen;
  }

  /**
   * Process and store AI match results
   */
  async processMatchResults(userId, matches) {
    try {
      // Store potential matches in family members for future reference
      const user = await User.findById(userId);
      
      for (const match of matches) {
        // Add to member's potential matches
        await FamilyMember.findByIdAndUpdate(match.member._id, {
          $addToSet: {
            'aiMatchingData.potentialMatches': {
              userId: userId,
              confidence: match.confidence,
              matchingFields: match.matchingFields,
              status: 'pending',
              discoveredAt: new Date()
            }
          }
        });
      }

      console.log(`✅ Processed ${matches.length} AI match results for user ${userId}`);
      return matches;

    } catch (error) {
      console.error('Error processing match results:', error);
      throw error;
    }
  }

  /**
   * Get match suggestions for a user
   */
  async getMatchSuggestions(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      // Find family members that have this user as a potential match
      const suggestions = await FamilyMember.find({
        'aiMatchingData.potentialMatches.userId': userId,
        'aiMatchingData.potentialMatches.status': 'pending'
      }).populate('familyTreeId', 'name familySurname allowCollaboration')
        .populate('claimedBy.userId', 'name profileImage');

      return suggestions.map(member => {
        const userMatch = member.aiMatchingData.potentialMatches.find(
          match => match.userId.toString() === userId.toString()
        );

        return {
          member,
          confidence: userMatch.confidence,
          matchingFields: userMatch.matchingFields,
          discoveredAt: userMatch.discoveredAt,
          canClaim: member.canBeClaimed(userId),
          userPermissions: member.getUserPermissions(userId)
        };
      }).sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      console.error('Error getting match suggestions:', error);
      throw error;
    }
  }
}

module.exports = new GenealogyMatchingService();