require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Subject = require('./models/Subject');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/exam-system';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data (optional - comment out in production)
    // await User.deleteMany({});
    // await Subject.deleteMany({});

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.findOneAndUpdate(
      { username: 'admin' },
      {
        firstName: 'System',
        lastName: 'Administrator',
        className: 'N/A',
        subjects: [],
        username: 'admin',
        password: adminPassword,
        role: 'admin',
        status: 'active'
      },
      { upsert: true, new: true }
    );
    console.log('Admin user created/updated:', admin.username);

    // Create sample student users
    // Demo talabalar: ism/familiya/sinf bo'sh (talaba o'zi kiritadi)
    const students = [
      { subjects: ['Matematika', 'Fizika'], username: 'nis@11111111' },
      { subjects: ['Kimyo'],               username: 'nis@22222222' },
    ];

    for (const studentData of students) {
      const password = await bcrypt.hash('password123', 10);
      await User.findOneAndUpdate(
        { username: studentData.username },
        {
          ...studentData,
          firstName: '',
          lastName: '',
          className: '',
          password,
          role: 'student',
          status: 'active'
        },
        { upsert: true }
      );
      console.log(`Student created: ${studentData.username}`);
    }

    // Create sample subjects with questions
    const mathematicsSubject = await Subject.findOneAndUpdate(
      { name: 'Matematika' },
      {
        name: 'Matematika',
        description: 'Basic mathematics test covering algebra and geometry',
        totalTimeLimit: 10, // 10 minutes
        isActive: true,
        questions: [
          {
            text: 'What is the value of x in the equation 2x + 5 = 15?',
            options: ['x = 5', 'x = 10', 'x = 7.5', 'x = 2.5'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'What is the area of a circle with radius 5 cm? (Use π ≈ 3.14)',
            options: ['78.5 cm²', '31.4 cm²', '15.7 cm²', '25 cm²'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'Solve: 3(x - 2) = 2(x + 1)',
            options: ['x = 8', 'x = 6', 'x = 4', 'x = 10'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'What is the square root of 144?',
            options: ['12', '14', '10', '16'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'If a triangle has angles 30°, 60°, and 90°, what type of triangle is it?',
            options: ['Right triangle', 'Equilateral triangle', 'Isosceles triangle', 'Obtuse triangle'],
            correctIndex: 0,
            timeLimit: 60
          }
        ]
      },
      { upsert: true, new: true }
    );
    console.log('Matematika subject created');

    const physicsSubject = await Subject.findOneAndUpdate(
      { name: 'Fizika' },
      {
        name: 'Fizika',
        description: 'Basic physics test covering mechanics and energy',
        totalTimeLimit: 15, // 15 minutes
        isActive: true,
        questions: [
          {
            text: 'What is the SI unit of force?',
            options: ['Newton', 'Joule', 'Watt', 'Pascal'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'What is the formula for kinetic energy?',
            options: ['KE = ½mv²', 'KE = mv', 'KE = mgh', 'KE = Fd'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'What is the acceleration due to gravity on Earth?',
            options: ['9.8 m/s²', '10.5 m/s²', '8.9 m/s²', '9.2 m/s²'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'Which law states that for every action there is an equal and opposite reaction?',
            options: ["Newton's Third Law", "Newton's First Law", "Newton's Second Law", "Law of Conservation of Energy"],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'What is the speed of light in vacuum?',
            options: ['3 × 10⁸ m/s', '3 × 10⁶ m/s', '3 × 10⁴ m/s', '3 × 10² m/s'],
            correctIndex: 0,
            timeLimit: 60
          }
        ]
      },
      { upsert: true, new: true }
    );
    console.log('Fizika subject created');

    const chemistrySubject = await Subject.findOneAndUpdate(
      { name: 'Kimyo' },
      {
        name: 'Kimyo',
        description: 'Basic chemistry test covering elements and reactions',
        totalTimeLimit: 12, // 12 minutes
        isActive: true,
        questions: [
          {
            text: 'What is the chemical symbol for Gold?',
            options: ['Au', 'Ag', 'Fe', 'Cu'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'What is the pH value of pure water at 25°C?',
            options: ['7', '0', '14', '5'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'Which element has atomic number 1?',
            options: ['Hydrogen', 'Helium', 'Oxygen', 'Carbon'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'What is the molecular formula of water?',
            options: ['H₂O', 'HO₂', 'H₂O₂', 'OH'],
            correctIndex: 0,
            timeLimit: 60
          },
          {
            text: 'What type of bond is formed between sodium and chlorine in NaCl?',
            options: ['Ionic bond', 'Covalent bond', 'Metallic bond', 'Hydrogen bond'],
            correctIndex: 0,
            timeLimit: 60
          }
        ]
      },
      { upsert: true, new: true }
    );
    console.log('Kimyo subject created');

    console.log('\n=== Seed completed successfully ===');
    console.log('\nKirish ma\'lumotlari:');
    console.log('Admin:   username=admin,        password=admin123');
    console.log('Talaba1: username=nis@11111111, password=password123');
    console.log('Talaba2: username=nis@22222222, password=password123');
    
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
