const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

class CleanupService {
  constructor() {
    this.isRunning = false;
    this.lastRun = null;
    this.totalFilesDeleted = 0;
    this.totalStatusesProcessed = 0;
  }

  // Start the cleanup scheduler
  start() {
    // Run cleanup every hour at minute 0
    cron.schedule('0 * * * *', async () => {
      if (!this.isRunning) {
        await this.runCleanup();
      }
    });

    // Run cleanup every 6 hours for orphaned files (more thorough)
    cron.schedule('0 */6 * * *', async () => {
      if (!this.isRunning) {
        await this.runOrphanedFileCleanup();
      }
    });

    // Run initial cleanup on startup (with 30 second delay)
    setTimeout(() => {
      this.runCleanup();
    }, 30000);

    console.log('🕒 [CLEANUP SERVICE] Cleanup scheduler started');
    console.log('🕒 [CLEANUP SERVICE] - Expired statuses: Every hour');
    console.log('🕒 [CLEANUP SERVICE] - Orphaned files: Every 6 hours');
  }

  // Main cleanup function
  async runCleanup() {
    if (this.isRunning) {
      console.log('⚠️ [CLEANUP SERVICE] Cleanup already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();
    
    try {
      console.log('🧹 [CLEANUP SERVICE] Starting scheduled cleanup...');
      
      const Status = require('../models/Status');
      const now = new Date();
      
      // Find statuses with images that have expired
      const expiredStatuses = await Status.find({
        'media.file_path': { $exists: true },
        expires_at: { $lt: now }
      });
      
      let deletedCount = 0;
      let errorCount = 0;
      let dbUpdated = 0;
      
      for (const status of expiredStatuses) {
        if (status.media && status.media.file_path) {
          try {
            // Check if file exists before trying to delete
            await fs.access(status.media.file_path);
            
            // Delete the physical file
            await fs.unlink(status.media.file_path);
            console.log(`🗑️ [CLEANUP SERVICE] Deleted: ${path.basename(status.media.file_path)}`);
            deletedCount++;
            
          } catch (fileError) {
            if (fileError.code !== 'ENOENT') {
              console.log(`⚠️ [CLEANUP SERVICE] Error deleting file: ${fileError.message}`);
              errorCount++;
            }
          }
          
          // Always update database to remove file references
          try {
            status.media.file_path = undefined;
            status.media.image_url = undefined;
            status.media.thumbnail_url = undefined;
            await status.save();
            dbUpdated++;
          } catch (dbError) {
            console.log(`⚠️ [CLEANUP SERVICE] Error updating database: ${dbError.message}`);
          }
        }
      }
      
      const duration = new Date() - startTime;
      this.lastRun = new Date();
      this.totalFilesDeleted += deletedCount;
      this.totalStatusesProcessed += expiredStatuses.length;
      
      console.log(`✅ [CLEANUP SERVICE] Completed in ${duration}ms`);
      console.log(`   - Processed: ${expiredStatuses.length} expired statuses`);
      console.log(`   - Files deleted: ${deletedCount}`);
      console.log(`   - DB records updated: ${dbUpdated}`);
      console.log(`   - Errors: ${errorCount}`);
      
    } catch (error) {
      console.error('❌ [CLEANUP SERVICE] Error during cleanup:', error);
    } finally {
      this.isRunning = false;
    }
  }

  // Clean up orphaned files in temp directory
  async runOrphanedFileCleanup() {
    try {
      console.log('🔍 [CLEANUP SERVICE] Checking for orphaned files...');
      
      const tempDir = path.join(__dirname, '..', 'temp', 'status_images');
      
      // Check if temp directory exists
      try {
        await fs.access(tempDir);
      } catch {
        return; // Directory doesn't exist
      }
      
      const files = await fs.readdir(tempDir);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      let orphanedCount = 0;
      let checkedCount = 0;
      
      for (const filename of files) {
        if (!filename.startsWith('status_')) continue; // Only check status files
        
        const filePath = path.join(tempDir, filename);
        checkedCount++;
        
        try {
          const stats = await fs.stat(filePath);
          
          // If file is older than 24 hours, check if it's still referenced
          if (stats.mtime < twentyFourHoursAgo) {
            const Status = require('../models/Status');
            const referencedStatus = await Status.findOne({ 'media.file_path': filePath });
            
            if (!referencedStatus) {
              // File is orphaned, delete it
              await fs.unlink(filePath);
              console.log(`🗑️ [CLEANUP SERVICE] Deleted orphaned: ${filename}`);
              orphanedCount++;
              this.totalFilesDeleted++;
            }
          }
        } catch (fileError) {
          if (fileError.code !== 'ENOENT') {
            console.log(`⚠️ [CLEANUP SERVICE] Error checking file ${filename}: ${fileError.message}`);
          }
        }
      }
      
      console.log(`🔍 [CLEANUP SERVICE] Orphaned file check complete`);
      console.log(`   - Files checked: ${checkedCount}`);
      console.log(`   - Orphaned files deleted: ${orphanedCount}`);
      
    } catch (error) {
      console.error('❌ [CLEANUP SERVICE] Error during orphaned file cleanup:', error);
    }
  }

  // Get cleanup statistics
  getStats() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      totalFilesDeleted: this.totalFilesDeleted,
      totalStatusesProcessed: this.totalStatusesProcessed
    };
  }

  // Manual cleanup trigger (for testing or admin use)
  async runManualCleanup() {
    console.log('🔧 [CLEANUP SERVICE] Manual cleanup triggered...');
    await this.runCleanup();
    await this.runOrphanedFileCleanup();
    return this.getStats();
  }
}

module.exports = new CleanupService();