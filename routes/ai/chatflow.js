const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/auth');
const {
  getNextQuestion,
  saveAnswer,
  getUnansweredQuestions,
  getChatflowStatus,
  resetChatflow,
  getQuestionnaireResponses,
  syncResponsesToProfile
} = require('../../services/ai/chatflowService'); // Import MongoDB chatflow functions

/**
 * Get next question in the chatflow
 * GET /api/ai/chatflow/next-question
 */
router.get('/next-question', authMiddleware, getNextQuestion);

/**
 * Save answer to current question
 * POST /api/ai/chatflow/save-answer
 */
router.post('/save-answer', authMiddleware, saveAnswer);

/**
 * Get all unanswered questions
 * GET /api/ai/chatflow/unanswered
 */
router.get('/unanswered', authMiddleware, getUnansweredQuestions);

/**
 * Get chatflow completion status
 * GET /api/ai/chatflow/status
 */
router.get('/status', authMiddleware, getChatflowStatus);

/**
 * Reset chatflow progress (for testing)
 * POST /api/ai/chatflow/reset
 */
router.post('/reset', authMiddleware, resetChatflow);

/**
 * Get all questionnaire responses for profile review
 * GET /api/ai/chatflow/responses
 */
router.get('/responses', authMiddleware, getQuestionnaireResponses);

/**
 * Sync questionnaire responses to profile
 * POST /api/ai/chatflow/sync-profile
 */
router.post('/sync-profile', authMiddleware, syncResponsesToProfile);

module.exports = router;