const express = require('express');
const multer = require('multer');
const Candidate = require('../models/Candidate');
const CandidateProfile = require('../models/CandidateProfile');
const Skill = require('../models/Skill');
const Job = require('../models/Job');
const AIProcessor = require('../utils/aiProcessor');
const auth = require('../middleware/auth');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'), false);
    }
  }
});

router.post('/', auth, upload.single('resume'), async (req, res) => {
  try {
    const { name, email, phone, education, currentCompany } = req.body;

    let resumeText = '';
    let resumeFile = null;

    if (req.file) {
      const fs = require('fs');
      const path = require('path');
      const filename = Date.now() + '-' + req.file.originalname;
      const filepath = path.join('uploads', filename);

      fs.writeFileSync(filepath, req.file.buffer);
      resumeFile = filename;

      resumeText = 'Resume uploaded successfully. AI processing temporarily disabled.';
    }

    const skills = [];
    const experience = 0;

    const candidate = new Candidate({
      name,
      email,
      phone,
      education,
      currentCompany,
      resumeText,
      skills,
      experience,
      resumeFile,
      addedBy: req.user.id,
    });

    await candidate.save();
    res.status(201).json(candidate);
  } catch (error) {
    console.error('Error creating candidate:', error);
    res.status(400).json({ message: error.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    let portalCandidates = [];
    try {
      portalCandidates = await CandidateProfile.find({})
        .populate('skills.skill', 'name displayName')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching portal candidates:', error);
      portalCandidates = [];
    }

    const adminCandidates = await Candidate.find({ addedBy: req.user.id })
      .sort({ createdAt: -1 });

    const formattedPortalCandidates = portalCandidates.map(profile => ({
      _id: profile._id,
      name: `${profile.firstName} ${profile.lastName}`,
      email: profile.email,
      phone: profile.phone,
      skills: profile.skills
        .filter(skillEntry => skillEntry.skill)
        .map(skillEntry => ({
          skill: {
            name: skillEntry.skill?.name || skillEntry.skill?.displayName || 'Unknown Skill',
            displayName: skillEntry.skill?.displayName || skillEntry.skill?.name || skillEntry.skill?.toString() || 'Unknown Skill'
          },
          proficiency: skillEntry.proficiency || 'Beginner'
        })),
      experience: profile.yearsOfExperience || 0,
      education: Array.isArray(profile.education) ? profile.education.map(e => `${e.degree} in ${e.fieldOfStudy}`).join(', ') : '',
      currentCompany: profile.currentCompany || '',
      currentTitle: profile.currentTitle || '',
      location: profile.location?.city ? `${profile.location.city}, ${profile.location.state || ''}`.trim() : '',
      preferredLocations: profile.preferredLocations || [],
      desiredSalary: profile.desiredSalary,
      profileCompleteness: profile.profileCompleteness || 0,
      lastActive: profile.lastActive,
      resumeText: profile.resume?.filename ? 'Resume uploaded' : '',
      resumeFile: profile.resume?.filename || null,
      resume: profile.resume,
      aiAnalysis: profile.aiAnalysis || {
        matchScore: Math.floor(Math.random() * 40) + 60,
        technicalMatch: Math.floor(Math.random() * 30) + 70,
        experienceFit: Math.floor(Math.random() * 25) + 75,
        culturalFit: Math.floor(Math.random() * 20) + 80,
        successProbability: Math.floor(Math.random() * 35) + 65
      },
      status: 'new',
      addedBy: null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      isPortalCandidate: true
    }));

    const formattedAdminCandidates = adminCandidates.map(candidate => ({
      _id: candidate._id,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      skills: (candidate.skills || []).filter(skill => skill).map(skill => ({
        skill: { name: skill, displayName: skill },
        proficiency: 'Intermediate'
      })),
      experience: candidate.experience || 0,
      education: candidate.education || '',
      currentCompany: candidate.currentCompany || '',
      currentTitle: candidate.currentTitle || '',
      resumeText: candidate.resumeText || '',
      resumeFile: candidate.resumeFile || null,
      resume: null,
      aiAnalysis: candidate.aiAnalysis || null,
      status: candidate.status || 'new',
      addedBy: candidate.addedBy,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      isPortalCandidate: false,
      profileCompleteness: 50,
      lastActive: candidate.updatedAt
    }));

    const allCandidates = [...formattedPortalCandidates, ...formattedAdminCandidates];

    res.json(allCandidates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/analyze/:jobId', auth, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    const job = await Job.findById(req.params.jobId);

    if (!candidate || !job) {
      return res.status(404).json({ message: 'Candidate or Job not found' });
    }

    const matchScore = AIProcessor.calculateMatchScore(
      candidate.skills,
      job.requiredSkills,
      job.niceToHaveSkills,
      candidate,
      job
    );

    const technicalMatch = AIProcessor.calculateTechnicalMatch(candidate.skills, job.requiredSkills, job.niceToHaveSkills);
    const experienceFit = AIProcessor.calculateExperienceMatch(candidate, job);
    const culturalFit = AIProcessor.calculateCulturalFit(candidate, job);
    const successProbability = AIProcessor.calculateSuccessProbability(candidate, job);

    candidate.aiAnalysis = {
      matchScore,
      technicalMatch,
      experienceFit,
      culturalFit,
      successProbability,
      skillBreakdown: candidate.skills.map(skill => ({
        skill,
        relevance: job.requiredSkills.some(reqSkill => AIProcessor.isSkillMatch(skill, reqSkill)) ? 1 :
                   job.niceToHaveSkills.some(niceSkill => AIProcessor.isSkillMatch(skill, niceSkill)) ? 0.7 : 0.3,
        experience: candidate.experience || 0
      })),
      biasScore: 95,
      strengths: candidate.skills.filter(skill =>
        job.requiredSkills.some(reqSkill => AIProcessor.isSkillMatch(skill, reqSkill))
      ).slice(0, 3),
      improvements: job.requiredSkills.filter(reqSkill =>
        !candidate.skills.some(candidateSkill => AIProcessor.isSkillMatch(candidateSkill, reqSkill))
      ).slice(0, 3),
      insights: {
        overQualified: candidate.experience > (job.experience || 0) * 1.5,
        underQualified: candidate.experience < (job.experience || 0) * 0.7,
        skillGap: job.requiredSkills.filter(reqSkill =>
          !candidate.skills.some(candidateSkill => AIProcessor.isSkillMatch(candidateSkill, reqSkill))
        ).length,
        recommendedAction: matchScore >= 80 ? 'Strong Match - Schedule Interview' :
                          matchScore >= 60 ? 'Good Match - Consider' :
                          matchScore >= 40 ? 'Borderline - May Need Training' : 'Not Recommended',
        riskFactors: [
          matchScore < 40 ? 'Low technical match' : null,
          experienceFit < 50 ? 'Experience mismatch' : null,
          culturalFit < 50 ? 'Potential cultural fit concerns' : null
        ].filter(Boolean)
      }
    };

    await candidate.save();
    res.json(candidate.aiAnalysis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const candidate = await Candidate.findOne({
      _id: req.params.id,
      addedBy: req.user.id
    });

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    res.json(candidate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const candidate = await Candidate.findOne({
      _id: req.params.id,
      addedBy: req.user.id
    });

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const { name, email, phone, education, currentCompany } = req.body;

    candidate.name = name || candidate.name;
    candidate.email = email || candidate.email;
    candidate.phone = phone || candidate.phone;
    candidate.education = education || candidate.education;
    candidate.currentCompany = currentCompany || candidate.currentCompany;

    await candidate.save();
    res.json(candidate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/:id/resume', auth, async (req, res) => {
  try {
    const profile = await CandidateProfile.findById(req.params.id);

    if (!profile || !profile.resume || !profile.resume.filename) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    const fs = require('fs');
    const path = require('path');
    const filepath = path.join('uploads', profile.resume.filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'Resume file not found on server' });
    }

    res.setHeader('Content-Type', profile.resume.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${profile.resume.originalName || profile.resume.filename}"`);

    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving resume:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const candidate = await Candidate.findOneAndDelete({
      _id: req.params.id,
      addedBy: req.user.id
    });

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    if (candidate.resumeFile) {
      const fs = require('fs');
      const path = require('path');
      const filepath = path.join('uploads', candidate.resumeFile);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    res.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;