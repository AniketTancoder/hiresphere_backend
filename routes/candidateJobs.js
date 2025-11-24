const express = require('express');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const CandidateProfile = require('../models/CandidateProfile');
const Skill = require('../models/Skill');

const router = express.Router();

const authenticateCandidate = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.type !== 'candidate') {
      return res.status(403).json({ message: 'Access denied. Candidate authentication required.' });
    }
    req.candidate = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      location,
      jobType,
      experience,
      skills,
      salary_min,
      salary_max,
      company,
      sort = 'newest'
    } = req.query;

    const query = { status: 'open' };

    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') }
      ];
    }

    if (location) {
      query.$or = query.$or || [];
      query.$or.push(
        { location: new RegExp(location, 'i') },
        { 'locationDetails.city': new RegExp(location, 'i') },
        { 'locationDetails.state': new RegExp(location, 'i') },
        { 'locationDetails.country': new RegExp(location, 'i') }
      );
    }

    if (jobType) {
      query.jobType = jobType;
    }

    if (experience) {
      const expRange = experience.split('-');
      if (expRange.length === 2) {
        query.experience = {
          $gte: parseInt(expRange[0]),
          $lte: parseInt(expRange[1])
        };
      } else if (experience.includes('+')) {
        query.experience = { $gte: parseInt(experience.replace('+', '')) };
      }
    }

    if (skills) {
      const skillNames = skills.split(',').map(s => s.trim().toLowerCase());
      const skillIds = await Skill.find({ name: { $in: skillNames } }).select('_id');
      query.requiredSkills = { $in: skillIds.map(s => s._id) };
    }

    if (salary_min || salary_max) {
      query.salary = {};
      if (salary_min) query.salary.$gte = parseInt(salary_min);
      if (salary_max) query.salary.$lte = parseInt(salary_max);
    }

    if (company) {
      query.company = new RegExp(company, 'i');
    }

    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'salary_high':
        sortOption = { salary: -1 };
        break;
      case 'salary_low':
        sortOption = { salary: 1 };
        break;
      case 'company':
        sortOption = { company: 1 };
        break;
    }

    const jobs = await Job.find(query)
      .populate('createdBy', 'name email')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-aiAnalysis');

    const total = await Job.countDocuments(query);

    let jobsWithStatus = jobs;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'your-secret-key');

        if (decoded.type === 'candidate') {
          const candidateApplications = await JobApplication.find({
            candidate: decoded.id,
            job: { $in: jobs.map(j => j._id) }
          }).select('job status');

          const applicationMap = new Map();
          candidateApplications.forEach(app => {
            applicationMap.set(app.job.toString(), app.status);
          });

          jobsWithStatus = jobs.map(job => ({
            ...job.toObject(),
            applicationStatus: applicationMap.get(job._id.toString()) || null
          }));
        }
      } catch (error) {
      }
    }

    res.json({
      jobs: jobsWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      filters: {
        search,
        location,
        jobType,
        experience,
        skills,
        salaryRange: { min: salary_min, max: salary_max },
        company
      }
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('createdBy', 'name email')
      .select('-aiAnalysis');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.status !== 'open') {
      return res.status(404).json({ message: 'Job not available' });
    }

    let jobWithStatus = job;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'your-secret-key');

        if (decoded.type === 'candidate') {
          const application = await JobApplication.findOne({
            candidate: decoded.id,
            job: job._id
          }).select('status');

          jobWithStatus = {
            ...job.toObject(),
            applicationStatus: application ? application.status : null
          };
        }
      } catch (error) {
      }
    }

    res.json(jobWithStatus);

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/apply', authenticateCandidate, async (req, res) => {
  try {
    const jobId = req.params.id;
    const candidateId = req.candidate.id;

    const job = await Job.findById(jobId);
    if (!job || job.status !== 'open') {
      return res.status(404).json({ message: 'Job not found or not available for applications' });
    }

    const existingApplication = await JobApplication.findOne({
      candidate: candidateId,
      job: jobId
    });

    if (existingApplication) {
      return res.status(400).json({
        message: 'You have already applied to this job',
        applicationStatus: existingApplication.status
      });
    }

    const candidate = await CandidateProfile.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate profile not found' });
    }

    const application = new JobApplication({
      job: jobId,
      candidate: candidateId,
      recruiter: job.createdBy,
      applicationData: req.body.applicationData || {},
      aiAnalysis: {}
    });

    await application.save();

    try {
      const Notification = require('../models/Notification');
      await Notification.createNotification({
        recipient: job.createdBy,
        recipientType: 'admin',
        type: 'new_application',
        title: 'New Job Application',
        message: `${candidate.firstName} ${candidate.lastName} applied for ${job.title}`,
        data: {
          applicationId: application._id,
          candidateId: candidate._id,
          jobId: job._id
        },
        actionUrl: `/admin/job-applications?job=${job._id}`,
        priority: 'high'
      });
    } catch (error) {
      console.warn('Failed to create notification:', error.message);
    }

    try {
      const AIProcessor = require('../utils/aiProcessor');
      const candidateSkillNames = candidate.skills
        .filter(s => s.skill && s.skill.name)
        .map(s => s.skill.name)
        .filter(name => name && typeof name === 'string');
      const matchScore = AIProcessor.calculateMatchScore(
        candidateSkillNames,
        job.requiredSkills,
        job.niceToHaveSkills || [],
        candidate,
        job
      );

      application.aiAnalysis = {
        matchScore,
        technicalMatch: AIProcessor.calculateTechnicalMatch(
          candidateSkillNames,
          job.requiredSkills,
          job.niceToHaveSkills || []
        ),
        experienceFit: AIProcessor.calculateExperienceMatch(candidate, job),
        culturalFit: AIProcessor.calculateCulturalFit(candidate, job),
        successProbability: AIProcessor.calculateSuccessProbability(candidate, job)
      };

      await application.save();

      if (matchScore >= 80) {
        try {
          const Notification = require('../models/Notification');
          await Notification.createNotification({
            recipient: job.createdBy,
            recipientType: 'admin',
            type: 'job_match',
            title: 'High Match Candidate Applied',
            message: `${candidate.firstName} ${candidate.lastName} applied with ${Math.round(matchScore)}% match score for ${job.title}`,
            data: {
              applicationId: application._id,
              candidateId: candidate._id,
              jobId: job._id,
              matchScore: matchScore
            },
            actionUrl: `/admin/job-applications?job=${job._id}`,
            priority: 'high'
          });
        } catch (error) {
          console.warn('Failed to create high match notification:', error.message);
        }
      }
    } catch (error) {
      console.warn('AI analysis failed for application:', error.message);
    }

    res.status(201).json({
      message: 'Application submitted successfully',
      application: {
        id: application._id,
        status: application.status,
        appliedAt: application.createdAt,
        aiAnalysis: application.aiAnalysis
      }
    });

  } catch (error) {
    console.error('Apply to job error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/recommendations/for-me', authenticateCandidate, async (req, res) => {
  try {
    const candidate = await CandidateProfile.findById(req.candidate.id)
      .populate('skills.skill', 'name category');

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate profile not found' });
    }

    const candidateSkillNames = candidate.skills
      .filter(s => s.skill && s.skill.name)
      .map(s => s.skill.name.toLowerCase())
      .filter(name => name && typeof name === 'string');

    const recommendations = await Job.find({
      status: 'open',
      $or: [
        { requiredSkills: { $in: candidateSkillNames } },
        { niceToHaveSkills: { $in: candidateSkillNames } }
      ]
    })
    .populate('createdBy', 'name')
    .limit(10)
    .sort({ createdAt: -1 });

    const scoredRecommendations = recommendations.map(job => {
      try {
        const AIProcessor = require('../utils/aiProcessor');

        const candidateForAI = {
          skills: candidateSkillNames,
          experience: candidate.yearsOfExperience || 0,
          education: candidate.education || [],
          currentTitle: candidate.currentTitle || '',
          currentCompany: candidate.currentCompany || ''
        };

        const matchScore = AIProcessor.calculateMatchScore(
          candidateSkillNames,
          job.requiredSkills || [],
          job.niceToHaveSkills || [],
          candidateForAI,
          {
            experience: job.experience || 0,
            title: job.title || '',
            requiredSkills: job.requiredSkills || [],
            niceToHaveSkills: job.niceToHaveSkills || []
          }
        );

        return {
          ...job.toObject(),
          matchScore: matchScore || 0,
          recommendationReason: matchScore >= 80 ? 'Excellent Match' :
                               matchScore >= 60 ? 'Good Match' :
                               'Potential Match'
        };
      } catch (error) {
        console.warn('Error calculating match score for job:', job._id, error.message);
        return {
          ...job.toObject(),
          matchScore: 25,
          recommendationReason: 'Potential Match'
        };
      }
    }).sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      recommendations: scoredRecommendations,
      total: scoredRecommendations.length,
      basedOn: {
        skills: candidateSkillNames.length,
        experience: candidate.yearsOfExperience,
        preferences: candidate.preferredLocations
      }
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/skills/search', async (req, res) => {
  try {
    const { q, category, limit = 10 } = req.query;

    const skills = await Skill.searchSkills(q, category, parseInt(limit));

    res.json({
      skills: skills.map(skill => ({
        id: skill._id,
        name: skill.name,
        displayName: skill.displayName,
        category: skill.category
      }))
    });

  } catch (error) {
    console.error('Search skills error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/skills/popular', async (req, res) => {
  try {
    const { category, limit = 20 } = req.query;

    const skills = await Skill.getPopularSkills(category, parseInt(limit));

    res.json({
      skills: skills.map(skill => ({
        id: skill._id,
        name: skill.name,
        displayName: skill.displayName,
        category: skill.category,
        popularity: skill.popularity
      }))
    });

  } catch (error) {
    console.error('Get popular skills error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;