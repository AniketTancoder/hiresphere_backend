const mongoose = require('mongoose');
const Job = require('../models/Job');

async function updateExistingJobs() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/talentsphere');

    console.log('Updating existing jobs with new fields...');

    // Update all jobs that don't have the new fields
    const result = await Job.updateMany(
      {
        $or: [
          { jobType: { $exists: false } },
          { experienceLevel: { $exists: false } },
          { industry: { $exists: false } },
          { remote: { $exists: false } },
          { companyDescription: { $exists: false } },
          { companySize: { $exists: false } }
        ]
      },
      {
        $set: {
          jobType: 'full-time',
          experienceLevel: 'entry',
          industry: 'Technology',
          remote: false,
          companyDescription: 'Leading technology company focused on innovation and growth.',
          companySize: '50-200 employees'
        }
      }
    );

    console.log(`Updated ${result.modifiedCount} jobs with default values`);

    // Also update jobs with salary information
    const salaryResult = await Job.updateMany(
      {
        salaryMin: { $exists: true },
        salary: { $exists: false }
      },
      [
        {
          $set: {
            salary: {
              amount: '$salaryMin',
              currency: 'USD',
              period: 'yearly'
            }
          }
        }
      ]
    );

    console.log(`Updated ${salaryResult.modifiedCount} jobs with salary object structure`);

    console.log('Job update completed successfully!');
  } catch (error) {
    console.error('Error updating jobs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  updateExistingJobs();
}

module.exports = updateExistingJobs;