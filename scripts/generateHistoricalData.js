const mongoose = require('mongoose');
const PipelineHealth = require('../models/PipelineHealth');
const PipelineHealthCalculator = require('../utils/pipelineHealthCalculator');

async function generateHistoricalData(userId, days = 30) {
  try {
    console.log(`Generating ${days} days of historical pipeline health data for user ${userId}...`);

    // Clear existing data for this user to avoid duplicates
    await PipelineHealth.deleteMany({ calculatedBy: userId });
    console.log('Cleared existing historical data');

    const records = [];

    for (let i = 0; i <= days; i++) {
      // Create date for each day, starting from (days) ago to today
      const date = new Date();
      date.setDate(date.getDate() - (days - i)); // This ensures we get days 0, 1, 2, ..., days
      date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

      // Generate realistic varying data to simulate real trends
      // Make data more realistic by trending over time
      const dayProgress = i / days; // 0 to 1 as we go from past to present
      const baseCandidates = 5 + Math.floor(Math.random() * 8) + Math.floor(dayProgress * 5); // 5-18 candidates, trending up
      const baseApplications = 8 + Math.floor(Math.random() * 15) + Math.floor(dayProgress * 7); // 8-30 applications, trending up
      const baseTimeToFill = 45 - Math.floor(dayProgress * 15) + Math.floor(Math.random() * 20); // 30-60 days, trending down
      const openPositions = 2 + Math.floor(Math.random() * 3); // 2-5 positions

      // Calculate metrics using the same logic as the calculator
      const candidateVolumeHealth = Math.min(100, Math.max(0, Math.round((baseCandidates / (openPositions * 10)) * 100)));
      const applicationRateHealth = Math.min(100, Math.max(0, Math.round((baseApplications / 20) * 100)));
      const timeToFillHealth = Math.max(0, Math.min(100, Math.round(100 - ((baseTimeToFill - 30) / 30) * 100)));
      const diversityHealth = 25 + Math.floor(Math.random() * 50); // 25-75% diversity health

      // Calculate overall health score
      const healthScore = Math.round(
        (candidateVolumeHealth * 0.4) +
        (applicationRateHealth * 0.3) +
        (timeToFillHealth * 0.2) +
        (diversityHealth * 0.1)
      );

      // Determine status
      let status = 'critical';
      if (healthScore >= 80) status = 'healthy';
      else if (healthScore >= 60) status = 'warning';

      const healthData = {
        timestamp: date,
        healthScore: healthScore,
        status: status,
        metrics: {
          activeCandidates: baseCandidates,
          weeklyApplications: baseApplications,
          avgTimeToFill: baseTimeToFill,
          openPositions: openPositions,
          candidateToJobRatio: parseFloat((baseCandidates / openPositions).toFixed(2)),
          diversityRatio: parseFloat((0.15 + Math.random() * 0.3).toFixed(2)), // 15-45% diversity
          candidateVolumeHealth: candidateVolumeHealth,
          applicationRateHealth: applicationRateHealth,
          timeToFillHealth: timeToFillHealth,
          diversityHealth: diversityHealth,
        },
        triggers: [],
        recommendations: [],
        calculatedBy: userId
      };

      records.push(healthData);
    }

    // Insert all records
    await PipelineHealth.insertMany(records);
    console.log(`✅ Generated ${records.length} historical records with realistic trending data`);

    return records;
  } catch (error) {
    console.error('Error generating historical data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const userId = process.argv[2] || '64f1b2c3d4e5f6789abc1234'; // Default test user
  const days = parseInt(process.argv[3]) || 30;

  mongoose.connect('mongodb://localhost:27017/talent-sphere')
    .then(() => generateHistoricalData(userId, days))
    .then(() => {
      console.log('Historical data generation complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to generate historical data:', error);
      process.exit(1);
    });
}

module.exports = generateHistoricalData;