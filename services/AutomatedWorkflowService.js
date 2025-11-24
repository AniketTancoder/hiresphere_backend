const NotificationTriggerService = require('./NotificationTriggerService');
const JobApplication = require('../models/JobApplication');
const Job = require('../models/Job');
const User = require('../models/User');
const Candidate = require('../models/Candidate');

class AutomatedWorkflowService {
  constructor() {
    this.scheduledTasks = new Map();
    this.setupAutomatedWorkflows();
  }

  setupAutomatedWorkflows() {
    this.scheduleRecurringTask('checkDeadlineWarnings', 60 * 60 * 1000);
    this.scheduleRecurringTask('checkDocumentExpiries', 24 * 60 * 60 * 1000);
    this.scheduleRecurringTask('checkComplianceDeadlines', 24 * 60 * 60 * 1000);
    this.scheduleRecurringTask('checkPipelineBottlenecks', 4 * 60 * 60 * 1000);
    this.scheduleRecurringTask('sendDigestNotifications', 24 * 60 * 60 * 1000);
  }

  scheduleRecurringTask(taskName, intervalMs) {
    const task = () => {
      this[taskName]().catch(error => {
        console.error(`Error in automated task ${taskName}:`, error);
      });
    };

    task();
    setInterval(task, intervalMs);
  }

