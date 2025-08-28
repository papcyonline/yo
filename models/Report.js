const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reported: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'spam',
      'harassment',
      'inappropriate_content',
      'fake_profile',
      'scam',
      'hate_speech',
      'violence',
      'nudity',
      'underage',
      'impersonation',
      'other'
    ],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  evidence: [{
    type: {
      type: String,
      enum: ['screenshot', 'message', 'profile', 'other'],
      required: true
    },
    content: {
      type: String, // Could be URL for screenshot or text for message
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'dismissed', 'escalated'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin who reviewed
  },
  reviewNotes: {
    type: String,
    maxlength: 1000
  },
  actionTaken: {
    type: String,
    enum: [
      'no_action',
      'warning_sent',
      'content_removed',
      'temporary_suspension',
      'permanent_ban',
      'profile_review',
      'escalated_to_legal'
    ]
  },
  reviewedAt: {
    type: Date
  },
  // Auto-escalation for serious reports
  autoEscalated: {
    type: Boolean,
    default: false
  },
  // Track if this led to automatic actions
  triggeredActions: [{
    action: String,
    timestamp: { type: Date, default: Date.now },
    reason: String
  }]
}, {
  timestamps: true
});

// Indexes for performance
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ reported: 1, createdAt: -1 });
reportSchema.index({ status: 1, priority: 1, createdAt: -1 });
reportSchema.index({ type: 1, createdAt: -1 });

// Compound index for checking duplicate reports
reportSchema.index({ reporter: 1, reported: 1, type: 1 });

// Post-save middleware for auto-actions
reportSchema.post('save', async function(doc, next) {
  try {
    // Check if this is a new report (not an update)
    if (doc.isNew || doc.isModified('status')) {
      await doc.constructor.checkForAutoActions(doc.reported);
    }
    next();
  } catch (error) {
    console.error('Error in report post-save middleware:', error);
    next();
  }
});

// Static methods
reportSchema.statics.checkForAutoActions = async function(reportedUserId) {
  try {
    // Count pending reports for this user in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const reportCounts = await this.aggregate([
      {
        $match: {
          reported: reportedUserId,
          status: { $in: ['pending', 'under_review'] },
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalCount: { $sum: 1 }
        }
      }
    ]);

    const totalReports = reportCounts.reduce((sum, item) => sum + item.count, 0);
    const User = require('./User');

    // Auto-suspend for serious offenses
    const seriousTypes = ['harassment', 'hate_speech', 'violence', 'underage'];
    const seriousReports = reportCounts.filter(r => seriousTypes.includes(r._id));
    const seriousCount = seriousReports.reduce((sum, item) => sum + item.count, 0);

    if (seriousCount >= 2) {
      // Immediate suspension for serious reports
      await User.findByIdAndUpdate(reportedUserId, {
        suspended: true,
        suspendedAt: new Date(),
        suspendReason: `Multiple serious reports (${seriousCount})`,
        suspendedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      // Update all related reports
      await this.updateMany(
        { reported: reportedUserId, status: 'pending' },
        {
          status: 'escalated',
          priority: 'urgent',
          autoEscalated: true,
          $push: {
            triggeredActions: {
              action: 'auto_suspension',
              reason: `Auto-suspended due to ${seriousCount} serious reports`,
              timestamp: new Date()
            }
          }
        }
      );

      console.log(`⚠️ Auto-suspended user ${reportedUserId} due to ${seriousCount} serious reports`);
    } else if (totalReports >= 5) {
      // Flag for review with 5+ reports
      await User.findByIdAndUpdate(reportedUserId, {
        flaggedForReview: true,
        flaggedAt: new Date(),
        flagReason: `Multiple reports (${totalReports})`
      });

      // Update reports to under review
      await this.updateMany(
        { reported: reportedUserId, status: 'pending' },
        {
          status: 'under_review',
          priority: 'high',
          $push: {
            triggeredActions: {
              action: 'flagged_for_review',
              reason: `Auto-flagged due to ${totalReports} reports`,
              timestamp: new Date()
            }
          }
        }
      );

      console.log(`🚩 Flagged user ${reportedUserId} for review due to ${totalReports} reports`);
    }

  } catch (error) {
    console.error('Error in checkForAutoActions:', error);
  }
};

reportSchema.statics.getReportStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { reported: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  return stats.reduce((acc, stat) => {
    acc[stat._id] = stat.count;
    return acc;
  }, {});
};

reportSchema.statics.createReport = async function(reportData) {
  const { reporterId, reportedId, type, description, evidence = [] } = reportData;

  // Check if user already reported this person for the same reason in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const existingReport = await this.findOne({
    reporter: reporterId,
    reported: reportedId,
    type,
    createdAt: { $gte: sevenDaysAgo }
  });

  if (existingReport) {
    throw new Error('You have already reported this user for this reason recently');
  }

  // Set priority based on type
  let priority = 'medium';
  const highPriorityTypes = ['harassment', 'hate_speech', 'violence', 'underage'];
  const urgentTypes = ['violence', 'underage'];

  if (urgentTypes.includes(type)) {
    priority = 'urgent';
  } else if (highPriorityTypes.includes(type)) {
    priority = 'high';
  }

  return await this.create({
    reporter: reporterId,
    reported: reportedId,
    type,
    description,
    evidence,
    priority
  });
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;