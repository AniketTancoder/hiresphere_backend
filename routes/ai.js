const express = require('express');
const multer = require('multer');
const AIProcessor = require('../utils/aiProcessor');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Parse resume
router.post('/parse-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No resume file provided' });
    }

    const parsedData = await AIProcessor.parseResume(req.file.path);

    res.json({
      success: true,
      data: parsedData
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Match candidates for a job
router.post('/match-candidates', auth, async (req, res) => {
  try {
    const { jobId } = req.body;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

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

      return {
        candidate,
        matchScore,
        matchingSkills,
        missingSkills,
        experienceFit: AIProcessor.calculateExperienceMatch(candidate, job),
        culturalFit: AIProcessor.calculateCulturalFit(candidate, job),
        successProbability: AIProcessor.calculateSuccessProbability(candidate, job)
      };
    }).filter(match => match.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Detect bias in job description
router.post('/detect-bias', async (req, res) => {
  try {
    const { description, title } = req.body;

    const biasAnalysis = AIProcessor.analyzeBias(description + ' ' + title);

    res.json(biasAnalysis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get job recommendations for candidate
router.get('/recommendations/:candidateId', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.candidateId);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Get all active jobs (simplified - in production, filter by relevance)
    const jobs = await Job.find({ status: 'active' }).limit(20);

    const recommendations = jobs.map(job => {
      const matchScore = AIProcessor.calculateMatchScore(
        candidate.skills,
        job.requiredSkills,
        job.niceToHaveSkills,
        candidate,
        job
      );

      return {
        job,
        matchScore,
        reasons: [
          matchScore >= 80 ? 'Excellent skill match' :
          matchScore >= 60 ? 'Good skill alignment' :
          'Potential opportunity'
        ]
      };
    }).filter(rec => rec.matchScore >= 40)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;