const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const CandidateProfile = require('../models/CandidateProfile');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
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

// Create new candidate profile (admin)
router.post('/', auth, upload.single('resume'), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      currentTitle,
      currentCompany,
      yearsOfExperience,
      location,
      skills,
      education,
      experience,
      password
    } = req.body;

    // Check if candidate already exists
    const existingCandidate = await CandidateProfile.findOne({ email });
    if (existingCandidate) {
      return res.status(400).json({ message: 'Candidate with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || 'defaultpassword123', salt);

    let resumeData = null;
    if (req.file) {
      // Save file to disk
      const fs = require('fs');
      const path = require('path');
      const filename = Date.now() + '-' + req.file.originalname;
      const filepath = path.join('uploads', filename);

      fs.writeFileSync(filepath, req.file.buffer);
      resumeData = {
        filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date()
      };
    }

    // Parse JSON fields
    const parsedLocation = location ? JSON.parse(location) : {};

    // Process skills - convert skill names to ObjectIds
    let processedSkills = [];
    if (skills) {
      try {
        const skillsArray = JSON.parse(skills);
        const Skill = require('../models/Skill');
        for (const skillData of skillsArray) {
          if (skillData && skillData.skill) {
            const skill = await Skill.findOne({ name: skillData.skill.toLowerCase() });
            if (skill) {
              processedSkills.push({
                skill: skill._id,
                proficiency: skillData.proficiency || 'intermediate',
                yearsOfExperience: skillData.yearsOfExperience || 0
              });
            } else {
              console.warn(`Skill '${skillData.skill}' not found in database, skipping`);
            }
          }
        }
      } catch (error) {
        console.warn('Error parsing skills data:', error.message);
      }
    }

    const parsedEducation = education ? JSON.parse(education) : [];
    const parsedExperience = experience ? JSON.parse(experience) : [];

    const candidateProfile = new CandidateProfile({
      firstName,
      lastName,
      email,
      password: hashedPassword, // Hashed password
      phone,
      currentTitle,
      currentCompany,
      yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : 0,
      location: parsedLocation,
      skills: processedSkills,
      education: parsedEducation,
      experience: parsedExperience,
      resume: resumeData,
      emailVerified: true, // Admin-created profiles are pre-verified
      profileCompleteness: 80 // Higher completeness for admin-created profiles
    });

    await candidateProfile.save();

    // Create notification for admins about new candidate
    try {
      const User = require('../models/User');
      const Notification = require('../models/Notification');

      // Get all admin users
      const admins = await User.find({ role: 'admin' }).select('_id');

      // Create notification for each admin
      const notifications = admins.map(admin => ({
        recipient: admin._id,
        recipientType: 'admin',
        type: 'candidate_update',
        title: 'New Candidate Added',
        message: `${candidateProfile.firstName} ${candidateProfile.lastName} has been added to the candidate database.`,
        data: {
          candidateId: candidateProfile._id,
          candidateName: `${candidateProfile.firstName} ${candidateProfile.lastName}`,
          email: candidateProfile.email,
          skills: candidateProfile.skills?.length || 0
        },
        priority: 'medium',
        actionUrl: `/admin/candidate-database`
      }));

      // Create notifications in bulk
      for (const notificationData of notifications) {
        await Notification.createNotification(notificationData);
      }

      console.log(`Created ${notifications.length} notifications for new candidate: ${candidateProfile.firstName} ${candidateProfile.lastName}`);
    } catch (error) {
      console.error('Error creating candidate notifications:', error);
      // Don't fail the candidate creation if notifications fail
    }

    res.status(201).json({
      message: 'Candidate profile created successfully',
      candidate: candidateProfile
    });
  } catch (error) {
    console.error('Error creating candidate profile:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get all candidate profiles with filtering and search
router.get('/', auth, async (req, res) => {
  try {
    const {
      search,
      skills,
      location,
      experience,
      page = 1,
      limit = 12,
      sort = 'newest'
    } = req.query;

    let query = {}; // Get all candidate profiles from the portal

    // Search by name or email
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { currentTitle: { $regex: search, $options: 'i' } },
        { currentCompany: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by skills
    if (skills) {
      const skillNames = skills.split(',').map(s => s.trim().toLowerCase());
      // This will need to be updated based on how skills are stored in CandidateProfile
      // For now, we'll do a simple text search
      query.$or = query.$or || [];
      query.$or.push({
        skills: {
          $elemMatch: {
            skill: { $in: skillNames }
          }
        }
      });
    }

    // Filter by location
    if (location) {
      query.$or = query.$or || [];
      query.$or.push(
        { 'location.city': { $regex: location, $options: 'i' } },
        { 'location.state': { $regex: location, $options: 'i' } },
        { 'location.country': { $regex: location, $options: 'i' } }
      );
    }

    // Filter by experience
    if (experience) {
      if (experience.includes('-')) {
        const [min, max] = experience.split('-').map(n => parseInt(n));
        query.yearsOfExperience = { $gte: min, $lte: max };
      } else if (experience.includes('+')) {
        query.yearsOfExperience = { $gte: parseInt(experience.replace('+', '')) };
      } else {
        query.yearsOfExperience = { $gte: parseInt(experience) };
      }
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // newest first
    switch (sort) {
      case 'oldest':
        sortOption = { createdAt: 1 };
        break;
      case 'name':
        sortOption = { firstName: 1, lastName: 1 };
        break;
      case 'experience':
        sortOption = { yearsOfExperience: -1 };
        break;
    }

    const candidates = await CandidateProfile.find(query)
      .populate('skills.skill', 'name displayName category')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-password'); // Exclude password

    const total = await CandidateProfile.countDocuments(query);

    // Add match score calculation (simplified - in real app this would be more sophisticated)
    const candidatesWithMatchScore = candidates.map(candidate => ({
      ...candidate.toObject(),
      matchScore: Math.floor(Math.random() * 40) + 60 // Random score 60-100 for demo
    }));

    res.json({
      candidates: candidatesWithMatchScore,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Error fetching candidate profiles:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get candidate profile by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const candidate = await CandidateProfile.findById(req.params.id)
      .populate('skills.skill', 'name displayName category')
      .select('-password');

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Create profile view notification for candidate
    try {
      const Notification = require('../models/Notification');
      await Notification.createNotification({
        recipient: candidate._id,
        recipientType: 'candidate',
        type: 'profile_view',
        title: 'Profile Viewed',
        message: `A recruiter viewed your profile`,
        data: {
          candidateId: candidate._id,
          viewerId: req.user.id,
          viewerType: 'admin'
        },
        actionUrl: `/candidate/profile`,
        priority: 'low'
      });
    } catch (error) {
      console.warn('Failed to create profile view notification:', error.message);
    }

    res.json(candidate);
  } catch (error) {
    console.error('Error fetching candidate profile:', error);
    res.status(500).json({ message: error.message });
  }
});

// Download candidate resume
router.get('/:id/resume', auth, async (req, res) => {
  try {
    const candidate = await CandidateProfile.findById(req.params.id);

    if (!candidate || !candidate.resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    const fs = require('fs');
    const path = require('path');
    const filePath = path.join('uploads', candidate.resume.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Resume file not found' });
    }

    res.download(filePath, candidate.resume.originalName);
  } catch (error) {
    console.error('Error downloading resume:', error);
    res.status(500).json({ message: error.message });
  }
});

// Bulk actions
router.post('/bulk-actions', auth, async (req, res) => {
  try {
    const { action, candidateIds } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds)) {
      return res.status(400).json({ message: 'Candidate IDs are required' });
    }

    switch (action) {
      case 'export':
        const candidates = await CandidateProfile.find({ _id: { $in: candidateIds } })
          .populate('skills.skill', 'name displayName')
          .select('-password');

        const exportData = candidates.map(candidate => ({
          Name: `${candidate.firstName} ${candidate.lastName}`,
          Email: candidate.email,
          Phone: candidate.phone,
          Location: candidate.location ? `${candidate.location.city}, ${candidate.location.state}` : '',
          Experience: candidate.yearsOfExperience,
          Skills: candidate.skills.map(s => s.skill?.displayName || s.skill?.name || 'Unknown').join('; '),
          ProfileCompleteness: candidate.profileCompleteness,
          Created: candidate.createdAt
        }));

        res.json({ data: exportData, count: exportData.length });
        break;

      case 'tag':
        // In a real app, you'd add tags to candidates
        res.json({ message: `Tagged ${candidateIds.length} candidates` });
        break;

      default:
        res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Analyze candidate profile for a specific job (admin)
router.post('/:id/analyze/:jobId', auth, async (req, res) => {
  try {
    const candidate = await CandidateProfile.findById(req.params.id);
    const Job = require('../models/Job');
    const job = await Job.findById(req.params.jobId);

    if (!candidate || !job) {
      return res.status(404).json({ message: 'Candidate or Job not found' });
    }

    const AIProcessor = require('../utils/aiProcessor');
    const matchScore = AIProcessor.calculateMatchScore(
      candidate.skills.map(s => s.skill?.name || s.skill?.displayName || 'Unknown'),
      job.requiredSkills,
      job.niceToHaveSkills,
      candidate,
      job
    );

    // Enhanced AI analysis with multi-dimensional insights
    const technicalMatch = AIProcessor.calculateTechnicalMatch(
      candidate.skills.map(s => s.skill?.name || s.skill?.displayName || 'Unknown'),
      job.requiredSkills,
      job.niceToHaveSkills
    );
    const experienceFit = AIProcessor.calculateExperienceMatch(candidate, job);
    const culturalFit = AIProcessor.calculateCulturalFit(candidate, job);
    const successProbability = AIProcessor.calculateSuccessProbability(candidate, job);

    // Update candidate profile with comprehensive AI analysis
    candidate.aiAnalysis = {
      matchScore,
      technicalMatch,
      experienceFit,
      culturalFit,
      successProbability,
      skillBreakdown: candidate.skills.map(skillEntry => ({
        skill: skillEntry.skill?.name || skillEntry.skill?.displayName || 'Unknown',
        relevance: job.requiredSkills.some(reqSkill => AIProcessor.isSkillMatch(skillEntry.skill?.name || skillEntry.skill?.displayName || '', reqSkill)) ? 1 :
                  job.niceToHaveSkills.some(niceSkill => AIProcessor.isSkillMatch(skillEntry.skill?.name || skillEntry.skill?.displayName || '', niceSkill)) ? 0.7 : 0.3,
        experience: skillEntry.yearsOfExperience || 0
      })),
      biasScore: 95, // Simulated bias score
      strengths: candidate.skills
        .filter(skillEntry =>
          job.requiredSkills.some(reqSkill => AIProcessor.isSkillMatch(skillEntry.skill?.name || skillEntry.skill?.displayName || '', reqSkill))
        )
        .slice(0, 3)
        .map(s => s.skill?.displayName || s.skill?.name || 'Unknown'),
      improvements: job.requiredSkills
        .filter(reqSkill =>
          !candidate.skills.some(skillEntry => AIProcessor.isSkillMatch(skillEntry.skill?.name || skillEntry.skill?.displayName || '', reqSkill))
        )
        .slice(0, 3),
      insights: {
        overQualified: (candidate.yearsOfExperience || 0) > (job.experience || 0) * 1.5,
        underQualified: (candidate.yearsOfExperience || 0) < (job.experience || 0) * 0.7,
        skillGap: job.requiredSkills.filter(reqSkill =>
          !candidate.skills.some(skillEntry => AIProcessor.isSkillMatch(skillEntry.skill?.name || skillEntry.skill?.displayName || '', reqSkill))
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
    console.error('Error analyzing candidate profile:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;