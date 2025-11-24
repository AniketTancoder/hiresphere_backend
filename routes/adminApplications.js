const express = require('express');
const JobApplication = require('../models/JobApplication');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const AIProcessor = require('../utils/aiProcessor');
const EmailService = require('../services/EmailService');
const auth = require('../middleware/auth');

const router = express.Router();
const emailService = new EmailService();

// Get all applications with filtering
router.get('/', auth, async (req, res) => {
  try {
    const { jobId, status, page = 1, limit = 10 } = req.query;

    let query = {};

    // Filter by job
    if (jobId) {
      query.jobId = jobId;
    } else {
      // If no specific job, get applications for user's jobs
      const userJobs = await Job.find({ createdBy: req.user.id }).select('_id');
      const jobIds = userJobs.map(job => job._id);
      query.jobId = { $in: jobIds };
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    const applications = await JobApplication.find(query)
      .populate('jobId', 'title company')
      .populate('candidateId', 'name email skills experience')
      .sort({ appliedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await JobApplication.countDocuments(query);

    res.json({
      applications,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update application status
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, notes, sendEmail = true } = req.body;

    const application = await JobApplication.findById(req.params.id)
      .populate('jobId')
      .populate('candidateId');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Verify the job belongs to the user
    if (application.jobId.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const oldStatus = application.status;
    application.status = status;
    if (notes) {
      application.notes = notes;
    }
    application.updatedAt = new Date();

    await application.save();

    let emailSent = false;

    // Send automated email for specific status changes
    if (sendEmail && ['shortlisted', 'rejected', 'selected'].includes(status.toLowerCase())) {
      try {
        // Get candidate data - handle both Candidate and CandidateProfile models
        let candidate = application.candidateId;
        if (!candidate) {
          // Try to find candidate in the other collection
          const CandidateProfile = require('../models/CandidateProfile');
          candidate = await CandidateProfile.findById(application.candidateId);
        }

        if (candidate) {
          emailSent = await emailService.sendStatusEmailWithRetry(
            candidate,
            application.jobId,
            oldStatus,
            status.toLowerCase(),
            application._id
          );

          console.log(`Email ${emailSent ? 'sent' : 'failed'} for application ${application._id} status change to ${status}`);
        } else {
          console.warn(`Candidate not found for application ${application._id}`);
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        // Don't fail the status update if email fails
      }
    }

    // Create notification for candidate
    try {
      const Notification = require('../models/Notification');

      // Get the application with populated candidate and job data
      const candidateApp = await require('../models/JobApplication').findById(req.params.id)
        .populate('candidate')
        .populate('job');

      if (candidateApp && candidateApp.candidate) {
        const statusMessages = {
          'under_review': 'Your application is now under review',
          'shortlisted': 'Congratulations! Your application has been shortlisted',
          'interview_scheduled': 'You have been scheduled for an interview',
          'interviewed': 'Your interview has been completed',
          'offered': 'Great news! You have received a job offer',
          'hired': 'Congratulations! You have been hired',
          'rejected': 'We regret to inform you that your application was not successful',
          'withdrawn': 'Your application has been withdrawn'
        };

        await Notification.createNotification({
          recipient: candidateApp.candidate._id,
          recipientType: 'candidate',
          type: 'application_status_update',
          title: 'Application Status Update',
          message: `${candidateApp.job.title}: ${statusMessages[status] || `Your application status has been updated to: ${status}`}`,
          data: {
            applicationId: candidateApp._id,
            jobId: candidateApp.job._id,
            oldStatus: candidateApp.status,
            newStatus: status
          },
          actionUrl: `/candidate/applications`,
          priority: status === 'interview_scheduled' || status === 'offered' || status === 'hired' ? 'high' : 'medium'
        });
      }
    } catch (error) {
      console.warn('Failed to create candidate notification:', error.message);
    }

    res.json({
      application,
      emailSent,
      message: `Application status updated successfully${emailSent ? ' and email sent' : ''}`
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Bulk update application statuses
router.put('/bulk/status', auth, async (req, res) => {
  try {
    const { applicationIds, status, notes } = req.body;

    const applications = await JobApplication.find({
      _id: { $in: applicationIds }
    }).populate('jobId');

    // Verify all applications belong to user's jobs
    for (const app of applications) {
      if (app.jobId.createdBy.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
    }

    await JobApplication.updateMany(
      { _id: { $in: applicationIds } },
      {
        status,
        notes: notes || undefined,
        updatedAt: new Date()
      }
    );

    res.json({ message: 'Applications updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get applications for a specific job
router.get('/job/:jobId', auth, async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      createdBy: req.user.id
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const applications = await JobApplication.find({ jobId: req.params.jobId })
      .populate('candidateId', 'name email skills experience location')
      .sort({ appliedAt: -1 });

    // Add AI match scores
    const applicationsWithScores = applications.map(app => {
      const matchScore = AIProcessor.calculateMatchScore(
        app.candidateId.skills,
        job.requiredSkills,
        job.niceToHaveSkills,
        app.candidateId,
        job
      );

      return {
        ...app.toObject(),
        aiMatchScore: matchScore
      };
    });

    res.json({
      job: job.title,
      applications: applicationsWithScores
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;