  async checkDeadlineWarnings() {
    try {
      const warningThresholds = [1, 3, 7];
      const now = new Date();

      for (const days of warningThresholds) {
        const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        const expiringJobs = await Job.find({
          applicationDeadline: {
            $gte: now,
            $lte: futureDate
          },
          status: 'active'
        });

        for (const job of expiringJobs) {
          const applications = await JobApplication.find({
            job: job._id,
            status: { $in: ['submitted', 'under_review'] }
          }).populate('candidate');

          for (const application of applications) {
            await NotificationTriggerService.trigger('deadline_warning', {
              applicationId: application._id,
              daysRemaining: days
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking deadline warnings:', error);
    }
  }

  async checkDocumentExpiries() {
    try {
      const candidates = await Candidate.find({
        $or: [
          { resumeExpiry: { $exists: true } },
          { visaExpiry: { $exists: true } },
          { certificationExpiry: { $exists: true } }
        ]
      });

      const now = new Date();
      const warningDays = [30, 7, 1];

      for (const candidate of candidates) {
        const expiryChecks = [
          { field: 'resumeExpiry', type: 'resume' },
          { field: 'visaExpiry', type: 'visa' },
          { field: 'certificationExpiry', type: 'certification' }
        ];

        for (const check of expiryChecks) {
          if (candidate[check.field]) {
            const expiryDate = new Date(candidate[check.field]);
            const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

            if (warningDays.includes(daysUntilExpiry)) {
              await NotificationTriggerService.trigger('document_expiry_alert', {
                candidateId: candidate._id,
                documentType: check.type,
                daysUntilExpiry
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking document expiries:', error);
    }
  }

  async checkComplianceDeadlines() {
    try {
      const complianceDeadlines = [
        { type: 'EEO_REPORTING', daysRemaining: 30, requirement: 'Equal Employment Opportunity reporting due' },
        { type: 'DIVERSITY_REPORTING', daysRemaining: 15, requirement: 'Diversity and inclusion metrics reporting' },
        { type: 'AUDIT_PREPARATION', daysRemaining: 60, requirement: 'Annual compliance audit preparation' }
      ];

      const admins = await User.find({ role: { $in: ['admin', 'recruiter'] } });

      for (const admin of admins) {
        for (const deadline of complianceDeadlines) {
          await NotificationTriggerService.trigger('compliance_deadline', {
            adminId: admin._id,
            complianceType: deadline.type,
            daysRemaining: deadline.daysRemaining,
            requirement: deadline.requirement
          });
        }
      }
    } catch (error) {
      console.error('Error checking compliance deadlines:', error);
    }
  }

  async checkPipelineBottlenecks() {
    try {
      const pipelineStages = ['submitted', 'under_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'offered'];

      for (const stage of pipelineStages) {
        const stuckApplications = await JobApplication.find({
          status: stage,
          updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).populate('job').populate('assignedTo');

        if (stuckApplications.length > 5) {
          const assignedAdmins = [...new Set(stuckApplications.map(app => app.assignedTo).filter(Boolean))];

          for (const admin of assignedAdmins) {
            await NotificationTriggerService.trigger('pipeline_bottleneck', {
              adminId: admin._id,
              stage,
              bottleneckData: {
                applicationCount: stuckApplications.length,
                affectedJobs: [...new Set(stuckApplications.map(app => app.job.title))],
                averageStuckTime: this.calculateAverageStuckTime(stuckApplications)
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking pipeline bottlenecks:', error);
    }
  }

  async sendDigestNotifications() {
    try {
      const usersWithDigests = await this.getUsersWithDigestPreferences();

      for (const user of usersWithDigests) {
        const digestData = await this.generateDigest(user);

        if (digestData.totalNotifications > 0) {
          await NotificationTriggerService.triggerCustomNotification({
            recipient: user._id,
            recipientType: user.type,
            type: 'system',
            title: 'Daily Notification Digest',
            message: `You have ${digestData.totalNotifications} new notifications from the past 24 hours`,
            data: digestData,
            priority: 'low',
            category: 'system'
          });
        }
      }
    } catch (error) {
      console.error('Error sending digest notifications:', error);
    }
  }

  async handleInterviewNoShow(interviewId, candidateId) {
    try {
      const alternativeSlots = await this.findAlternativeInterviewSlots(interviewId);

      if (alternativeSlots.length > 0) {
        await NotificationTriggerService.trigger('interview_no_show_reschedule', {
          recipientId: candidateId,
          recipientType: 'candidate',
          interviewId,
          alternativeSlots
        });
      }
    } catch (error) {
      console.error('Error handling interview no-show:', error);
    }
  }

  async scheduleOfferExpiryReminders(offerId, candidateId, expiryDate) {
    try {
      const now = new Date();
      const expiryTime = new Date(expiryDate);
      const reminderTimes = [
        24 * 60 * 60 * 1000,
        2 * 60 * 60 * 1000,
        30 * 60 * 1000
      ];

      for (const reminderTime of reminderTimes) {
        const reminderDate = new Date(expiryTime.getTime() - reminderTime);

        if (reminderDate > now) {
          setTimeout(async () => {
            await NotificationTriggerService.trigger('offer_expiry_reminder', {
              recipientId: candidateId,
              recipientType: 'candidate',
              offerId,
              hoursRemaining: reminderTime / (60 * 60 * 1000)
            });
          }, reminderDate - now);
        }
      }
    } catch (error) {
      console.error('Error scheduling offer expiry reminders:', error);
    }
  }

  async updateOnboardingChecklist(candidateId, checklistItem) {
    try {
      await NotificationTriggerService.trigger('onboarding_checklist_update', {
        recipientId: candidateId,
        recipientType: 'candidate',
        checklistItem,
        completedItems: await this.getCompletedChecklistItems(candidateId),
        totalItems: await this.getTotalChecklistItems()
      });
    } catch (error) {
      console.error('Error updating onboarding checklist:', error);
    }
  }

  calculateAverageStuckTime(applications) {
    const now = Date.now();
    const stuckTimes = applications.map(app =>
      (now - new Date(app.updatedAt)) / (1000 * 60 * 60 * 24)
    );

    return stuckTimes.reduce((a, b) => a + b, 0) / stuckTimes.length;
  }

  async getUsersWithDigestPreferences() {
    const users = await User.find({ role: { $in: ['admin', 'candidate'] } });
    return users.map(user => ({
      _id: user._id,
      type: user.role === 'admin' ? 'admin' : 'candidate'
    }));
  }

  async generateDigest(user) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const notifications = await require('../models/Notification').find({
      recipient: user._id,
      recipientType: user.type,
      createdAt: { $gte: yesterday }
    });

    const categoryBreakdown = notifications.reduce((acc, notif) => {
      acc[notif.category] = (acc[notif.category] || 0) + 1;
      return acc;
    }, {});

    return {
      totalNotifications: notifications.length,
      categoryBreakdown,
      topCategories: Object.entries(categoryBreakdown)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([category, count]) => ({ category, count }))
    };
  }

  async findAlternativeInterviewSlots(interviewId) {
    return [
      { date: '2024-12-01', time: '10:00 AM', interviewer: 'John Smith' },
      { date: '2024-12-01', time: '2:00 PM', interviewer: 'Jane Doe' },
      { date: '2024-12-02', time: '11:00 AM', interviewer: 'Bob Johnson' }
    ];
  }

  async getCompletedChecklistItems(candidateId) {
    return ['profile_completed', 'documents_uploaded'];
  }

  async getTotalChecklistItems() {
    return ['profile_completed', 'documents_uploaded', 'background_check', 'drug_test', 'reference_check'];
  }

  async triggerWorkflowEvent(eventType, data) {
    switch (eventType) {
      case 'application_submitted':
        await this.handleApplicationSubmitted(data);
        break;
      case 'interview_completed':
        await this.handleInterviewCompleted(data);
        break;
      case 'offer_accepted':
        await this.handleOfferAccepted(data);
        break;
      case 'candidate_onboarded':
        await this.handleCandidateOnboarded(data);
        break;
      default:
        console.log(`Unknown workflow event: ${eventType}`);
    }
  }

  async handleApplicationSubmitted({ applicationId }) {
    const application = await JobApplication.findById(applicationId).populate('job');
    if (application && application.job.applicationDeadline) {
    }
  }

  async handleInterviewCompleted({ interviewId, candidateId, feedback }) {
    if (feedback.overallRating >= 4) {
      await NotificationTriggerService.trigger('interview_feedback_positive', {
        recipientId: candidateId,
        recipientType: 'candidate',
        interviewId,
        feedback: feedback.comments
      });
    }
  }

  async handleOfferAccepted({ offerId, candidateId, startDate }) {
    const onboardingTasks = [
      { task: 'complete_paperwork', delay: 24 * 60 * 60 * 1000 },
      { task: 'schedule_orientation', delay: 3 * 24 * 60 * 60 * 1000 },
      { task: 'setup_workstation', delay: 5 * 24 * 60 * 60 * 1000 }
    ];

    for (const task of onboardingTasks) {
      setTimeout(async () => {
        await NotificationTriggerService.trigger('onboarding_reminder', {
          recipientId: candidateId,
          recipientType: 'candidate',
          task: task.task,
          startDate
        });
      }, task.delay);
    }
  }

  async handleCandidateOnboarded({ candidateId }) {
    await NotificationTriggerService.trigger('welcome_onboard', {
      recipientId: candidateId,
      recipientType: 'candidate'
    });
  }
}

module.exports = new AutomatedWorkflowService();