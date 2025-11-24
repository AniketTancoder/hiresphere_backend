const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const CandidateProfile = require('../models/CandidateProfile');
const Skill = require('../models/Skill');

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

const authenticateCandidate = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.candidate = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

router.post('/register', upload.single('resume'), async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      location,
      currentTitle,
      currentCompany,
      yearsOfExperience,
      skills: skillsData,
      education,
      experience
    } = req.body;

    const existingCandidate = await CandidateProfile.findOne({ email: email.toLowerCase() });
    if (existingCandidate) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let processedSkills = [];
    if (skillsData) {
      try {
        const skillsArray = JSON.parse(skillsData);
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

    let resumeData = null;
    if (req.file) {
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

    const candidate = new CandidateProfile({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      location: location ? JSON.parse(location) : undefined,
      currentTitle,
      currentCompany,
      yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : undefined,
      skills: processedSkills,
      education: education ? JSON.parse(education) : [],
      experience: experience ? JSON.parse(experience) : [],
      resume: resumeData,
      profileCompleteness: 0
    });

    const verificationToken = jwt.sign(
      { id: candidate._id, email: candidate.email, type: 'email_verification' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    candidate.emailVerificationToken = verificationToken;
    candidate.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await candidate.save();

    console.log(`Email verification token for ${candidate.email}: ${verificationToken}`);

    const token = jwt.sign(
      { id: candidate._id, email: candidate.email, type: 'candidate' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    const candidateResponse = {
      id: candidate._id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      profileCompleteness: candidate.profileCompleteness,
      emailVerified: candidate.emailVerified,
      createdAt: candidate.createdAt
    };

    res.status(201).json({
      message: 'Candidate registered successfully. Please check your email to verify your account.',
      token,
      candidate: candidateResponse,
      verificationToken: verificationToken
    });

  } catch (error) {
    console.error('Candidate registration error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const candidate = await CandidateProfile.findOne({ email: email.toLowerCase() });
    if (!candidate) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, candidate.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    candidate.lastActive = new Date();
    await candidate.save();

    const token = jwt.sign(
      { id: candidate._id, email: candidate.email, type: 'candidate' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    const candidateResponse = {
      id: candidate._id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      email: candidate.email,
      profileCompleteness: candidate.profileCompleteness,
      lastActive: candidate.lastActive
    };

    res.json({
      message: 'Login successful',
      token,
      candidate: candidateResponse
    });

  } catch (error) {
    console.error('Candidate login error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/profile', authenticateCandidate, async (req, res) => {
  try {
    const candidate = await CandidateProfile.findById(req.candidate.id)
      .populate('skills.skill', 'name displayName category')
      .select('-password');

    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    res.json(candidate);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/profile', authenticateCandidate, upload.single('resume'), async (req, res) => {
  try {
    const candidate = await CandidateProfile.findById(req.candidate.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const {
      firstName,
      lastName,
      phone,
      location,
      currentTitle,
      currentCompany,
      yearsOfExperience,
      skills: skillsData,
      education,
      experience,
      profileVisibility,
      openToOpportunities,
      preferredJobTypes,
      preferredLocations,
      willingToRelocate,
      emailNotifications
    } = req.body;

    if (firstName) candidate.firstName = firstName;
    if (lastName) candidate.lastName = lastName;
    if (phone !== undefined) candidate.phone = phone;
    if (location) candidate.location = JSON.parse(location);
    if (currentTitle !== undefined) candidate.currentTitle = currentTitle;
    if (currentCompany !== undefined) candidate.currentCompany = currentCompany;
    if (yearsOfExperience !== undefined) candidate.yearsOfExperience = parseInt(yearsOfExperience);

    if (skillsData) {
      try {
        const skillsArray = JSON.parse(skillsData);
        candidate.skills = [];
        for (const skillData of skillsArray) {
          if (skillData && skillData.skill) {
            const skill = await Skill.findOne({ name: skillData.skill.toLowerCase() });
            if (skill) {
              candidate.skills.push({
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
        console.warn('Error parsing skills data for update:', error.message);
      }
    }

    if (education) candidate.education = JSON.parse(education);
    if (experience) candidate.experience = JSON.parse(experience);

    if (profileVisibility) candidate.profileVisibility = profileVisibility;
    if (openToOpportunities !== undefined) candidate.openToOpportunities = openToOpportunities;
    if (preferredJobTypes) candidate.preferredJobTypes = JSON.parse(preferredJobTypes);
    if (preferredLocations) candidate.preferredLocations = JSON.parse(preferredLocations);
    if (willingToRelocate !== undefined) candidate.willingToRelocate = willingToRelocate;
    if (emailNotifications) candidate.emailNotifications = JSON.parse(emailNotifications);

    if (req.file) {
      const fs = require('fs');
      const path = require('path');
      const filename = Date.now() + '-' + req.file.originalname;
      const filepath = path.join('uploads', filename);

      fs.writeFileSync(filepath, req.file.buffer);
      candidate.resume = {
        filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date()
      };
    }

    await candidate.save();

    const updatedCandidate = await CandidateProfile.findById(candidate._id)
      .populate('skills.skill', 'name displayName category')
      .select('-password');

    res.json({
      message: 'Profile updated successfully',
      candidate: updatedCandidate
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/applications', authenticateCandidate, async (req, res) => {
  try {
    const applications = await require('../models/JobApplication')
      .find({ candidate: req.candidate.id })
      .populate('job', 'title company location')
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const candidate = await CandidateProfile.findOne({ email: email.toLowerCase() });
    if (!candidate) {
      return res.json({ message: 'If an account with this email exists, a password reset link has been sent.' });
    }

    const resetToken = jwt.sign(
      { id: candidate._id, type: 'password_reset' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '1h' }
    );

    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({
      message: 'If an account with this email exists, a password reset link has been sent.',
      resetToken: resetToken
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ message: 'Invalid reset token' });
    }

    const candidate = await CandidateProfile.findById(decoded.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    candidate.password = hashedPassword;
    await candidate.save();

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }
    res.status(500).json({ message: error.message });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    if (decoded.type !== 'email_verification') {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    const candidate = await CandidateProfile.findById(decoded.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    if (candidate.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    candidate.emailVerified = true;
    await candidate.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }
    res.status(500).json({ message: error.message });
  }
});

router.post('/resend-verification', authenticateCandidate, async (req, res) => {
  try {
    const candidate = await CandidateProfile.findById(req.candidate.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    if (candidate.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    const verificationToken = jwt.sign(
      { id: candidate._id, email: candidate.email, type: 'email_verification' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    console.log(`Email verification token for ${candidate.email}: ${verificationToken}`);

    res.json({
      message: 'Verification email sent',
      verificationToken: verificationToken
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/change-password', authenticateCandidate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const candidate = await CandidateProfile.findById(req.candidate.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, candidate.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    candidate.password = hashedNewPassword;
    await candidate.save();

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;