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
      name: 'John Reader',
      username: 'reader1',
      email: 'reader@drizaikn.com',
      password_hash: await bcrypt.hash('reader123', salt),
      role: 'Reader',
      avatar_url: 'https://ui-avatars.com/api/?name=John+Reader&background=4f46e5&color=fff',
      security_question_1: 'What is your favorite color?',
      security_answer_1: await bcrypt.hash('blue', salt),
      security_question_2: 'What is your pet name?',
      security_answer_2: await bcrypt.hash('buddy', salt)
    },
    {
      id: '2',
      name: 'Jane Premium',
      username: 'premium1',
      email: 'premium@drizaikn.com',
      password_hash: await bcrypt.hash('premium123', salt),
      role: 'Premium',
      avatar_url: 'https://ui-avatars.com/api/?name=Jane+Premium&background=10b981&color=fff',
      security_question_1: 'What city were you born in?',
      security_answer_1: await bcrypt.hash('nairobi', salt),
      security_question_2: 'What is your mother maiden name?',
      security_answer_2: await bcrypt.hash('johnson', salt)
    },
    {
      id: '3',
      name: 'Library Admin',
      username: 'admin1',
      email: 'admin@drizaikn.com',
      password_hash: await bcrypt.hash('admin123', salt),
      role: 'Admin',
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
  const { username, password, loginAs } = req.body;
  
  try {
    const user = mockUsers.find(u => u.username === username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Role validation
    if (loginAs === 'reader' && user.role !== 'Reader') {
      return res.status(403).json({ 
        error: 'Access denied. This is not a reader account.',
        wrongRole: true
      });
    } else if (loginAs === 'premium' && user.role !== 'Premium') {
      return res.status(403).json({ 
        error: 'Access denied. This is not a premium account.',
        wrongRole: true
      });
    } else if (loginAs === 'admin' && user.role !== 'Admin') {
      return res.status(403).json({ 
        error: 'Access denied. This is not an admin account.',
        wrongRole: true
      });
    }
    
    // Return user data
    const userData = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatar_url
    };
    
    res.json({ user: userData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get security questions
app.get('/api/auth/security-questions/:username', async (req, res) => {
  const { username } = req.params;
  
  try {
    const user = mockUsers.find(u => u.username === username);
    
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
  const { username, answer1, answer2 } = req.body;
  
  try {
    const user = mockUsers.find(u => u.username === username);
    
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
      username: user.username,
      email: user.email,
      role: user.role,
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
  const { username, answer1, answer2, newPassword } = req.body;
  
  try {
    const user = mockUsers.find(u => u.username === username);
    
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
    console.log('📚 DRIZAIKN Digital Library - Mock Authentication Server');
    console.log('');
    console.log('Test Accounts:');
    console.log('Reader:  username: reader1  / password: reader123');
    console.log('  Security: blue, buddy');
    console.log('Premium: username: premium1 / password: premium123');
    console.log('  Security: nairobi, johnson');
    console.log('Admin:   username: admin1   / password: admin123');
    console.log('  Security: 1984, primary');
  });
});