const {
  cloudinary,
  deleteFromCloudinary,
  getOptimizedImageUrl,
  uploadBase64Image,
  uploadFromUrl,
  generateVideoThumbnail
} = require('../config/cloudinary');

class CloudinaryService {
  constructor() {
    this.cloudinary = cloudinary;
  }

  /**
   * Process uploaded file and return standardized response
   */
  processUploadedFile(file) {
    if (!file) return null;

    // For Cloudinary uploads via multer-storage-cloudinary
    if (file.path) {
      return {
        url: file.path, // Cloudinary URL
        publicId: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        format: file.format || this.getFileExtension(file.originalname),
        resourceType: this.getResourceType(file.mimetype),
        thumbnail: this.generateThumbnail(file.path, file.mimetype)
      };
    }

    // For direct Cloudinary uploads
    return {
      url: file.secure_url || file.url,
      publicId: file.public_id || file.publicId,
      originalName: file.original_filename || file.originalName,
      mimeType: file.resource_type || file.mimeType,
      size: file.bytes || file.size,
      format: file.format,
      width: file.width,
      height: file.height,
      resourceType: file.resource_type,
      thumbnail: this.generateThumbnail(file.secure_url || file.url, file.resource_type)
    };
  }

  /**
   * Upload multiple files
   */
  async uploadMultiple(files) {
    if (!files || files.length === 0) return [];
    
    const uploadPromises = files.map(file => this.processUploadedFile(file));
    return Promise.all(uploadPromises);
  }

  /**
   * Upload profile photo with optimization
   */
  async uploadProfilePhoto(file, userId) {
    try {
      const processed = this.processUploadedFile(file);
      
      // Generate multiple sizes for responsive display
      const sizes = {
        thumbnail: this.getOptimizedUrl(processed.publicId, { width: 150, height: 150, crop: 'fill' }),
        small: this.getOptimizedUrl(processed.publicId, { width: 300, height: 300, crop: 'fill' }),
        medium: this.getOptimizedUrl(processed.publicId, { width: 500, height: 500, crop: 'fill' }),
        large: processed.url
      };

      return {
        ...processed,
        sizes,
        userId
      };
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      throw error;
    }
  }

  /**
   * Upload chat media with appropriate processing
   */
  async uploadChatMedia(file, chatId, senderId) {
    try {
      const processed = this.processUploadedFile(file);
      
      // Add chat-specific metadata
      processed.chatId = chatId;
      processed.senderId = senderId;
      processed.uploadedAt = new Date();

      // Generate preview for videos
      if (processed.resourceType === 'video') {
        processed.thumbnail = generateVideoThumbnail(processed.publicId);
      }

      return processed;
    } catch (error) {
      console.error('Error uploading chat media:', error);
      throw error;
    }
  }

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(publicId, resourceType = 'image') {
    try {
      const result = await deleteFromCloudinary(publicId, resourceType);
      return result.result === 'ok';
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Delete multiple files
   */
  async deleteMultiple(publicIds, resourceType = 'image') {
    try {
      const deletePromises = publicIds.map(id => this.deleteFile(id, resourceType));
      const results = await Promise.all(deletePromises);
      return results.every(result => result === true);
    } catch (error) {
      console.error('Error deleting multiple files:', error);
      return false;
    }
  }

  /**
   * Get optimized URL for an image
   */
  getOptimizedUrl(publicId, options = {}) {
    return getOptimizedImageUrl(publicId, options);
  }

  /**
   * Upload from base64 string
   */
  async uploadBase64(base64String, folder = 'misc', metadata = {}) {
    try {
      const result = await uploadBase64Image(base64String, folder);
      return {
        ...result,
        ...metadata
      };
    } catch (error) {
      console.error('Error uploading base64:', error);
      throw error;
    }
  }

  /**
   * Upload from external URL
   */
  async uploadFromUrl(url, folder = 'misc', metadata = {}) {
    try {
      const result = await uploadFromUrl(url, folder);
      return {
        ...result,
        ...metadata
      };
    } catch (error) {
      console.error('Error uploading from URL:', error);
      throw error;
    }
  }

  /**
   * Generate thumbnail URL based on file type
   */
  generateThumbnail(url, mimeType) {
    if (!url) return null;

    if (mimeType && mimeType.startsWith('video')) {
      // For videos, extract public ID and generate thumbnail
      const publicId = this.extractPublicId(url);
      if (publicId) {
        return generateVideoThumbnail(publicId);
      }
    }

    if (mimeType && mimeType.startsWith('image')) {
      // For images, return optimized thumbnail version
      const publicId = this.extractPublicId(url);
      if (publicId) {
        return this.getOptimizedUrl(publicId, { width: 200, height: 200, crop: 'fill' });
      }
    }

    return url; // Return original URL if can't generate thumbnail
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  extractPublicId(url) {
    if (!url) return null;
    
    // Extract public_id from Cloudinary URL
    const regex = /\/v\d+\/(.+)\.\w+$/;
    const match = url.match(regex);
    
    if (match && match[1]) {
      return match[1];
    }
    
    // Try alternative pattern
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1];
    const publicId = lastPart.split('.')[0];
    
    return publicId;
  }

  /**
   * Get resource type from MIME type
   */
  getResourceType(mimeType) {
    if (!mimeType) return 'raw';
    
    if (mimeType.startsWith('image')) return 'image';
    if (mimeType.startsWith('video')) return 'video';
    if (mimeType.startsWith('audio')) return 'video'; // Cloudinary treats audio as video
    return 'raw';
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename) {
    if (!filename) return '';
    const parts = filename.split('.');
    return parts[parts.length - 1].toLowerCase();
  }

  /**
   * Validate file before upload
   */
  validateFile(file, options = {}) {
    const {
      maxSize = 100 * 1024 * 1024, // 100MB default
      allowedTypes = [],
      allowedExtensions = []
    } = options;

    // Check file size
    if (file.size > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    // Check extension
    if (allowedExtensions.length > 0) {
      const ext = this.getFileExtension(file.originalname);
      if (!allowedExtensions.includes(ext)) {
        throw new Error(`File extension .${ext} is not allowed`);
      }
    }

    return true;
  }

  /**
   * Get upload statistics for a user
   */
  async getUserUploadStats(userId) {
    try {
      // This would typically query your database for user's uploaded files
      // For now, returning a placeholder
      return {
        totalFiles: 0,
        totalSize: 0,
        imageCount: 0,
        videoCount: 0,
        documentCount: 0
      };
    } catch (error) {
      console.error('Error getting upload stats:', error);
      return null;
    }
  }

  /**
   * Clean up old/unused files
   */
  async cleanupOldFiles(daysOld = 30) {
    try {
      // This would typically:
      // 1. Query database for files older than X days
      // 2. Check if they're still referenced
      // 3. Delete from Cloudinary if not referenced
      
      console.log(`Cleanup task: Would delete files older than ${daysOld} days`);
      return true;
    } catch (error) {
      console.error('Error cleaning up old files:', error);
      return false;
    }
  }
}

// Create singleton instance
const cloudinaryService = new CloudinaryService();

module.exports = cloudinaryService;