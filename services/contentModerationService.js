/**
 * Content Moderation Service
 * =========================
 * 
 * Provides automated content filtering and moderation capabilities
 * Detects inappropriate content, spam, harassment, and other violations
 */

const Report = require('../models/Report');
const { User } = require('../models');

class ContentModerationService {
    constructor() {
        this.profanityWords = [
            // Basic profanity (you would expand this list)
            'damn', 'hell', 'shit', 'fuck', 'bitch', 'ass', 'bastard',
            'crap', 'piss', 'whore', 'slut', 'cock', 'dick', 'pussy'
        ];
        
        this.spamPatterns = [
            /(.)\1{4,}/g, // Repeated characters (5+ times)
            /[A-Z]{5,}/g, // ALL CAPS (5+ chars)
            /(http|www|\.com|\.net|\.org)/gi, // URLs
            /(\$|money|cash|free|win|winner|prize)/gi, // Common spam words
            /(\d+[-.\s]?\d+[-.\s]?\d+)/g, // Phone numbers
        ];
        
        this.hateSpeechKeywords = [
            'kill yourself', 'kys', 'die', 'suicide', 'terrorist', 'nazi',
            'hitler', 'genocide', 'rape', 'murder', 'bomb', 'attack',
            'hate', 'violence', 'threat', 'kill', 'death'
        ];
        
        this.harassmentPatterns = [
            /you\s+(are|r)\s+(ugly|fat|stupid|worthless|loser)/gi,
            /i\s+(hate|despise|cant\s+stand)\s+you/gi,
            /nobody\s+(likes|wants|loves)\s+you/gi,
            /go\s+(die|away|kill\s+yourself)/gi
        ];
        
        console.log('🛡️ Content Moderation Service initialized');
    }
    
    /**
     * Moderate post content - main method for posts/status updates
     */
    async moderatePost({ content, userId }) {
        console.log(`🔍 Moderating post content for user ${userId}`);
        
        // Analyze the content
        const analysis = await this.analyzeContent(content, { userId });
        
        // Determine if content is approved
        const overallApproved = analysis.overallScore >= 0.5 && 
                               analysis.violations.length === 0;
        
        return {
            overallApproved,
            content: {
                modifiedContent: analysis.modifiedContent || content,
                flags: analysis.violations,
                score: analysis.overallScore
            },
            analysis
        };
    }
    
