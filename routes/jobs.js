const express = require('express');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const AIProcessor = require('../utils/aiProcessor');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const jobData = req.body;

    const biasAnalysis = AIProcessor.analyzeBias(
      jobData.description + ' ' + jobData.title
    );

    const job = new Job({
      ...jobData,
      createdBy: req.user.id,
      aiAnalysis: biasAnalysis
    });

    await job.save();
    res.status(201).json(job);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const jobs = await Job.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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

router.get('/:id/matches', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    const candidates = await Candidate.find({ addedBy: req.user.id });

    const matches = candidates.map(candidate => {
      const matchScore = AIProcessor.calculateMatchScore(
        candidate.skills,
        job.requiredSkills,
        job.niceToHaveSkills,
        candidate,
        job
      );

      const matchingSkills = candidate.skills.filter(skill =>
        job.requiredSkills.some(reqSkill =>
          AIProcessor.isSkillMatch(skill, reqSkill)
        )
      );

      const missingSkills = job.requiredSkills.filter(reqSkill =>
        !candidate.skills.some(candidateSkill =>
          AIProcessor.isSkillMatch(candidateSkill, reqSkill)
        )
      );

      const experienceFit = AIProcessor.calculateExperienceMatch(candidate, job);
      const culturalFit = AIProcessor.calculateCulturalFit(candidate, job);
      const successProbability = AIProcessor.calculateSuccessProbability(candidate, job);

      return {
        candidate,
        matchScore,
        experienceFit,
        culturalFit,
        successProbability,
        matchingSkills,
        missingSkills,
        insights: {
          technicalMatch: AIProcessor.calculateTechnicalMatch(candidate.skills, job.requiredSkills, job.niceToHaveSkills),
          overQualified: candidate.experience > (job.experience || 0) * 1.5,
          underQualified: candidate.experience < (job.experience || 0) * 0.7,
          skillGap: missingSkills.length,
          recommendedAction: matchScore >= 80 ? 'Strong Match - Schedule Interview' :
                           matchScore >= 60 ? 'Good Match - Consider' :
                           matchScore >= 40 ? 'Borderline - May Need Training' : 'Not Recommended'
        }
      };
    }).filter(match => match.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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
    job.salaryMin = salaryMin !== undefined ? salaryMin : job.salaryMin;
    job.salaryMax = salaryMax !== undefined ? salaryMax : job.salaryMax;
    job.requiredSkills = requiredSkills || job.requiredSkills;
    job.niceToHaveSkills = niceToHaveSkills || job.niceToHaveSkills;
    job.experience = experience !== undefined ? experience : job.experience;
    job.status = status || job.status;

    if (description) {
      job.aiAnalysis = AIProcessor.analyzeBias(description + ' ' + job.title);
    }

    await job.save();
    res.json(job);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

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

router.get('/:id/rediscover', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const allCandidates = await Candidate.find({ addedBy: req.user.id });

    const existingMatches = await Candidate.find({
      addedBy: req.user.id,
      'aiAnalysis.jobId': job._id
    });

    const existingMatchIds = existingMatches.map(c => c._id.toString());
    const newCandidates = allCandidates.filter(c => !existingMatchIds.includes(c._id.toString()));

    const rediscoveredCandidates = newCandidates.map(candidate => {
      const matchScore = AIProcessor.calculateMatchScore(
        candidate.skills,
        job.requiredSkills,
        job.niceToHaveSkills,
        candidate,
        job
      );

      return {
        candidate,
        matchScore,
        rediscoveryReason: matchScore >= 70 ? 'High Match - Previously Overlooked' :
                          matchScore >= 50 ? 'Good Potential Match' :
                          'Interesting Profile',
        timeSinceAdded: Date.now() - new Date(candidate.createdAt).getTime(),
        lastActivity: candidate.updatedAt
      };
    })
    .filter(match => match.matchScore >= 30)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 20);

    res.json({
      job: job.title,
      rediscoveredCount: rediscoveredCandidates.length,
      candidates: rediscoveredCandidates,
      insights: {
        averageScore: rediscoveredCandidates.length > 0 ?
          Math.round(rediscoveredCandidates.reduce((sum, c) => sum + c.matchScore, 0) / rediscoveredCandidates.length) : 0,
        highMatches: rediscoveredCandidates.filter(c => c.matchScore >= 70).length,
        dormantCandidates: rediscoveredCandidates.filter(c =>
          c.timeSinceAdded > 30 * 24 * 60 * 60 * 1000
        ).length
      }
    });
  } catch (error) {
    console.error('Error in candidate rediscovery:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;