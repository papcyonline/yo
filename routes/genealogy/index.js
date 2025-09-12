const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const upload = require('../../config/multer');
const FamilyTree = require('../../models/FamilyTree');
const FamilyMember = require('../../models/FamilyMember');
const cloudinary = require('cloudinary').v2;
const { body, validationResult, param } = require('express-validator');
const genealogyMatchingService = require('../../services/ai/genealogyMatchingService');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array()
    });
  }
  next();
};

// Family Tree Routes

/**
 * @swagger
 * /api/genealogy/trees:
 *   get:
 *     summary: Get user's family trees
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of family trees
 */
router.get('/trees', auth, async (req, res) => {
  try {
    const trees = await FamilyTree.findAccessible(req.user._id);
    
    res.json({
      success: true,
      data: trees
    });
  } catch (error) {
    console.error('Error fetching family trees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family trees'
    });
  }
});

/**
 * @swagger
 * /api/genealogy/trees:
 *   post:
 *     summary: Create new family tree
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.post('/trees', 
  auth,
  [
    body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Name must be 1-200 characters'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { name, description, familySurname, originLocation } = req.body;
      
      const familyTree = new FamilyTree({
        name,
        description,
        familySurname,
        originLocation,
        owner: req.user._id
      });
      
      await familyTree.save();
      
      res.status(201).json({
        success: true,
        data: familyTree
      });
    } catch (error) {
      console.error('Error creating family tree:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create family tree'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/trees/{treeId}:
 *   get:
 *     summary: Get specific family tree
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.get('/trees/:treeId', 
  auth,
  [param('treeId').isMongoId().withMessage('Invalid tree ID')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const tree = await FamilyTree.findById(req.params.treeId)
        .populate('owner', 'name profileImage')
        .populate('collaborators.userId', 'name profileImage');
      
      if (!tree) {
        return res.status(404).json({
          success: false,
          message: 'Family tree not found'
        });
      }
      
      // Check access
      const access = tree.hasAccess(req.user._id);
      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      res.json({
        success: true,
        data: tree
      });
    } catch (error) {
      console.error('Error fetching family tree:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch family tree'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/trees/{treeId}/members:
 *   get:
 *     summary: Get all members of a family tree
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.get('/trees/:treeId/members', 
  auth,
  [param('treeId').isMongoId().withMessage('Invalid tree ID')],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Check tree access
      const tree = await FamilyTree.findById(req.params.treeId);
      if (!tree) {
        return res.status(404).json({
          success: false,
          message: 'Family tree not found'
        });
      }
      
      const access = tree.hasAccess(req.user._id);
      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const members = await FamilyMember.find({ familyTreeId: req.params.treeId })
        .populate('parents', 'name photo isAlive generation')
        .populate('children', 'name photo isAlive generation')
        .populate('siblings', 'name photo isAlive generation')
        .populate('spouse', 'name photo isAlive generation')
        .sort({ generation: 1, createdAt: 1 });
      
      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      console.error('Error fetching family members:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch family members'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/trees/{treeId}/members:
 *   post:
 *     summary: Add new family member
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.post('/trees/:treeId/members',
  auth,
  upload.single('photo'),
  [
    param('treeId').isMongoId().withMessage('Invalid tree ID'),
    body('firstName').trim().isLength({ min: 1, max: 100 }).withMessage('First name is required'),
    body('lastName').optional().trim().isLength({ max: 100 }).withMessage('Last name must be less than 100 characters'),
    body('gender').isIn(['male', 'female']).withMessage('Gender must be male or female'),
    body('generation').isInt({ min: 0 }).withMessage('Generation must be a non-negative integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Check tree access (skip for testing without auth)
      const tree = await FamilyTree.findById(req.params.treeId);
      if (!tree) {
        return res.status(404).json({
          success: false,
          message: 'Family tree not found'
        });
      }
      
      const access = tree.hasAccess(req.user._id, 'editor');
      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Edit access denied'
        });
      }
      
      let photoUrl = null;
      if (req.file) {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'genealogy/members',
          public_id: `member_${Date.now()}`,
          quality: 'auto',
          fetch_format: 'auto'
        });
        photoUrl = result.secure_url;
      }
      
      // Parse JSON strings from FormData if they exist
      const processedBody = { ...req.body };
      
      // Handle arrays that might be sent as JSON strings from FormData
      ['parents', 'children', 'siblings', 'achievements', 'photos'].forEach(field => {
        if (processedBody[field] && typeof processedBody[field] === 'string') {
          try {
            processedBody[field] = JSON.parse(processedBody[field]);
          } catch (e) {
            // If parsing fails, leave as is
            console.warn(`Failed to parse ${field} as JSON:`, processedBody[field]);
          }
        }
      });
      
      const memberData = {
        ...processedBody,
        photo: photoUrl,
        familyTreeId: req.params.treeId,
        userId: req.user._id,
        createdBy: req.user._id
      };
      
      const member = new FamilyMember(memberData);
      await member.save();
      
      // Update tree statistics
      await tree.updateStats();
      
      res.status(201).json({
        success: true,
        data: member
      });
    } catch (error) {
      console.error('Error creating family member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create family member'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/members/{memberId}:
 *   get:
 *     summary: Get specific family member
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.get('/members/:memberId',
  auth,
  [param('memberId').isMongoId().withMessage('Invalid member ID')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const member = await FamilyMember.findById(req.params.memberId)
        .populate('parents', 'name photo isAlive generation')
        .populate('children', 'name photo isAlive generation')
        .populate('siblings', 'name photo isAlive generation')
        .populate('spouse', 'name photo isAlive generation')
        .populate('familyTreeId');
      
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Family member not found'
        });
      }
      
      // Check tree access
      const access = member.familyTreeId.hasAccess(req.user._id);
      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      res.json({
        success: true,
        data: member
      });
    } catch (error) {
      console.error('Error fetching family member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch family member'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/members/{memberId}:
 *   put:
 *     summary: Update family member
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.put('/members/:memberId',
  auth,
  upload.single('photo'),
  [param('memberId').isMongoId().withMessage('Invalid member ID')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const member = await FamilyMember.findById(req.params.memberId).populate('familyTreeId');
      
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Family member not found'
        });
      }
      
      // Check edit access
      const access = member.familyTreeId.hasAccess(req.user._id, 'editor');
      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Edit access denied'
        });
      }
      
      // Handle photo upload
      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'genealogy/members',
          public_id: `member_${member._id}_${Date.now()}`,
          quality: 'auto',
          fetch_format: 'auto'
        });
        req.body.photo = result.secure_url;
      }
      
      // Handle photos array (multiple photos)
      if (req.body.photos && Array.isArray(req.body.photos)) {
        member.photos = req.body.photos;
        delete req.body.photos;
      }
      
      // Update member
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          member[key] = req.body[key];
        }
      });
      
      member.lastModifiedBy = req.user._id;
      await member.save();
      
      res.json({
        success: true,
        data: member
      });
    } catch (error) {
      console.error('Error updating family member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update family member'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/members/{memberId}/photos:
 *   post:
 *     summary: Add photos to family member
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.post('/members/:memberId/photos',
  auth,
  upload.array('photos', 10),
  [param('memberId').isMongoId().withMessage('Invalid member ID')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const member = await FamilyMember.findById(req.params.memberId).populate('familyTreeId');
      
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Family member not found'
        });
      }
      
      const access = member.familyTreeId.hasAccess(req.user._id, 'editor');
      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Edit access denied'
        });
      }
      
      const photoUrls = [];
      
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'genealogy/photos',
            public_id: `member_${member._id}_photo_${Date.now()}_${Math.random()}`,
            quality: 'auto',
            fetch_format: 'auto'
          });
          photoUrls.push(result.secure_url);
        }
      }
      
      // Add to existing photos
      member.photos = [...(member.photos || []), ...photoUrls];
      await member.save();
      
      res.json({
        success: true,
        data: {
          photos: member.photos,
          newPhotos: photoUrls
        }
      });
    } catch (error) {
      console.error('Error adding photos:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add photos'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/trees/{treeId}/stats:
 *   get:
 *     summary: Get family tree statistics
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.get('/trees/:treeId/stats',
  auth,
  [param('treeId').isMongoId().withMessage('Invalid tree ID')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const tree = await FamilyTree.findById(req.params.treeId);
      
      if (!tree) {
        return res.status(404).json({
          success: false,
          message: 'Family tree not found'
        });
      }
      
      const access = tree.hasAccess(req.user._id);
      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const stats = await FamilyMember.getTreeStats(req.params.treeId);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching tree stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tree statistics'
      });
    }
  }
);

// AI MATCHING & DISCOVERY ENDPOINTS

/**
 * @swagger
 * /api/genealogy/discover:
 *   post:
 *     summary: Find potential family matches based on user data
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.post('/discover', 
  auth,
  [
    body('firstName').optional().trim().isLength({ min: 1 }),
    body('lastName').optional().trim().isLength({ min: 1 }),
    body('dateOfBirth').optional().isISO8601(),
    body('placeOfBirth').optional().trim()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const userData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        dateOfBirth: req.body.dateOfBirth,
        placeOfBirth: req.body.placeOfBirth,
        ...req.body
      };

      const matches = await FamilyMember.findPotentialMatches(userData);
      
      // Filter out trees the user doesn't have access to
      const accessibleMatches = [];
      for (const match of matches) {
        const treeAccess = match.familyTreeId.hasAccess(req.user._id);
        if (treeAccess.hasAccess || match.visibility === 'public') {
          accessibleMatches.push({
            ...match.toObject(),
            userPermissions: match.getUserPermissions(req.user._id),
            canClaim: match.canBeClaimed(req.user._id)
          });
        }
      }

      res.json({
        success: true,
        data: accessibleMatches,
        count: accessibleMatches.length
      });
    } catch (error) {
      console.error('Error discovering family matches:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to discover family matches'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/members/{memberId}/claim:
 *   post:
 *     summary: Claim a family member
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.post('/members/:memberId/claim',
  auth,
  [
    param('memberId').isMongoId().withMessage('Invalid member ID'),
    body('relationship').isIn(['self', 'parent', 'child', 'sibling', 'spouse', 'relative', 'other']).withMessage('Invalid relationship'),
    body('evidence').optional().trim().isLength({ max: 1000 }).withMessage('Evidence must be less than 1000 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const member = await FamilyMember.findById(req.params.memberId).populate('familyTreeId');
      
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Family member not found'
        });
      }

      // Check if tree allows collaboration
      if (!member.familyTreeId.allowCollaboration) {
        return res.status(403).json({
          success: false,
          message: 'This family tree does not allow collaboration'
        });
      }

      try {
        const claim = member.addClaim(req.user._id, req.body.relationship);
        
        if (req.body.evidence) {
          claim.evidence = req.body.evidence;
        }

        await member.save();

        // If this is a self-claim, add user as collaborator to the tree
        if (req.body.relationship === 'self') {
          await member.familyTreeId.addCollaborator(req.user._id, 'editor', member.createdBy);
        }

        res.json({
          success: true,
          data: {
            member: member,
            claim: claim,
            userPermissions: member.getUserPermissions(req.user._id)
          },
          message: 'Family member claimed successfully'
        });
      } catch (claimError) {
        return res.status(400).json({
          success: false,
          message: claimError.message
        });
      }
    } catch (error) {
      console.error('Error claiming family member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to claim family member'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/members/{memberId}/claims:
 *   get:
 *     summary: Get all claims for a family member
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.get('/members/:memberId/claims',
  auth,
  [param('memberId').isMongoId().withMessage('Invalid member ID')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const member = await FamilyMember.findById(req.params.memberId)
        .populate('claimedBy.userId', 'name profileImage')
        .populate('familyTreeId');
      
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Family member not found'
        });
      }

      // Check access
      const userPermissions = member.getUserPermissions(req.user._id);
      if (!userPermissions.canView) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: {
          claims: member.claimedBy,
          primaryClaimer: member.primaryClaimer,
          userPermissions: userPermissions
        }
      });
    } catch (error) {
      console.error('Error fetching claims:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch claims'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/trees/{treeId}/collaborate:
 *   post:
 *     summary: Request collaboration on a family tree
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.post('/trees/:treeId/collaborate',
  auth,
  [
    param('treeId').isMongoId().withMessage('Invalid tree ID'),
    body('message').optional().trim().isLength({ max: 500 }).withMessage('Message must be less than 500 characters'),
    body('relationship').optional().trim().isLength({ max: 100 }).withMessage('Relationship must be less than 100 characters')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const tree = await FamilyTree.findById(req.params.treeId).populate('owner', 'name profileImage');
      
      if (!tree) {
        return res.status(404).json({
          success: false,
          message: 'Family tree not found'
        });
      }

      if (!tree.allowCollaboration) {
        return res.status(403).json({
          success: false,
          message: 'This family tree does not allow collaboration'
        });
      }

      // Check if user is already a collaborator
      const existingCollaboration = tree.collaborators.find(c => c.userId.equals(req.user._id));
      if (existingCollaboration) {
        return res.status(400).json({
          success: false,
          message: 'You are already a collaborator on this tree'
        });
      }

      // Add as viewer for now, owner can upgrade permissions
      await tree.addCollaborator(req.user._id, 'viewer', req.user._id);

      // TODO: Send notification to tree owner about collaboration request
      
      res.json({
        success: true,
        message: 'Collaboration request sent successfully'
      });
    } catch (error) {
      console.error('Error requesting collaboration:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to request collaboration'
      });
    }
  }
);

/**
 * @swagger
 * /api/genealogy/my-matches:
 *   get:
 *     summary: Get family matches for current user using AI
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.get('/my-matches', auth, async (req, res) => {
  try {
    // Get AI-enhanced match suggestions
    const suggestions = await genealogyMatchingService.getMatchSuggestions(req.user._id);
    
    res.json({
      success: true,
      data: suggestions,
      count: suggestions.length
    });
  } catch (error) {
    console.error('Error fetching user matches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family matches'
    });
  }
});

/**
 * @swagger
 * /api/genealogy/ai-research:
 *   post:
 *     summary: Run AI research to find new family matches
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.post('/ai-research', auth, async (req, res) => {
  try {
    // Get user profile data for matching
    const userProfile = {
      firstName: req.user.firstName || req.user.name?.split(' ')[0] || '',
      lastName: req.user.lastName || req.user.name?.split(' ').slice(1).join(' ') || '',
      name: req.user.name || '',
      dateOfBirth: req.user.dateOfBirth,
      placeOfBirth: req.user.placeOfBirth,
      currentLocation: req.user.currentLocation,
      bio: req.user.bio,
      interests: req.user.interests,
      age: req.user.age
    };

    console.log(`🔍 Starting AI research for user: ${req.user._id}`);
    
    // Find potential family matches using AI
    const matches = await genealogyMatchingService.findFamilyMatches(req.user._id, userProfile);
    
    // Process and store the results
    await genealogyMatchingService.processMatchResults(req.user._id, matches);

    res.json({
      success: true,
      data: {
        matchesFound: matches.length,
        highConfidenceMatches: matches.filter(m => m.confidence >= 85).length,
        mediumConfidenceMatches: matches.filter(m => m.confidence >= 70 && m.confidence < 85).length,
        matches: matches.slice(0, 10) // Return top 10 matches
      },
      message: `AI research completed. Found ${matches.length} potential family connections.`
    });

  } catch (error) {
    console.error('Error running AI research:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run AI family research'
    });
  }
});

/**
 * @swagger
 * /api/genealogy/members/{memberId}:
 *   delete:
 *     summary: Delete family member
 *     tags: [Genealogy]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/members/:memberId',
  auth,
  [param('memberId').isMongoId().withMessage('Invalid member ID')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const member = await FamilyMember.findById(req.params.memberId).populate('familyTreeId');
      
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Family member not found'
        });
      }
      
      const access = member.familyTreeId.hasAccess(req.user._id, 'editor');
      if (!access.hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Edit access denied'
        });
      }
      
      // Remove relationships
      await FamilyMember.updateMany(
        { parents: member._id },
        { $pull: { parents: member._id } }
      );
      
      await FamilyMember.updateMany(
        { children: member._id },
        { $pull: { children: member._id } }
      );
      
      await FamilyMember.updateMany(
        { siblings: member._id },
        { $pull: { siblings: member._id } }
      );
      
      await FamilyMember.updateOne(
        { spouse: member._id },
        { $unset: { spouse: 1 } }
      );
      
      await member.deleteOne();
      
      // Update tree stats
      await member.familyTreeId.updateStats();
      
      res.json({
        success: true,
        message: 'Family member deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting family member:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete family member'
      });
    }
  }
);

module.exports = router;