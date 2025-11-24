const express = require('express');
const Candidate = require('../models/Candidate');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all candidates with filtering and search
router.get('/', auth, async (req, res) => {
  try {
    const { search, skills, location, experience, page = 1, limit = 10 } = req.query;

    let query = { addedBy: req.user.id };

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by skills
    if (skills) {
      const skillArray = skills.split(',').map(s => s.trim());
      query.skills = { $in: skillArray };
    }

    // Filter by location
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Filter by experience
    if (experience) {
      const expNum = parseInt(experience);
      query.experience = { $gte: expNum };
    }

    const candidates = await Candidate.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Candidate.countDocuments(query);

    res.json({
      candidates,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get candidate by ID
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

// Export candidates data
router.get('/export/csv', auth, async (req, res) => {
  try {
    const candidates = await Candidate.find({ addedBy: req.user.id });

    // Simple CSV export (in production, use a library like csv-writer)
    const csvData = candidates.map(c => ({
      Name: c.name,
      Email: c.email,
      Phone: c.phone,
      Location: c.location,
      Experience: c.experience,
      Skills: c.skills.join('; '),
      Resume: c.resume,
      Created: c.createdAt
    }));

    res.json(csvData); // In production, send actual CSV file
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;