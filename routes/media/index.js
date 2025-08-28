const { supabase } = require('../../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads', file.fieldname === 'image' ? 'images' : 
                                 file.fieldname === 'audio' ? 'audio' : 
                                 file.fieldname === 'video' ? 'videos' : 'documents');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedAudioTypes = /mp3|wav|m4a|aac/;
  const allowedVideoTypes = /mp4|mov|avi|webm/;
  
  const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  allowedAudioTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  allowedVideoTypes.test(path.extname(file.originalname).toLowerCase());
  
  const mimetype = file.mimetype.startsWith('image/') || 
                   file.mimetype.startsWith('audio/') || 
                   file.mimetype.startsWith('video/');

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Unsupported file type'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter
});

// ============================================
// FILE UPLOAD HANDLERS
// ============================================

// Upload image
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const { folder = 'general' } = req.body;
    const userId = req.userId;

    // Get file info
    const fileStats = await fs.stat(req.file.path);
    const fileUrl = `/uploads/images/${req.file.filename}`;

    // Save to database
    const { data: mediaFile, error } = await supabase
      .from('media_files')
      .insert([{
        uploader_id: userId,
        filename: req.file.filename,
        original_name: req.file.originalname,
        file_type: 'image',
        mime_type: req.file.mimetype,
        file_size: fileStats.size,
        file_url: fileUrl,
        usage_context: folder,
        reference_id: req.body.reference_id || null,
        is_active: true,
        is_processed: true
      }])
      .select()
      .single();

    if (error) throw error;

    // If it's a profile image, update user's profile
    if (folder === 'profiles') {
      await supabase
        .from('users')
        .update({ profile_picture_url: fileUrl })
        .eq('id', userId);
    }

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      data: mediaFile
    });

  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload image'
    });
  }
};

// Upload audio
const uploadAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file provided'
      });
    }

    const { folder = 'general' } = req.body;
    const userId = req.userId;

    // Get file info
    const fileStats = await fs.stat(req.file.path);
    const fileUrl = `/uploads/audio/${req.file.filename}`;

    // Save to database
    const { data: mediaFile, error } = await supabase
      .from('media_files')
      .insert([{
        uploader_id: userId,
        filename: req.file.filename,
        original_name: req.file.originalname,
        file_type: 'audio',
        mime_type: req.file.mimetype,
        file_size: fileStats.size,
        file_url: fileUrl,
        usage_context: folder,
        reference_id: req.body.reference_id || null,
        is_active: true,
        is_processed: true
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Audio uploaded successfully',
      data: mediaFile
    });

  } catch (error) {
    console.error('Upload audio error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload audio'
    });
  }
};

// Upload video
const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file provided'
      });
    }

    const { folder = 'general' } = req.body;
    const userId = req.userId;

    // Get file info
    const fileStats = await fs.stat(req.file.path);
    const fileUrl = `/uploads/videos/${req.file.filename}`;

    // Save to database
    const { data: mediaFile, error } = await supabase
      .from('media_files')
      .insert([{
        uploader_id: userId,
        filename: req.file.filename,
        original_name: req.file.originalname,
        file_type: 'video',
        mime_type: req.file.mimetype,
        file_size: fileStats.size,
        file_url: fileUrl,
        usage_context: folder,
        reference_id: req.body.reference_id || null,
        is_active: true,
        is_processed: true
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      data: mediaFile
    });

  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload video'
    });
  }
};

// ============================================
// FILE MANAGEMENT
// ============================================

// Get user's media files
const getUserMediaFiles = async (req, res) => {
  try {
    const { type, context, limit = 50 } = req.query;
    const userId = req.userId;

    let query = supabase
      .from('media_files')
      .select('*')
      .eq('uploader_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (type) {
      query = query.eq('file_type', type);
    }

    if (context) {
      query = query.eq('usage_context', context);
    }

    const { data: mediaFiles, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: mediaFiles || []
    });

  } catch (error) {
    console.error('Get user media files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media files'
    });
  }
};

// Delete media file
const deleteMediaFile = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const userId = req.userId;

    // Get media file info
    const { data: mediaFile, error: fetchError } = await supabase
      .from('media_files')
      .select('*')
      .eq('id', mediaId)
      .eq('uploader_id', userId)
      .single();

    if (fetchError || !mediaFile) {
      return res.status(404).json({
        success: false,
        message: 'Media file not found'
      });
    }

    // Delete physical file
    const filePath = path.join(__dirname, '../../uploads', 
      mediaFile.file_type === 'image' ? 'images' : 
      mediaFile.file_type === 'audio' ? 'audio' : 'videos', 
      mediaFile.filename);

    try {
      await fs.unlink(filePath);
    } catch (fileError) {
      console.warn('Could not delete physical file:', fileError.message);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('media_files')
      .delete()
      .eq('id', mediaId);

    if (deleteError) throw deleteError;

    res.json({
      success: true,
      message: 'Media file deleted successfully'
    });

  } catch (error) {
    console.error('Delete media file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media file'
    });
  }
};

// Get media file info
const getMediaFileInfo = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const { data: mediaFile, error } = await supabase
      .from('media_files')
      .select(`
        *,
        uploader:uploader_id (id, first_name, last_name, profile_picture_url)
      `)
      .eq('id', mediaId)
      .eq('is_active', true)
      .single();

    if (error || !mediaFile) {
      return res.status(404).json({
        success: false,
        message: 'Media file not found'
      });
    }

    res.json({
      success: true,
      data: mediaFile
    });

  } catch (error) {
    console.error('Get media file info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media file info'
    });
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get file statistics
const getFileStats = async (req, res) => {
  try {
    const userId = req.userId;

    const { data: stats, error } = await supabase
      .from('media_files')
      .select('file_type, file_size')
      .eq('uploader_id', userId)
      .eq('is_active', true);

    if (error) throw error;

    // Calculate statistics
    const fileStats = {
      totalFiles: stats.length,
      totalSize: stats.reduce((sum, file) => sum + (file.file_size || 0), 0),
      byType: {
        image: stats.filter(f => f.file_type === 'image').length,
        audio: stats.filter(f => f.file_type === 'audio').length,
        video: stats.filter(f => f.file_type === 'video').length
      }
    };

    res.json({
      success: true,
      data: fileStats
    });

  } catch (error) {
    console.error('Get file stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file statistics'
    });
  }
};

module.exports = {
  upload,
  uploadImage,
  uploadAudio,
  uploadVideo,
  getUserMediaFiles,
  deleteMediaFile,
  getMediaFileInfo,
  getFileStats
};