    /**
     * Analyze content for violations
     */
    async analyzeContent(content, context = {}) {
        const analysis = {
            content,
            violations: [],
            severity: 'none', // none, low, medium, high, critical
            confidence: 0,
            shouldBlock: false,
            shouldFlag: false,
            tags: []
        };
        
        try {
            // Skip empty content
            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                return analysis;
            }
            
            const lowerContent = content.toLowerCase();
            
            // Check for profanity
            const profanityCheck = this.checkProfanity(lowerContent);
            if (profanityCheck.found) {
                analysis.violations.push({
                    type: 'profanity',
                    severity: 'medium',
                    matches: profanityCheck.matches,
                    description: 'Contains profanity or inappropriate language'
                });
                analysis.tags.push('profanity');
            }
            
            // Check for spam patterns
            const spamCheck = this.checkSpam(content);
            if (spamCheck.isSpam) {
                analysis.violations.push({
                    type: 'spam',
                    severity: 'medium',
                    patterns: spamCheck.patterns,
                    description: 'Content appears to be spam'
                });
                analysis.tags.push('spam');
            }
            
            // Check for hate speech
            const hateSpeechCheck = this.checkHateSpeech(lowerContent);
            if (hateSpeechCheck.found) {
                analysis.violations.push({
                    type: 'hate_speech',
                    severity: 'high',
                    matches: hateSpeechCheck.matches,
                    description: 'Contains hate speech or violent language'
                });
                analysis.tags.push('hate_speech');
            }
            
            // Check for harassment
            const harassmentCheck = this.checkHarassment(content);
            if (harassmentCheck.found) {
                analysis.violations.push({
                    type: 'harassment',
                    severity: 'high',
                    matches: harassmentCheck.matches,
                    description: 'Contains harassment or bullying language'
                });
                analysis.tags.push('harassment');
            }
            
            // Determine overall severity and actions
            this.determineSeverityAndActions(analysis);
            
            // Calculate overall score (1.0 = clean, 0.0 = violates)
            analysis.overallScore = analysis.violations.length === 0 ? 1.0 : 
                                   analysis.severity === 'low' ? 0.8 :
                                   analysis.severity === 'medium' ? 0.6 :
                                   analysis.severity === 'high' ? 0.3 : 0.0;
            
            // For now, we don't modify content, just return original
            analysis.modifiedContent = content;
            
            console.log(`🔍 Content analysis: ${analysis.violations.length} violations, severity: ${analysis.severity}, score: ${analysis.overallScore}`);
            
            return analysis;
            
        } catch (error) {
            console.error('Content moderation analysis failed:', error);
            return analysis;
        }
    }
    
    /**
     * Check for profanity
     */
    checkProfanity(content) {
        const matches = [];
        
        for (const word of this.profanityWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            if (regex.test(content)) {
                matches.push(word);
            }
        }
        
        return {
            found: matches.length > 0,
            matches: matches
        };
    }
    
    /**
     * Check for spam patterns
     */
    checkSpam(content) {
        const patterns = [];
        
        for (const pattern of this.spamPatterns) {
            if (pattern.test(content)) {
                patterns.push(pattern.toString());
            }
        }
        
        // Additional spam checks
        const wordCount = content.split(/\s+/).length;
        const uniqueWords = new Set(content.toLowerCase().split(/\s+/));
        const repetitionRatio = wordCount / uniqueWords.size;
        
        if (repetitionRatio > 3) {
            patterns.push('high_repetition');
        }
        
        return {
            isSpam: patterns.length > 0 || repetitionRatio > 3,
            patterns: patterns
        };
    }
    
    /**
     * Check for hate speech
     */
    checkHateSpeech(content) {
        const matches = [];
        
        for (const keyword of this.hateSpeechKeywords) {
            if (content.includes(keyword)) {
                matches.push(keyword);
            }
        }
        
        return {
            found: matches.length > 0,
            matches: matches
        };
    }
    
    /**
     * Check for harassment
     */
    checkHarassment(content) {
        const matches = [];
        
        for (const pattern of this.harassmentPatterns) {
            const match = pattern.exec(content);
            if (match) {
                matches.push(match[0]);
            }
            // Reset regex lastIndex for global patterns
            pattern.lastIndex = 0;
        }
        
        return {
            found: matches.length > 0,
            matches: matches
        };
    }
    
    /**
     * Determine overall severity and required actions
     */
    determineSeverityAndActions(analysis) {
        if (analysis.violations.length === 0) {
            analysis.severity = 'none';
            return;
        }
        
        const highSeverityViolations = analysis.violations.filter(v => v.severity === 'high');
        const criticalViolations = analysis.violations.filter(v => v.severity === 'critical');
        
        if (criticalViolations.length > 0) {
            analysis.severity = 'critical';
            analysis.shouldBlock = true;
            analysis.shouldFlag = true;
            analysis.confidence = 0.95;
        } else if (highSeverityViolations.length > 0) {
            analysis.severity = 'high';
            analysis.shouldBlock = true;
            analysis.shouldFlag = true;
            analysis.confidence = 0.85;
        } else if (analysis.violations.length >= 3) {
            analysis.severity = 'high';
            analysis.shouldFlag = true;
            analysis.confidence = 0.75;
        } else if (analysis.violations.length >= 2) {
            analysis.severity = 'medium';
            analysis.shouldFlag = true;
            analysis.confidence = 0.60;
        } else {
            analysis.severity = 'low';
            analysis.confidence = 0.40;
        }
    }
    
    /**
     * Process message content before saving
     */
    async processMessage(messageData, senderId) {
        try {
            const analysis = await this.analyzeContent(messageData.content, {
                type: 'message',
                senderId: senderId
            });
            
            // Block message if it violates policies
            if (analysis.shouldBlock) {
                console.log(`🚫 Blocked message from user ${senderId}: ${analysis.severity} violations`);
                
                // Create automatic report
                await this.createAutomaticReport(senderId, 'inappropriate_content', analysis);
                
                return {
                    allowed: false,
                    reason: 'Message blocked due to policy violations',
                    analysis: analysis,
                    blockedContent: messageData.content
                };
            }
            
            // Flag user if content is concerning but not blocked
            if (analysis.shouldFlag && analysis.severity !== 'none') {
                await this.flagUserForReview(senderId, 'message_content', analysis);
            }
            
            // Clean content (replace profanity with asterisks)
            let cleanedContent = messageData.content;
            if (analysis.violations.some(v => v.type === 'profanity')) {
                cleanedContent = this.cleanProfanity(messageData.content);
            }
            
            return {
                allowed: true,
                originalContent: messageData.content,
                cleanedContent: cleanedContent,
                analysis: analysis,
                modified: cleanedContent !== messageData.content
            };
            
        } catch (error) {
            console.error('Message processing failed:', error);
            // Allow message on error to avoid false blocks
            return {
                allowed: true,
                originalContent: messageData.content,
                cleanedContent: messageData.content,
                error: error.message
            };
        }
    }
    
    /**
     * Clean profanity by replacing with asterisks
     */
    cleanProfanity(content) {
        let cleaned = content;
        
        for (const word of this.profanityWords) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const replacement = '*'.repeat(word.length);
            cleaned = cleaned.replace(regex, replacement);
        }
        
        return cleaned;
    }
    
    /**
     * Create automatic report for policy violations
     */
    async createAutomaticReport(reportedUserId, type, analysis) {
        try {
            const systemUserId = '000000000000000000000001'; // System user ID
            
            const description = `Automatic report: ${analysis.violations.map(v => v.description).join(', ')}. 
                               Severity: ${analysis.severity}. 
                               Violations: ${analysis.violations.map(v => v.type).join(', ')}`;
            
            await Report.create({
                reporter: systemUserId,
                reported: reportedUserId,
                type: type,
                description: description,
                evidence: [{
                    type: 'automated_detection',
                    content: JSON.stringify(analysis),
                    timestamp: new Date()
                }],
                priority: analysis.severity === 'critical' ? 'urgent' : 
                         analysis.severity === 'high' ? 'high' : 'medium',
                autoEscalated: analysis.severity === 'critical'
            });
            
            console.log(`📢 Created automatic report for user ${reportedUserId}: ${type}`);
            
        } catch (error) {
            console.error('Failed to create automatic report:', error);
        }
    }
    
    /**
     * Flag user for manual review
     */
    async flagUserForReview(userId, reason, analysis) {
        try {
            await User.findByIdAndUpdate(userId, {
                flaggedForReview: true,
                flaggedAt: new Date(),
                flagReason: `Content moderation: ${reason} (${analysis.severity})`,
                contentViolations: {
                    $push: {
                        timestamp: new Date(),
                        reason: reason,
                        severity: analysis.severity,
                        violations: analysis.violations
                    }
                }
            });
            
            console.log(`🚩 Flagged user ${userId} for review: ${reason}`);
            
        } catch (error) {
            console.error('Failed to flag user for review:', error);
        }
    }
    
    /**
     * Get content moderation stats for a user
     */
    async getUserModerationStats(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return null;
            }
            
            const reports = await Report.find({ reported: userId });
            const automaticReports = reports.filter(r => r.reporter.toString() === '000000000000000000000001');
            
            return {
                userId: userId,
                flaggedForReview: user.flaggedForReview || false,
                flaggedAt: user.flaggedAt,
                flagReason: user.flagReason,
                totalReports: reports.length,
                automaticReports: automaticReports.length,
                manualReports: reports.length - automaticReports.length,
                contentViolations: user.contentViolations || [],
                suspended: user.suspended || false,
                suspendReason: user.suspendReason
            };
            
        } catch (error) {
            console.error('Failed to get user moderation stats:', error);
            return null;
        }
    }
}

// Create singleton instance
const contentModerationService = new ContentModerationService();

module.exports = {
    contentModerationService,
    ContentModerationService
};