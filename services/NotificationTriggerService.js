const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const JobApplication = require('../models/JobApplication');
const Job = require('../models/Job');

class NotificationTriggerService {
  constructor() {
    this.triggers = new Map();
    this.setupTriggers();
  }

  setupTriggers() {
    // Application status changes
    this.registerTrigger('application_status_changed', this.handleApplicationStatusChange.bind(this));

    // Profile views
    this.registerTrigger('profile_viewed', this.handleProfileViewed.bind(this));

    // Job matches
    this.registerTrigger('job_match_found', this.handleJobMatchFound.bind(this));

    // Interview scheduling
    this.registerTrigger('interview_scheduled', this.handleInterviewScheduled.bind(this));

    // Deadline warnings
    this.registerTrigger('deadline_approaching', this.handleDeadlineWarning.bind(this));

    // Document expiry
    this.registerTrigger('document_expiring', this.handleDocumentExpiry.bind(this));

    // Compliance deadlines
    this.registerTrigger('compliance_deadline', this.handleComplianceDeadline.bind(this));

    // Pipeline bottlenecks
    this.registerTrigger('pipeline_bottleneck', this.handlePipelineBottleneck.bind(this));

    // Market insights
    this.registerTrigger('market_insight', this.handleMarketInsight.bind(this));

    // Team collaboration
    this.registerTrigger('team_collaboration', this.handleTeamCollaboration.bind(this));
  }

  registerTrigger(eventType, handler) {
    this.triggers.set(eventType, handler);
  }

  async trigger(eventType, data) {
    const handler = this.triggers.get(eventType);
    if (handler) {
      try {
        await handler(data);
      } catch (error) {
        console.error(`Error handling trigger ${eventType}:`, error);
      }
    }
  }

  async handleApplicationStatusChange({ applicationId, oldStatus, newStatus, changedBy }) {
    const application = await JobApplication.findById(applicationId)
      .populate('candidate')
      .populate('job')
      .populate('assignedTo');

    if (!application) return;

    // Notify candidate of status change
    const candidateNotification = await Notification.createNotification({
      recipient: application.candidate._id,
      recipientType: 'candidate',
      type: 'application_status_update',
      title: `Application Status Updated`,
      message: `Your application for ${application.job.title} has been ${newStatus}`,
      data: {
        applicationId: application._id,
        jobId: application.job._id,
        oldStatus,
        newStatus
      },
      priority: this.getStatusChangePriority(newStatus),
      actionUrl: `/candidate/applications/${application._id}`
    });

    // Notify assigned admin if status changed
    if (application.assignedTo && changedBy !== application.assignedTo._id.toString()) {
      await Notification.createNotification({
        recipient: application.assignedTo._id,
        recipientType: 'admin',
        type: 'application_status_update',
        title: `Application Status Changed`,
        message: `${application.candidate.name}'s application for ${application.job.title} changed from ${oldStatus} to ${newStatus}`,
        data: {
          applicationId: application._id,
          candidateId: application.candidate._id,
          jobId: application.job._id,
          oldStatus,
          newStatus
        },
        priority: 'medium',
        actionUrl: `/admin/applications/${application._id}`
      });
    }

    // Trigger milestone notifications
    await this.checkApplicationMilestones(application.candidate._id);
  }

  async handleProfileViewed({ candidateId, viewedBy, viewerType }) {
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return;

    const viewer = await User.findById(viewedBy);
    if (!viewer) return;

    let notificationType = 'profile_view';
    let title = 'Profile Viewed';
    let message = viewerType === 'admin'
      ? `Your profile was viewed by ${viewer.name || 'a recruiter'}`
      : `Your profile was viewed by a recruiter`;

    if (viewerType === 'admin') {
      notificationType = 'recruiter_profile_view';
      title = 'Recruiter Viewed Your Profile';
      message = `${viewer.name || 'A recruiter'} from our team viewed your profile`;
    }

    await Notification.createNotification({
      recipient: candidateId,
      recipientType: 'candidate',
      type: notificationType,
      title,
      message,
      data: {
        viewedBy: viewedBy,
        viewerType,
        viewerName: viewer.name
      },
      priority: 'low',
      category: 'profile'
    });
  }

  async handleJobMatchFound({ candidateId, jobId, matchScore, matchReasons }) {
    const candidate = await Candidate.findById(candidateId);
    const job = await Job.findById(jobId);

    if (!candidate || !job) return;

    await Notification.createNotification({
      recipient: candidateId,
      recipientType: 'candidate',
      type: 'skill_match_alert',
      title: 'New Job Match Found!',
      message: `${job.title} at ${job.company} matches your skills (${Math.round(matchScore * 100)}% match)`,
      data: {
        jobId,
        matchScore,
        matchReasons,
        company: job.company,
        location: job.location
      },
      priority: 'medium',
      category: 'job',
      actionUrl: `/candidate/jobs/${jobId}`
    });
  }

