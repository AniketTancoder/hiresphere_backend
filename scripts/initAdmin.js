const User = require('../models/User');
const bcrypt = require('bcryptjs');

const initializeAdmin = async () => {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@talentsphere.com' });

    if (!existingAdmin) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);

      const adminUser = new User({
        name: 'System Administrator',
        email: 'admin@talentsphere.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });

      await adminUser.save();
      console.log('✅ Default admin user created: admin@talentsphere.com / admin123');
    } else {
      console.log('ℹ️  Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error initializing admin user:', error);
  }
};

module.exports = initializeAdmin;