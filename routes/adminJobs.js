const express = require('express');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const AIProcessor = require('../utils/aiProcessor');
const auth = require('../middleware/auth');

const router = express.Router();

// Create new job
router.post('/', auth, async (req, res) => {
  try {
    const jobData = req.body;

    // AI Analysis of job description
    const biasAnalysis = AIProcessor.analyzeBias(
      jobData.description + ' ' + jobData.title
    );

    const job = new Job({
      ...jobData,
      createdBy: req.user.id,
      aiAnalysis: biasAnalysis
    });

    await job.save();

    // Create notifications for candidates about new job
    try {
      const CandidateProfile = require('../models/CandidateProfile');
      const Notification = require('../models/Notification');

      // Get all candidates
      const candidates = await CandidateProfile.find({}).select('_id');

      // Create notification for each candidate
      const notifications = candidates.map(candidate => ({
        recipient: candidate._id,
        recipientType: 'candidate',
        type: 'new_job',
        title: 'New Job Opportunity',
        message: `A new job "${job.title}" at ${job.company} is now available.`,
        data: {
          jobId: job._id,
          jobTitle: job.title,
          company: job.company,
          location: job.location
        },
        priority: 'medium',
        actionUrl: `/candidate/jobs`
      }));

      // Create notifications in bulk
      for (const notificationData of notifications) {
        await Notification.createNotification(notificationData);
      }

      console.log(`Created ${notifications.length} notifications for new job: ${job.title}`);
    } catch (error) {
      console.error('Error creating job notifications:', error);
      // Don't fail the job creation if notifications fail
    }

    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all jobs
router.get('/', auth, async (req, res) => {
  try {
    const jobs = await Job.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get job by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update job
router.put('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.id,
      createdBy: req.user.id
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const { title, company, description, location, salaryMin, salaryMax, requiredSkills, niceToHaveSkills, experience, status } = req.body;

    job.title = title || job.title;
    job.company = company || job.company;
    job.description = description || job.description;
    job.location = location || job.location;
    if (salaryMin !== undefined) job.salaryMin = salaryMin;
    if (salaryMax !== undefined) job.salaryMax = salaryMax;
    job.requiredSkills = requiredSkills || job.requiredSkills;
    job.niceToHaveSkills = niceToHaveSkills || job.niceToHaveSkills;
    if (experience !== undefined) job.experience = experience;
    job.status = status || job.status;

    // Re-run AI analysis if description changed
    if (description) {
      job.aiAnalysis = AIProcessor.analyzeBias(description + ' ' + job.title);
    }

    await job.save();
    res.json(job);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete job
router.delete('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;