  async handleInterviewScheduled({ applicationId, interviewDate, interviewType, interviewers }) {
    const application = await JobApplication.findById(applicationId)
      .populate('candidate')
      .populate('job');

    if (!application) return;

    // Notify candidate
    await Notification.createNotification({
      recipient: application.candidate._id,
      recipientType: 'candidate',
      type: 'interview_scheduled',
      title: 'Interview Scheduled',
      message: `You have an ${interviewType} interview scheduled for ${application.job.title} on ${new Date(interviewDate).toLocaleDateString()}`,
      data: {
        applicationId,
        jobId: application.job._id,
        interviewDate,
        interviewType,
        interviewers
      },
      priority: 'high',
      category: 'interview',
      actionUrl: `/candidate/interviews/${applicationId}`
    });

    // Check for conflicts
    await this.checkInterviewConflicts(application.candidate._id, interviewDate);
  }

  async handleDeadlineWarning({ applicationId, daysRemaining }) {
    const application = await JobApplication.findById(applicationId)
      .populate('candidate')
      .populate('job');

    if (!application) return;

    const priority = daysRemaining <= 1 ? 'urgent' : daysRemaining <= 3 ? 'high' : 'medium';

    await Notification.createNotification({
      recipient: application.candidate._id,
      recipientType: 'candidate',
      type: 'deadline_warning',
      title: `Application Deadline Approaching`,
      message: `Your application for ${application.job.title} expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
      data: {
        applicationId,
        jobId: application.job._id,
        daysRemaining
      },
      priority,
      category: 'application',
      actionUrl: `/candidate/applications/${applicationId}`
    });
  }

  async handleDocumentExpiry({ candidateId, documentType, daysUntilExpiry }) {
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return;

    const priority = daysUntilExpiry <= 7 ? 'high' : 'medium';

    await Notification.createNotification({
      recipient: candidateId,
      recipientType: 'candidate',
      type: 'document_expiry_alert',
      title: 'Document Expiring Soon',
      message: `Your ${documentType} expires in ${daysUntilExpiry} days. Please update it to keep your profile current.`,
      data: {
        documentType,
        daysUntilExpiry
      },
      priority,
      category: 'profile',
      actionUrl: '/candidate/profile'
    });
  }

  async handleComplianceDeadline({ adminId, complianceType, daysRemaining, requirement }) {
    await Notification.createNotification({
      recipient: adminId,
      recipientType: 'admin',
      type: 'compliance_requirement_alert',
      title: 'Compliance Deadline Approaching',
      message: `${complianceType} compliance requirement due in ${daysRemaining} days`,
      data: {
        complianceType,
        daysRemaining,
        requirement
      },
      priority: daysRemaining <= 7 ? 'urgent' : 'high',
      category: 'compliance',
      actionUrl: '/admin/compliance'
    });
  }

  async handlePipelineBottleneck({ adminId, stage, bottleneckData }) {
    await Notification.createNotification({
      recipient: adminId,
      recipientType: 'admin',
      type: 'pipeline_bottleneck_alert',
      title: 'Pipeline Bottleneck Detected',
      message: `Applications are stalling at the ${stage} stage. ${bottleneckData.applicationCount} applications need attention.`,
      data: {
        stage,
        ...bottleneckData
      },
      priority: 'high',
      category: 'performance',
      actionUrl: '/admin/analytics/pipeline'
    });
  }

  async handleMarketInsight({ recipientId, recipientType, insightType, insightData }) {
    const title = insightType === 'salary_trend' ? 'Salary Trend Alert' :
                 insightType === 'demand_shift' ? 'Market Demand Shift' : 'Market Insight';

    await Notification.createNotification({
      recipient: recipientId,
      recipientType,
      type: 'market_trend_insight',
      title,
      message: insightData.message,
      data: {
        insightType,
        ...insightData
      },
      priority: 'low',
      category: 'market',
      scheduledFor: this.getOptimalDeliveryTime(recipientType)
    });
  }

  async handleTeamCollaboration({ recipientId, senderId, actionType, resourceData }) {
    const sender = await User.findById(senderId);
    if (!sender) return;

    let title, message, actionUrl;

    switch (actionType) {
      case 'comment_added':
        title = 'New Comment Added';
        message = `${sender.name} commented on ${resourceData.resourceType}`;
        actionUrl = resourceData.resourceUrl;
        break;
      case 'candidate_shared':
        title = 'Candidate Shared With You';
        message = `${sender.name} shared a candidate profile with your team`;
        actionUrl = `/admin/candidates/${resourceData.candidateId}`;
        break;
      case 'task_assigned':
        title = 'New Task Assigned';
        message = `${sender.name} assigned you a task: ${resourceData.taskTitle}`;
        actionUrl = `/admin/tasks/${resourceData.taskId}`;
        break;
      default:
        return;
    }

    await Notification.createNotification({
      recipient: recipientId,
      recipientType: 'admin',
      type: 'team_task_assignment',
      title,
      message,
      data: {
        senderId,
        senderName: sender.name,
        actionType,
        ...resourceData
      },
      priority: 'medium',
      category: 'team',
      actionUrl
    });
  }

  // Helper methods
  getStatusChangePriority(status) {
    const urgentStatuses = ['accepted', 'rejected', 'interview_scheduled'];
    const highStatuses = ['under_review', 'shortlisted'];
    const mediumStatuses = ['submitted', 'in_progress'];

    if (urgentStatuses.includes(status)) return 'urgent';
    if (highStatuses.includes(status)) return 'high';
    if (mediumStatuses.includes(status)) return 'medium';
    return 'low';
  }

  async checkApplicationMilestones(candidateId) {
    const applicationCount = await JobApplication.countDocuments({ candidate: candidateId });

    // Milestone notifications
    const milestones = [10, 25, 50, 100];
    const reachedMilestone = milestones.find(milestone => applicationCount === milestone);

    if (reachedMilestone) {
      await Notification.createNotification({
        recipient: candidateId,
        recipientType: 'candidate',
        type: 'application_milestone',
        title: 'Application Milestone Reached! 🎉',
        message: `Congratulations! You've submitted ${reachedMilestone} applications. Keep up the great work!`,
        data: {
          milestone: reachedMilestone,
          totalApplications: applicationCount
        },
        priority: 'low',
        category: 'application'
      });
    }
  }

  async checkInterviewConflicts(candidateId, interviewDate) {
    // Check for conflicting interviews within 2 hours
    const twoHoursBefore = new Date(interviewDate.getTime() - 2 * 60 * 60 * 1000);
    const twoHoursAfter = new Date(interviewDate.getTime() + 2 * 60 * 60 * 1000);

    const conflictingApplications = await JobApplication.find({
      candidate: candidateId,
      interviewDate: {
        $gte: twoHoursBefore,
        $lte: twoHoursAfter
      }
    }).populate('job');

    if (conflictingApplications.length > 1) {
      await Notification.createNotification({
        recipient: candidateId,
        recipientType: 'candidate',
        type: 'interview_conflict_detection',
        title: 'Interview Conflict Detected',
        message: `You have multiple interviews scheduled around ${interviewDate.toLocaleString()}. Please check your calendar.`,
        data: {
          interviewDate,
          conflictingInterviews: conflictingApplications.map(app => ({
            jobTitle: app.job.title,
            company: app.job.company,
            interviewDate: app.interviewDate
          }))
        },
        priority: 'high',
        category: 'interview',
        actionUrl: '/candidate/interviews'
      });
    }
  }

  getOptimalDeliveryTime(recipientType) {
    // Schedule market insights for off-peak hours
    const now = new Date();
    if (recipientType === 'candidate') {
      // Evening for candidates
      const evening = new Date(now);
      evening.setHours(18, 0, 0, 0);
      if (evening > now) return evening;
      // Next day if already past evening
      evening.setDate(evening.getDate() + 1);
      return evening;
    } else {
      // Morning for admins
      const morning = new Date(now);
      morning.setHours(9, 0, 0, 0);
      if (morning > now) return morning;
      // Next day if already past morning
      morning.setDate(morning.getDate() + 1);
      return morning;
    }
  }

  // Public method to manually trigger notifications
  async triggerCustomNotification(data) {
    const {
      recipient,
      recipientType,
      type,
      title,
      message,
      priority = 'medium',
      category,
      data: notificationData,
      actionUrl,
      scheduledFor
    } = data;

    // Check user preferences before creating
    const preferences = await NotificationPreferences.findOne({
      user: recipient,
      userType: recipientType
    });

    if (preferences && !preferences.shouldDeliverNotification({ type, category, priority })) {
      return null; // User has disabled this type of notification
    }

    return await Notification.createNotification({
      recipient,
      recipientType,
      type,
      title,
      message,
      data: notificationData,
      priority,
      category,
      actionUrl,
      scheduledFor
    });
  }
}

module.exports = new NotificationTriggerService();