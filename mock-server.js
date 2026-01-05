// Simple mock server for testing without Supabase
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// Mock users database - passwords will be hashed on startup
let mockUsers = [];

// Initialize mock users with properly hashed passwords
async function initMockUsers() {
  const salt = await bcrypt.genSalt(10);
  
  mockUsers = [
    {
      id: '1',
      name: 'John Doe',
      admission_no: 'B32/GV/12242/2022',
      email: 'john.doe@drizaikn.edu',
      password_hash: await bcrypt.hash('admin123', salt),
      role: 'Student',
      course: 'Computer Science',
      avatar_url: 'https://ui-avatars.com/api/?name=John+Doe&background=4f46e5&color=fff',
      security_question_1: 'What is your favorite color?',
      security_answer_1: await bcrypt.hash('blue', salt),
      security_question_2: 'What is your pet name?',
      security_answer_2: await bcrypt.hash('buddy', salt)
    },
    {
      id: '2',
      name: 'Dr. Jane Smith',
      admission_no: 'LEC-001',
      email: 'jane.smith@drizaikn.edu',
      password_hash: await bcrypt.hash('lecturer123', salt),
      role: 'Lecturer',
      course: null,
      avatar_url: 'https://ui-avatars.com/api/?name=Dr+Jane+Smith&background=10b981&color=fff',
      security_question_1: 'What city were you born in?',
      security_answer_1: await bcrypt.hash('nairobi', salt),
      security_question_2: 'What is your mother maiden name?',
      security_answer_2: await bcrypt.hash('johnson', salt)
    },
    {
      id: '3',
      name: 'Library Admin',
      admission_no: 'ADMIN001',
      email: 'admin@drizaikn.edu',
      password_hash: await bcrypt.hash('admin123', salt),
      role: 'Admin',
      course: null,
      avatar_url: 'https://ui-avatars.com/api/?name=Library+Admin&background=dc2626&color=fff',
      security_question_1: 'What is your favorite book?',
      security_answer_1: await bcrypt.hash('1984', salt),
      security_question_2: 'What is your first school?',
      security_answer_2: await bcrypt.hash('primary', salt)
    }
  ];
  
  console.log('✅ Mock users initialized with hashed passwords');
}

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { admissionNo, password, loginAs } = req.body;
  
  try {
    const user = mockUsers.find(u => u.admission_no === admissionNo);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Role validation
    if (loginAs === 'student' && user.role !== 'Student') {
      return res.status(403).json({ 
        error: 'Access denied. This is not a student account.',
        wrongRole: true
      });
    } else if (loginAs === 'lecturer' && !['Lecturer', 'Faculty'].includes(user.role)) {
      return res.status(403).json({ 
        error: 'Access denied. This is not a lecturer account.',
        wrongRole: true
      });
    } else if (loginAs === 'admin' && user.role !== 'Admin') {
      return res.status(403).json({ 
        error: 'Access denied. This is not a library staff account.',
        wrongRole: true
      });
    }
    
    // Return user data
    const userData = {
      id: user.id,
      name: user.name,
      admissionNo: user.admission_no,
      email: user.email,
      role: user.role,
      course: user.course,
      avatarUrl: user.avatar_url
    };
    
    res.json({ user: userData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get security questions
app.get('/api/auth/security-questions/:admissionNo', async (req, res) => {
  const { admissionNo } = req.params;
  
  try {
    const user = mockUsers.find(u => u.admission_no === admissionNo);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.security_question_1 || !user.security_question_2) {
      return res.status(400).json({ error: 'Security questions not set for this account.' });
    }
    
    res.json({ 
      questions: { 
        question1: user.security_question_1, 
        question2: user.security_question_2 
      } 
    });
  } catch (error) {
    console.error('Get security questions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login with security questions
app.post('/api/auth/login-security', async (req, res) => {
  const { admissionNo, answer1, answer2 } = req.body;
  
  try {
    const user = mockUsers.find(u => u.admission_no === admissionNo);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!user.security_answer_1 || !user.security_answer_2) {
      return res.status(400).json({ error: 'Security questions not set for this account.' });
    }
    
    // Check answers
    const isValid1 = await bcrypt.compare(answer1.toLowerCase().trim(), user.security_answer_1);
    const isValid2 = await bcrypt.compare(answer2.toLowerCase().trim(), user.security_answer_2);
    
    if (!isValid1 || !isValid2) {
      return res.status(401).json({ error: 'Incorrect security answers' });
    }
    
    // Return user data
    const userData = {
      id: user.id,
      name: user.name,
      admissionNo: user.admission_no,
      email: user.email,
      role: user.role,
      course: user.course,
      avatarUrl: user.avatar_url
    };
    
    res.json({ user: userData });
  } catch (error) {
    console.error('Security login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password with security questions
app.post('/api/auth/reset-password-security', async (req, res) => {
  const { admissionNo, answer1, answer2, newPassword } = req.body;
  
  try {
    const user = mockUsers.find(u => u.admission_no === admissionNo);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check answers
    const isValid1 = await bcrypt.compare(answer1.toLowerCase().trim(), user.security_answer_1);
    const isValid2 = await bcrypt.compare(answer2.toLowerCase().trim(), user.security_answer_2);
    
    if (!isValid1 || !isValid2) {
      return res.status(401).json({ error: 'Incorrect security answers' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);
    
    // Update password (in real app, this would update database)
    user.password_hash = newPasswordHash;
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Initialize users and start server
initMockUsers().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Mock server running on http://localhost:${PORT}`);
    console.log('📚 Drizaikn Digital Library - Mock Authentication Server');
    console.log('');
    console.log('Test Accounts:');
    console.log('Student: B32/GV/12242/2022 / admin123');
    console.log('  Security: blue, buddy');
    console.log('Lecturer: LEC-001 / lecturer123');
    console.log('  Security: nairobi, johnson');
    console.log('Admin: ADMIN001 / admin123');
    console.log('  Security: 1984, primary');
  });
});