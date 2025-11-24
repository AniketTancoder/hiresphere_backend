const axios = require('axios');
const NotificationTriggerService = require('./NotificationTriggerService');

class ExternalIntegrationService {
  constructor() {
    this.integrations = new Map();
    this.setupIntegrations();
  }

  setupIntegrations() {
    this.registerIntegration('google_calendar', this.googleCalendarIntegration.bind(this));
    this.registerIntegration('outlook_calendar', this.outlookCalendarIntegration.bind(this));
    this.registerIntegration('gmail', this.gmailIntegration.bind(this));
    this.registerIntegration('outlook_email', this.outlookEmailIntegration.bind(this));
    this.registerIntegration('workday', this.workdayIntegration.bind(this));
    this.registerIntegration('bamboohr', this.bamboohrIntegration.bind(this));
    this.registerIntegration('adp', this.adpIntegration.bind(this));
    this.registerIntegration('checkr', this.checkrIntegration.bind(this));
    this.registerIntegration('sterling', this.sterlingIntegration.bind(this));
    this.registerIntegration('indeed', this.indeedIntegration.bind(this));
    this.registerIntegration('linkedin_jobs', this.linkedinJobsIntegration.bind(this));
  }

  registerIntegration(name, handler) {
    this.integrations.set(name, handler);
  }

  async checkCalendarConflicts(interviewData) {
    try {
      const { candidateId, interviewerIds, scheduledTime, duration } = interviewData;

      const candidateConflicts = await this.checkUserCalendar(candidateId, scheduledTime, duration);

      const interviewerConflicts = [];
      for (const interviewerId of interviewerIds) {
        const conflicts = await this.checkUserCalendar(interviewerId, scheduledTime, duration);
        interviewerConflicts.push(...conflicts);
      }

      if (candidateConflicts.length > 0 || interviewerConflicts.length > 0) {
        await NotificationTriggerService.trigger('calendar_conflict_alert', {
          recipientId: candidateId,
          recipientType: 'candidate',
          scheduledTime,
          duration,
          candidateConflicts,
          interviewerConflicts
        });

        return { hasConflicts: true, conflicts: { candidate: candidateConflicts, interviewers: interviewerConflicts } };
      }

      return { hasConflicts: false };
    } catch (error) {
      console.error('Error checking calendar conflicts:', error);
      return { hasConflicts: false, error: error.message };
    }
  }

  async checkUserCalendar(userId, scheduledTime, duration) {
    const conflicts = [];

    const mockExistingEvents = [
      {
        title: 'Team Meeting',
        start: new Date(scheduledTime.getTime() - 30 * 60 * 1000),
        end: new Date(scheduledTime.getTime() + 30 * 60 * 1000)
      }
    ];

    for (const event of mockExistingEvents) {
      if (this.timesOverlap(scheduledTime, new Date(scheduledTime.getTime() + duration), event.start, event.end)) {
        conflicts.push({
          title: event.title,
          start: event.start,
          end: event.end
        });
      }
    }

    return conflicts;
  }

  timesOverlap(start1, end1, start2, end2) {
    return start1 < end2 && end1 > start2;
  }

  async syncCandidateEmails(candidateId) {
    try {
      const emailThreads = await this.getCandidateEmailThreads(candidateId);

      for (const thread of emailThreads) {
        if (thread.isNew) {
          await NotificationTriggerService.trigger('email_communication_sync', {
            recipientId: candidateId,
            recipientType: 'candidate',
            threadId: thread.id,
            subject: thread.subject,
            sender: thread.sender,
            receivedAt: thread.receivedAt
          });
        }
      }

      return emailThreads;
    } catch (error) {
      console.error('Error syncing candidate emails:', error);
      return [];
    }
  }

  async getCandidateEmailThreads(candidateId) {
    return [
      {
        id: 'thread_123',
        subject: 'Follow-up on Software Engineer Position',
        sender: 'recruiter@company.com',
        receivedAt: new Date(),
        isNew: true,
        snippet: 'Thank you for your interest in the Software Engineer position...'
      }
    ];
  }

  async syncOnboardingData(candidateId, employeeId) {
    try {
      const onboardingData = await this.getHRISOnboardingData(employeeId);

      await NotificationTriggerService.trigger('hris_onboarding_update', {
        recipientId: candidateId,
        recipientType: 'candidate',
        employeeId,
        onboardingData,
        completedTasks: onboardingData.completedTasks,
        pendingTasks: onboardingData.pendingTasks
      });

      return onboardingData;
    } catch (error) {
      console.error('Error syncing HRIS onboarding data:', error);
      return null;
    }
  }

