const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const upload = require('../../config/multer');
const FamilyTree = require('../../models/FamilyTree');
const FamilyMember = require('../../models/FamilyMember');
const cloudinary = require('cloudinary').v2;
const { body, validationResult, param } = require('express-validator');

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
  // auth, // Temporarily disabled for testing - REMEMBER TO RE-ENABLE
  upload.single('photo'),
  [
    param('treeId').isMongoId().withMessage('Invalid tree ID'),
    body('firstName').trim().isLength({ min: 1, max: 100 }).withMessage('First name is required'),
    body('lastName').trim().isLength({ min: 1, max: 100 }).withMessage('Last name is required'),
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
      
      // Skip access check when auth is disabled for testing
      if (req.user) {
        const access = tree.hasAccess(req.user._id, 'editor');
        if (!access.hasAccess) {
          return res.status(403).json({
            success: false,
            message: 'Edit access denied'
          });
        }
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
        // Use dummy user ID when auth is disabled for testing
        userId: req.user ? req.user._id : '507f1f77bcf86cd799439011',
        createdBy: req.user ? req.user._id : '507f1f77bcf86cd799439011'
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