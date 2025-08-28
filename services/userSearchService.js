/**
 * User Search Service
 * ==================
 * 
 * Provides comprehensive user search functionality with privacy controls
 * Supports text search, filters, and advanced matching
 */

const { User, BlockedUser } = require('../models');

class UserSearchService {
    constructor() {
        this.searchableFields = [
            'first_name',
            'last_name', 
            'profession',
            'interests',
            'heritage',
            'location',
            'city',
            'country',
            'occupation'
        ];
        
        console.log('🔍 User Search Service initialized');
    }
    
    /**
     * Search users with text query and filters
     */
    async searchUsers(searcherId, options = {}) {
        try {
            const {
                query = '',
                filters = {},
                page = 1,
                limit = 20,
                sortBy = 'relevance',
                includeBlocked = false
            } = options;
            
            console.log(`🔍 Searching users: "${query}" with filters:`, filters);
            
            // Build search pipeline
            const pipeline = [];
            
            // 1. Match stage - text search and filters
            const matchStage = await this.buildMatchStage(query, filters, searcherId, includeBlocked);
            pipeline.push({ $match: matchStage });
            
            // 2. Add relevance scoring
            if (query.trim()) {
                pipeline.push(this.buildRelevanceStage(query));
            }
            
            // 3. Sort stage
            pipeline.push(this.buildSortStage(sortBy));
            
            // 4. Pagination
            pipeline.push({ $skip: (page - 1) * limit });
            pipeline.push({ $limit: parseInt(limit) });
            
            // 5. Project safe fields only
            pipeline.push(this.buildProjectionStage());
            
            // Execute search
            const users = await User.aggregate(pipeline);
            
            // Get total count for pagination
            const countPipeline = [
                { $match: matchStage },
                { $count: 'total' }
            ];
            const countResult = await User.aggregate(countPipeline);
            const total = countResult[0]?.total || 0;
            
            console.log(`✅ Found ${users.length} users out of ${total} total matches`);
            
            return {
                users: users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    totalPages: Math.ceil(total / limit),
                    hasMore: (page * limit) < total
                },
                query: query,
                filters: filters,
                sortBy: sortBy
            };
            
        } catch (error) {
            console.error('User search failed:', error);
            return {
                users: [],
                pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
                error: error.message
            };
        }
    }
    
    /**
     * Build MongoDB match stage for search
     */
    async buildMatchStage(query, filters, searcherId, includeBlocked) {
        const matchConditions = {
            _id: { $ne: searcherId }, // Exclude searcher
            isActive: { $ne: false }, // Only active users
            suspended: { $ne: true } // Exclude suspended users
        };
        
        // Text search across multiple fields
        if (query.trim()) {
            const searchTerms = query.trim().split(/\s+/).map(term => 
                term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex
            );
            
            const textSearchConditions = [];
            
            // Search in names
            textSearchConditions.push({
                $or: [
                    { first_name: { $regex: searchTerms.join('|'), $options: 'i' } },
                    { last_name: { $regex: searchTerms.join('|'), $options: 'i' } }
                ]
            });
            
            // Search in profession/occupation
            textSearchConditions.push({
                $or: [
                    { profession: { $regex: searchTerms.join('|'), $options: 'i' } },
                    { occupation: { $regex: searchTerms.join('|'), $options: 'i' } }
                ]
            });
            
            // Search in interests (array field)
            textSearchConditions.push({
                interests: { $elemMatch: { $regex: searchTerms.join('|'), $options: 'i' } }
            });
            
            // Search in location fields
            textSearchConditions.push({
                $or: [
                    { location: { $regex: searchTerms.join('|'), $options: 'i' } },
                    { city: { $regex: searchTerms.join('|'), $options: 'i' } },
                    { country: { $regex: searchTerms.join('|'), $options: 'i' } }
                ]
            });
            
            // Search in heritage
            textSearchConditions.push({
                heritage: { $regex: searchTerms.join('|'), $options: 'i' }
            });
            
            matchConditions.$or = textSearchConditions;
        }
        
        // Apply filters
        if (filters.ageMin || filters.ageMax) {
            matchConditions.date_of_birth = {};
            
            if (filters.ageMax) {
                const minDate = new Date();
                minDate.setFullYear(minDate.getFullYear() - parseInt(filters.ageMax));
                matchConditions.date_of_birth.$gte = minDate;
            }
            
            if (filters.ageMin) {
                const maxDate = new Date();
                maxDate.setFullYear(maxDate.getFullYear() - parseInt(filters.ageMin));
                matchConditions.date_of_birth.$lte = maxDate;
            }
        }
        
        if (filters.location) {
            matchConditions.$or = matchConditions.$or || [];
            matchConditions.$or.push({
                $or: [
                    { location: { $regex: filters.location, $options: 'i' } },
                    { city: { $regex: filters.location, $options: 'i' } },
                    { country: { $regex: filters.location, $options: 'i' } }
                ]
            });
        }
        
        if (filters.profession) {
            matchConditions.$or = matchConditions.$or || [];
            matchConditions.$or.push({
                $or: [
                    { profession: { $regex: filters.profession, $options: 'i' } },
                    { occupation: { $regex: filters.profession, $options: 'i' } }
                ]
            });
        }
        
        if (filters.interests && Array.isArray(filters.interests)) {
            matchConditions.interests = { 
                $in: filters.interests.map(interest => new RegExp(interest, 'i'))
            };
        }
        
        if (filters.hasProfilePhoto) {
            matchConditions.profilePictureUrl = { $exists: true, $ne: null };
        }
        
        // Exclude blocked users unless specifically requested
        if (!includeBlocked) {
            const blockedUserIds = await this.getBlockedUserIds(searcherId);
            if (blockedUserIds.length > 0) {
                matchConditions._id = { 
                    ...matchConditions._id,
                    $nin: blockedUserIds 
                };
            }
        }
        
        return matchConditions;
    }
    
    /**
     * Build relevance scoring stage
     */
    buildRelevanceStage(query) {
        const searchTerms = query.trim().split(/\s+/).map(term => 
            term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        
        return {
            $addFields: {
                relevanceScore: {
                    $add: [
                        // Name matches get highest score
                        {
                            $cond: [
                                { $regexMatch: { input: '$first_name', regex: searchTerms.join('|'), options: 'i' } },
                                10, 0
                            ]
                        },
                        {
                            $cond: [
                                { $regexMatch: { input: '$last_name', regex: searchTerms.join('|'), options: 'i' } },
                                10, 0
                            ]
                        },
                        // Profession matches
                        {
                            $cond: [
                                { $regexMatch: { input: { $ifNull: ['$profession', ''] }, regex: searchTerms.join('|'), options: 'i' } },
                                7, 0
                            ]
                        },
                        // Location matches
                        {
                            $cond: [
                                { $regexMatch: { input: { $ifNull: ['$location', ''] }, regex: searchTerms.join('|'), options: 'i' } },
                                5, 0
                            ]
                        },
                        // Interest matches (lower score as it's common)
                        {
                            $cond: [
                                { 
                                    $gt: [
                                        { $size: { $filter: { 
                                            input: { $ifNull: ['$interests', []] },
                                            cond: { $regexMatch: { input: '$$this', regex: searchTerms.join('|'), options: 'i' } }
                                        }}},
                                        0
                                    ]
                                },
                                3, 0
                            ]
                        }
                    ]
                }
            }
        };
    }
    
    /**
     * Build sort stage
     */
    buildSortStage(sortBy) {
        const sortOptions = {
            relevance: { relevanceScore: -1, createdAt: -1 },
            newest: { createdAt: -1 },
            name: { first_name: 1, last_name: 1 },
            location: { location: 1, city: 1 }
        };
        
        return { $sort: sortOptions[sortBy] || sortOptions.relevance };
    }
    
    /**
     * Build projection stage (safe fields only)
     */
    buildProjectionStage() {
        return {
            $project: {
                _id: 1,
                first_name: 1,
                last_name: 1,
                profilePictureUrl: 1,
                profession: 1,
                occupation: 1,
                location: 1,
                city: 1,
                country: 1,
                interests: 1,
                heritage: 1,
                age: {
                    $cond: [
                        { $ne: ['$date_of_birth', null] },
                        { $floor: { $divide: [{ $subtract: [new Date(), '$date_of_birth'] }, 365.25 * 24 * 60 * 60 * 1000] } },
                        null
                    ]
                },
                lastActive: '$last_activity',
                isOnline: {
                    $gt: ['$last_activity', new Date(Date.now() - 10 * 60 * 1000)] // Online if active in last 10 minutes
                },
                relevanceScore: 1,
                // Privacy-safe fields only
                hasProfilePhoto: { $ne: ['$profilePictureUrl', null] },
                memberSince: '$createdAt'
            }
        };
    }
    
    /**
     * Get blocked user IDs for a user
     */
    async getBlockedUserIds(userId) {
        try {
            const blockedUsers = await BlockedUser.find({
                $or: [
                    { blocker: userId, isActive: true },
                    { blocked: userId, isActive: true }
                ]
            }, 'blocker blocked');
            
            const blockedIds = [];
            for (const block of blockedUsers) {
                if (block.blocker.toString() !== userId) {
                    blockedIds.push(block.blocker);
                }
                if (block.blocked.toString() !== userId) {
                    blockedIds.push(block.blocked);
                }
            }
            
            return [...new Set(blockedIds.map(id => id.toString()))];
            
        } catch (error) {
            console.error('Failed to get blocked user IDs:', error);
            return [];
        }
    }
    
    /**
     * Get search suggestions based on partial query
     */
    async getSearchSuggestions(query, limit = 5) {
        try {
            if (!query || query.length < 2) {
                return [];
            }
            
            const pipeline = [
                {
                    $match: {
                        $or: [
                            { first_name: { $regex: `^${query}`, $options: 'i' } },
                            { last_name: { $regex: `^${query}`, $options: 'i' } },
                            { profession: { $regex: `^${query}`, $options: 'i' } },
                            { location: { $regex: `^${query}`, $options: 'i' } }
                        ],
                        isActive: { $ne: false },
                        suspended: { $ne: true }
                    }
                },
                {
                    $project: {
                        suggestion: {
                            $concat: ['$first_name', ' ', '$last_name']
                        },
                        type: 'user',
                        profession: 1,
                        location: 1
                    }
                },
                { $limit: limit }
            ];
            
            const suggestions = await User.aggregate(pipeline);
            
            return suggestions.map(s => ({
                text: s.suggestion,
                type: s.type,
                meta: {
                    profession: s.profession,
                    location: s.location
                }
            }));
            
        } catch (error) {
            console.error('Search suggestions failed:', error);
            return [];
        }
    }
    
    /**
     * Get popular search terms
     */
    async getPopularSearches() {
        try {
            // This would typically come from search analytics
            // For now, return common professions and interests
            const pipeline = [
                { $match: { profession: { $exists: true, $ne: null } } },
                { $group: { _id: '$profession', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ];
            
            const professions = await User.aggregate(pipeline);
            
            return professions.map(p => ({
                term: p._id,
                type: 'profession',
                count: p.count
            }));
            
        } catch (error) {
            console.error('Popular searches failed:', error);
            return [];
        }
    }
    
    /**
     * Advanced search with multiple criteria
     */
    async advancedSearch(searcherId, criteria) {
        try {
            const {
                name,
                profession,
                location,
                ageRange,
                interests,
                heritage,
                hasPhoto = false,
                isOnline = false,
                page = 1,
                limit = 20
            } = criteria;
            
            const pipeline = [];
            
            // Build advanced match conditions
            const matchConditions = {
                _id: { $ne: searcherId },
                isActive: { $ne: false },
                suspended: { $ne: true }
            };
            
            if (name) {
                matchConditions.$or = [
                    { first_name: { $regex: name, $options: 'i' } },
                    { last_name: { $regex: name, $options: 'i' } }
                ];
            }
            
            if (profession) {
                matchConditions.$and = matchConditions.$and || [];
                matchConditions.$and.push({
                    $or: [
                        { profession: { $regex: profession, $options: 'i' } },
                        { occupation: { $regex: profession, $options: 'i' } }
                    ]
                });
            }
            
            if (location) {
                matchConditions.$and = matchConditions.$and || [];
                matchConditions.$and.push({
                    $or: [
                        { location: { $regex: location, $options: 'i' } },
                        { city: { $regex: location, $options: 'i' } },
                        { country: { $regex: location, $options: 'i' } }
                    ]
                });
            }
            
            if (ageRange && (ageRange.min || ageRange.max)) {
                matchConditions.date_of_birth = {};
                if (ageRange.max) {
                    const minDate = new Date();
                    minDate.setFullYear(minDate.getFullYear() - ageRange.max);
                    matchConditions.date_of_birth.$gte = minDate;
                }
                if (ageRange.min) {
                    const maxDate = new Date();
                    maxDate.setFullYear(maxDate.getFullYear() - ageRange.min);
                    matchConditions.date_of_birth.$lte = maxDate;
                }
            }
            
            if (interests && interests.length > 0) {
                matchConditions.interests = {
                    $in: interests.map(interest => new RegExp(interest, 'i'))
                };
            }
            
            if (heritage) {
                matchConditions.heritage = { $regex: heritage, $options: 'i' };
            }
            
            if (hasPhoto) {
                matchConditions.profilePictureUrl = { $exists: true, $ne: null };
            }
            
            if (isOnline) {
                const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                matchConditions.last_activity = { $gte: tenMinutesAgo };
            }
            
            // Exclude blocked users
            const blockedUserIds = await this.getBlockedUserIds(searcherId);
            if (blockedUserIds.length > 0) {
                matchConditions._id = { 
                    ...matchConditions._id,
                    $nin: blockedUserIds 
                };
            }
            
            pipeline.push({ $match: matchConditions });
            
            // Sort by relevance and activity
            pipeline.push({ $sort: { last_activity: -1, createdAt: -1 } });
            
            // Pagination
            pipeline.push({ $skip: (page - 1) * limit });
            pipeline.push({ $limit: parseInt(limit) });
            
            // Project safe fields
            pipeline.push(this.buildProjectionStage());
            
            const users = await User.aggregate(pipeline);
            
            // Get total count
            const countResult = await User.aggregate([
                { $match: matchConditions },
                { $count: 'total' }
            ]);
            const total = countResult[0]?.total || 0;
            
            console.log(`🎯 Advanced search found ${users.length}/${total} users`);
            
            return {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasMore: (page * limit) < total
                },
                criteria
            };
            
        } catch (error) {
            console.error('Advanced search failed:', error);
            return {
                users: [],
                pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
                error: error.message
            };
        }
    }
}

// Create singleton instance
const userSearchService = new UserSearchService();

module.exports = {
    userSearchService,
    UserSearchService
};