  async getHRISOnboardingData(employeeId) {
    return {
      employeeId,
      startDate: new Date(),
      completedTasks: ['paperwork', 'background_check'],
      pendingTasks: ['drug_test', 'orientation', 'equipment_setup'],
      manager: 'John Smith',
      department: 'Engineering'
    };
  }

  async checkBackgroundStatus(candidateId, checkId) {
    try {
      const status = await this.getBackgroundCheckStatus(checkId);

      if (status.status === 'completed') {
        await NotificationTriggerService.trigger('background_check_status', {
          recipientId: candidateId,
          recipientType: 'candidate',
          checkId,
          status: status.status,
          results: status.results,
          completedAt: status.completedAt
        });
      }

      return status;
    } catch (error) {
      console.error('Error checking background status:', error);
      return null;
    }
  }

  async getBackgroundCheckStatus(checkId) {
    return {
      checkId,
      status: 'completed',
      results: 'clear',
      completedAt: new Date(),
      reportUrl: 'https://background-check-service.com/report/123'
    };
  }

  async monitorJobPerformance(jobId) {
    try {
      const performance = await this.getJobBoardAnalytics(jobId);

      if (performance.views < 100) {
        await NotificationTriggerService.trigger('job_board_performance', {
          recipientId: performance.postedBy,
          recipientType: 'admin',
          jobId,
          performance,
          recommendation: 'Consider boosting the job posting or adjusting the job description'
        });
      }

      return performance;
    } catch (error) {
      console.error('Error monitoring job performance:', error);
      return null;
    }
  }

  async getJobBoardAnalytics(jobId) {
    return {
      jobId,
      postedBy: 'admin_user_id',
      views: 245,
      applications: 12,
      clicks: 89,
      source: 'Indeed',
      postedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    };
  }

  async checkIntegrationHealth() {
    const integrations = Array.from(this.integrations.keys());
    const healthStatus = {};

    for (const integration of integrations) {
      try {
        healthStatus[integration] = await this.testIntegration(integration);
      } catch (error) {
        healthStatus[integration] = { status: 'error', error: error.message };
      }
    }

    const failedIntegrations = Object.entries(healthStatus)
      .filter(([, status]) => status.status === 'error');

    if (failedIntegrations.length > 0) {
      const admins = await this.getAdminUsers();
      for (const admin of admins) {
        await NotificationTriggerService.trigger('integration_failure_notification', {
          recipientId: admin._id,
          recipientType: 'admin',
          failedIntegrations: failedIntegrations.map(([name, status]) => ({
            integration: name,
            error: status.error
          }))
        });
      }
    }

    return healthStatus;
  }

  async testIntegration(integrationName) {
    const isHealthy = Math.random() > 0.1;

    if (isHealthy) {
      return { status: 'healthy', lastChecked: new Date() };
    } else {
      throw new Error(`Integration ${integrationName} is currently unavailable`);
    }
  }

  async getAdminUsers() {
    const User = require('../models/User');
    return await User.find({ role: 'admin' });
  }

  async googleCalendarIntegration(action, data) {
    console.log('Google Calendar integration:', action, data);
  }

  async outlookCalendarIntegration(action, data) {
    console.log('Outlook Calendar integration:', action, data);
  }

  async gmailIntegration(action, data) {
    console.log('Gmail integration:', action, data);
  }

  async outlookEmailIntegration(action, data) {
    console.log('Outlook Email integration:', action, data);
  }

  async workdayIntegration(action, data) {
    console.log('Workday integration:', action, data);
  }

  async bamboohrIntegration(action, data) {
    console.log('BambooHR integration:', action, data);
  }

  async adpIntegration(action, data) {
    console.log('ADP integration:', action, data);
  }

  async checkrIntegration(action, data) {
    console.log('Checkr integration:', action, data);
  }

  async sterlingIntegration(action, data) {
    console.log('Sterling integration:', action, data);
  }

  async indeedIntegration(action, data) {
    console.log('Indeed integration:', action, data);
  }

  async linkedinJobsIntegration(action, data) {
    console.log('LinkedIn Jobs integration:', action, data);
  }

  async triggerIntegration(integrationName, action, data) {
    const integration = this.integrations.get(integrationName);
    if (integration) {
      return await integration(action, data);
    } else {
      throw new Error(`Integration ${integrationName} not found`);
    }
  }

  async syncAllCandidateData(candidateId) {
    const results = {};

    try {
      results.calendar = await this.checkCalendarConflicts({ candidateId, interviewerIds: [], scheduledTime: new Date(), duration: 60 * 60 * 1000 });
      results.emails = await this.syncCandidateEmails(candidateId);
      results.backgroundCheck = await this.checkBackgroundStatus(candidateId, 'check_123');

      return results;
    } catch (error) {
      console.error('Error syncing all candidate data:', error);
      return { error: error.message };
    }
  }
}

module.exports = new ExternalIntegrationService();