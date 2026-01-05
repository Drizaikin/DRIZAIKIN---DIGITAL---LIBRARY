// server.js
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ WARNING: SUPABASE_URL or SUPABASE_KEY is missing. Database features will fail.");
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Supabase client initialized.");
  } catch (err) {
    console.error("❌ Failed to initialize Supabase client:", err.message);
  }
}

// OpenRouter Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite';
const OPENROUTER_EXTRACTION_MODEL = 'openai/gpt-4o-mini'; // More capable model for metadata extraction

if (!OPENROUTER_API_KEY) {
  console.warn("⚠️ WARNING: OPENROUTER_API_KEY is missing. AI features will fail.");
} else {
  console.log("✅ OpenRouter API configured.");
}

// Helper to check DB connection
const checkDb = (res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Database configuration missing on server.' });
  }
  return null;
};

// OpenRouter chat function with memory
async function chatWithOpenRouter(userMessage, userContext = {}, chatHistory = []) {
  const { name, course, interests, role } = userContext;
  
  // Build personalized context
  let personalContext = '';
  if (name || course || interests) {
    personalContext = '\n\nStudent Context:';
    if (name) personalContext += `\n- Name: ${name}`;
    if (course) personalContext += `\n- Course of Study: ${course}`;
    if (interests) personalContext += `\n- Additional Interests: ${interests}`;
    if (role) personalContext += `\n- Role: ${role}`;
    personalContext += '\n\nUse this information to provide personalized book recommendations and research guidance relevant to their field of study and interests.';
  }
  
  // Add memory context if there's chat history
  let memoryContext = '';
  if (chatHistory.length > 0) {
    memoryContext = '\n\nYou have an ongoing conversation with this student. Use the conversation history to provide contextual and personalized responses. Remember what they asked before and build upon previous discussions.';
  }

  const systemPrompt = `You are the AI Librarian for Drizaikn Digital Library - Architect of Knowledge. 

Your Role:
- Assist students with finding books, understanding library policies, and academic research
- Help lecturers with teaching resources, course materials, and pedagogical support
- Help library staff (admins) with system information and patron assistance
- Provide personalized recommendations based on user's role and academic field

Library Policies:
- Loan period: 14 days
- Late fine: KES 50 per day
- Maximum books: 5 for students, 5 for lecturers, 10 for faculty
- Renewals: Up to 2 times per book (7 days each)
- Waitlist: Available for borrowed books
${personalContext}
${memoryContext}

User Roles:
- **Student**: Provide academic resources, study materials, and course-related books
- **Lecturer**: Provide teaching resources, lecture preparation materials, pedagogical tips, and course design support. Help with effective teaching methodologies, student engagement strategies, assessment techniques, and curriculum development.
- **Library Staff (Admin)**: Provide system information, policy clarification, and patron management guidance

Lecturer Support - When assisting lecturers, provide:
1. Teaching methodology suggestions and best practices
2. Course material recommendations aligned with curriculum
3. Effective classroom management and student engagement tips
4. Assessment and evaluation strategies
5. Technology integration in teaching
6. Curriculum development and lesson planning resources
7. Research resources for academic development

Be helpful, concise, and professional. Keep responses brief and to the point.`;

  // Build messages array with history
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    { role: 'user', content: userMessage }
  ];

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Drizaikn Digital Library'
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
}

// --- AUTH ROUTES ---

// Register (Students only)
app.post('/api/auth/register', async (req, res) => {
  if (checkDb(res)) return;

  const { name, email, admissionNo, password, course, securityQuestion1, securityAnswer1, securityQuestion2, securityAnswer2 } = req.body;

  try {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('admission_no', admissionNo)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Admission number already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1A365D&color=fff`;

    // Hash security answers (case-insensitive)
    const answer1Hash = securityAnswer1 ? await bcrypt.hash(securityAnswer1.toLowerCase().trim(), salt) : null;
    const answer2Hash = securityAnswer2 ? await bcrypt.hash(securityAnswer2.toLowerCase().trim(), salt) : null;

    // Insert user - Always create as Student role (admins are created separately by system admin)
    const { data, error } = await supabase
      .from('users')
      .insert([
        { 
          name, 
          email, 
          admission_no: admissionNo, 
          password_hash: passwordHash, 
          avatar_url: avatarUrl,
          course: course || null,
          role: 'Student',
          security_question_1: securityQuestion1 || null,
          security_answer_1: answer1Hash,
          security_question_2: securityQuestion2 || null,
          security_answer_2: answer2Hash
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ 
      user: { 
        id: data.id, 
        name: data.name, 
        admissionNo: data.admission_no, 
        role: data.role, 
        avatarUrl: data.avatar_url,
        course: data.course
      } 
    });

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Get security questions for a user (without answers)
app.get('/api/auth/security-questions/:admissionNo', async (req, res) => {
  if (checkDb(res)) return;
  const { admissionNo } = req.params;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('security_question_1, security_question_2')
      .eq('admission_no', admissionNo)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found.' });
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
  } catch (err) {
    console.error("Get Security Questions Error:", err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Login with security questions
app.post('/api/auth/login-security', async (req, res) => {
  if (checkDb(res)) return;
  const { admissionNo, answer1, answer2, loginAs } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('admission_no', admissionNo)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    if (!user.security_answer_1 || !user.security_answer_2) {
      return res.status(400).json({ error: 'Security questions not set for this account.' });
    }

    // Verify answers (case-insensitive)
    const answer1Match = await bcrypt.compare(answer1.toLowerCase().trim(), user.security_answer_1);
    const answer2Match = await bcrypt.compare(answer2.toLowerCase().trim(), user.security_answer_2);

    if (!answer1Match || !answer2Match) {
      return res.status(400).json({ error: 'Security answers do not match.' });
    }

    // Role validation
    if (loginAs === 'student' && user.role !== 'Student') {
      return res.status(403).json({ error: 'Access denied. This is not a student account.' });
    } else if (loginAs === 'lecturer' && user.role !== 'Lecturer' && user.role !== 'Faculty') {
      return res.status(403).json({ error: 'Access denied. This is not a lecturer account.' });
    } else if (loginAs === 'admin' && user.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. This is not a library staff account.' });
    }

    res.json({ 
      user: { id: user.id, name: user.name, admissionNo: user.admission_no, role: user.role, avatarUrl: user.avatar_url, course: user.course } 
    });
  } catch (err) {
    console.error("Security Login Error:", err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Verify security answers (for password reset flow)
app.post('/api/auth/verify-security-answers', async (req, res) => {
  if (checkDb(res)) return;
  const { admissionNo, answer1, answer2 } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('security_answer_1, security_answer_2')
      .eq('admission_no', admissionNo)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    if (!user.security_answer_1 || !user.security_answer_2) {
      return res.status(400).json({ error: 'Security questions not set for this account.' });
    }

    const answer1Match = await bcrypt.compare(answer1.toLowerCase().trim(), user.security_answer_1);
    const answer2Match = await bcrypt.compare(answer2.toLowerCase().trim(), user.security_answer_2);

    if (!answer1Match || !answer2Match) {
      return res.status(400).json({ error: 'Security answers do not match.', verified: false });
    }

    res.json({ verified: true });
  } catch (err) {
    console.error("Verify Security Answers Error:", err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Reset password using security questions
app.post('/api/auth/reset-password-security', async (req, res) => {
  if (checkDb(res)) return;
  const { admissionNo, answer1, answer2, newPassword } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, security_answer_1, security_answer_2')
      .eq('admission_no', admissionNo)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'User not found.' });
    }

    // Verify answers again for security
    const answer1Match = await bcrypt.compare(answer1.toLowerCase().trim(), user.security_answer_1);
    const answer2Match = await bcrypt.compare(answer2.toLowerCase().trim(), user.security_answer_2);

    if (!answer1Match || !answer2Match) {
      return res.status(400).json({ error: 'Security answers do not match.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', user.id);

    if (updateError) throw updateError;

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error("Reset Password Security Error:", err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  if (checkDb(res)) return;
  const { email, admissionNo } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('admission_no', admissionNo)
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'No account found with this admission number and email combination.' });
    }

    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const resetExpiry = new Date(Date.now() + 3600000).toISOString();

    const { error: updateError } = await supabase
      .from('users')
      .update({ reset_token: resetToken, reset_token_expiry: resetExpiry })
      .eq('id', user.id);

    if (updateError) throw updateError;

    console.log(`Password reset requested for ${user.email}. Token: ${resetToken}`);

    res.json({ success: true, message: 'Password reset instructions have been sent to your email.' });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ error: 'Server error processing request.' });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  if (checkDb(res)) return;
  const { token, newPassword } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, reset_token_expiry')
      .eq('reset_token', token)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, reset_token: null, reset_token_expiry: null })
      .eq('id', user.id);

    if (updateError) throw updateError;

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  if (checkDb(res)) return;
  const { admissionNo, password, loginAs } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('admission_no', admissionNo)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    // Role-based login validation
    if (loginAs === 'student') {
      // User selected Student login but account is not Student
      if (user.role !== 'Student') {
        return res.status(403).json({ 
          error: 'Access denied. This is not a student account. Please select the correct role to login.',
          wrongRole: true,
          actualRole: user.role,
          attemptedRole: 'Student'
        });
      }
    } else if (loginAs === 'lecturer') {
      // User selected Lecturer login but account is not Lecturer/Faculty
      if (user.role !== 'Lecturer' && user.role !== 'Faculty') {
        return res.status(403).json({ 
          error: 'Access denied. This is not a lecturer account. Please select the correct role to login.',
          wrongRole: true,
          actualRole: user.role,
          attemptedRole: 'Lecturer'
        });
      }
    } else if (loginAs === 'admin') {
      // User selected Library Staff login but account is not Admin
      if (user.role !== 'Admin') {
        return res.status(403).json({ 
          error: 'Access denied. This is not a library staff account. Please select the correct role to login.',
          wrongRole: true,
          actualRole: user.role,
          attemptedRole: 'Admin'
        });
      }
    }

    res.json({ 
      user: { 
        id: user.id, 
        name: user.name, 
        admissionNo: user.admission_no, 
        role: user.role, 
        avatarUrl: user.avatar_url,
        course: user.course
      } 
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// --- BOOKS ROUTES ---

// Get All Books (using the view)
app.get('/api/books', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase
      .from('books_with_status')
      .select('*')
      .order('popularity', { ascending: false });
    
    if (error) {
      console.error("Supabase Error:", error);
      throw error;
    }
    
    // Transform to frontend format
    const books = data.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.category || 'Uncategorized',
      coverUrl: b.cover_url,
      status: b.status,
      popularity: b.popularity,
      copiesAvailable: b.copies_available,
      totalCopies: b.total_copies,
      description: b.description,
      publishedYear: b.published_year,
      addedDate: b.added_date,
      borrowCount: b.borrow_count,
      categoryId: b.category_id,
      isbn: b.isbn,
      callNumber: b.call_number,
      shelfLocation: b.shelf_location,
      floorNumber: b.floor_number,
      softCopyUrl: b.soft_copy_url,
      hasSoftCopy: b.has_soft_copy
    }));

    res.json(books);
  } catch (err) {
    console.error("Fetch Books Error:", err);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Search Books
app.get('/api/books/search', async (req, res) => {
  if (checkDb(res)) return;
  const { q, category } = req.query;
  
  try {
    let query = supabase.from('books_with_status').select('*');
    
    if (q) {
      query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%`);
    }
    
    if (category && category !== 'All') {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query.order('popularity', { ascending: false });
    
    if (error) throw error;
    
    const books = data.map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.category || 'Uncategorized',
      coverUrl: b.cover_url,
      status: b.status,
      popularity: b.popularity,
      copiesAvailable: b.copies_available,
      totalCopies: b.total_copies,
      description: b.description
    }));

    res.json(books);
  } catch (err) {
    console.error("Search Books Error:", err);
    res.status(500).json({ error: 'Failed to search books' });
  }
});

// Get Categories
app.get('/api/categories', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Fetch Categories Error:", err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get Courses
app.get('/api/courses', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('name');
    
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("Fetch Courses Error:", err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get Book Recommendations based on user's course
app.get('/api/books/recommendations/:userId', async (req, res) => {
  if (checkDb(res)) return;
  try {
    // First get user's course
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('course')
      .eq('id', req.params.userId)
      .single();
    
    if (userError || !user?.course) {
      // If no course, return popular books
      const { data: popularBooks, error: popError } = await supabase
        .from('books_with_status')
        .select('*')
        .gt('copies_available', 0)
        .order('popularity', { ascending: false })
        .limit(10);
      
      if (popError) throw popError;
      
      const books = (popularBooks || []).map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        category: b.category || 'Uncategorized',
        coverUrl: b.cover_url,
        status: b.status,
        popularity: b.popularity,
        copiesAvailable: b.copies_available,
        totalCopies: b.total_copies,
        description: b.description
      }));
      
      return res.json(books);
    }
    
    // Get categories relevant to user's course
    const { data: mappings, error: mapError } = await supabase
      .from('course_category_mapping')
      .select(`
        relevance_score,
        categories (id, name),
        courses!inner (name)
      `)
      .eq('courses.name', user.course);
    
    if (mapError) throw mapError;
    
    const categoryIds = (mappings || []).map((m) => m.categories?.id).filter(Boolean);
    
    if (categoryIds.length === 0) {
      // Fallback to popular books
      const { data: popularBooks } = await supabase
        .from('books_with_status')
        .select('*')
        .gt('copies_available', 0)
        .order('popularity', { ascending: false })
        .limit(10);
      
      const books = (popularBooks || []).map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        category: b.category || 'Uncategorized',
        coverUrl: b.cover_url,
        status: b.status,
        popularity: b.popularity,
        copiesAvailable: b.copies_available,
        totalCopies: b.total_copies,
        description: b.description
      }));
      
      return res.json(books);
    }
    
    // Get books from relevant categories
    const { data: recommendedBooks, error: bookError } = await supabase
      .from('books_with_status')
      .select('*')
      .in('category_id', categoryIds)
      .gt('copies_available', 0)
      .order('popularity', { ascending: false })
      .limit(10);
    
    if (bookError) throw bookError;
    
    const books = (recommendedBooks || []).map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      category: b.category || 'Uncategorized',
      coverUrl: b.cover_url,
      status: b.status,
      popularity: b.popularity,
      copiesAvailable: b.copies_available,
      totalCopies: b.total_copies,
      description: b.description
    }));
    
    res.json(books);
  } catch (err) {
    console.error("Fetch Recommendations Error:", err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// --- LOANS ROUTES ---

// Get User Loans (using the view)
app.get('/api/loans/:userId', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase
      .from('active_loans')
      .select('*')
      .eq('user_id', req.params.userId);

    if (error) throw error;

    const loans = data.map(l => ({
      id: l.id,
      checkoutDate: l.checkout_date,
      dueDate: l.due_date,
      isOverdue: l.is_overdue,
      fineAmount: l.fine_amount,
      daysRemaining: l.days_remaining,
      book: {
        id: l.book_id,
        title: l.book_title,
        author: l.book_author,
        coverUrl: l.book_cover,
        category: l.book_category
      }
    }));

    res.json(loans);
  } catch (err) {
    console.error("Fetch Loans Error:", err);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// Borrow a Book
app.post('/api/loans/borrow', async (req, res) => {
  if (checkDb(res)) return;
  const { userId, bookId } = req.body;
  
  try {
    const { data, error } = await supabase.rpc('borrow_book', {
      p_user_id: userId,
      p_book_id: bookId
    });
    
    if (error) throw error;
    
    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }
    
    res.json({ success: true, loanId: data.loan_id });
  } catch (err) {
    console.error("Borrow Error:", err);
    res.status(500).json({ error: 'Failed to borrow book' });
  }
});

// Return a Book
app.post('/api/loans/return', async (req, res) => {
  if (checkDb(res)) return;
  const { loanId } = req.body;
  
  try {
    const { data, error } = await supabase.rpc('return_book', {
      p_loan_id: loanId
    });
    
    if (error) throw error;
    
    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }
    
    res.json({ success: true, fine: data.fine });
  } catch (err) {
    console.error("Return Error:", err);
    res.status(500).json({ error: 'Failed to return book' });
  }
});

// Renew a Loan
app.post('/api/loans/renew', async (req, res) => {
  if (checkDb(res)) return;
  const { loanId } = req.body;
  
  try {
    const { data, error } = await supabase.rpc('renew_loan', {
      p_loan_id: loanId
    });
    
    if (error) throw error;
    
    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }
    
    res.json({ success: true, message: data.message });
  } catch (err) {
    console.error("Renew Error:", err);
    res.status(500).json({ error: 'Failed to renew loan' });
  }
});

// --- WAITLIST ROUTES ---

// Join Waitlist
app.post('/api/waitlist/join', async (req, res) => {
  if (checkDb(res)) return;
  const { userId, bookId } = req.body;
  
  try {
    const { data, error } = await supabase.rpc('join_waitlist', {
      p_user_id: userId,
      p_book_id: bookId
    });
    
    if (error) throw error;
    
    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }
    
    res.json({ success: true, position: data.position });
  } catch (err) {
    console.error("Waitlist Error:", err);
    res.status(500).json({ error: 'Failed to join waitlist' });
  }
});

// --- BORROW REQUESTS ROUTES ---

// POST /api/borrow-requests - Create a new borrow request
// Requirements: 1.1, 1.2, 1.3
app.post('/api/borrow-requests', async (req, res) => {
  if (checkDb(res)) return;
  const { userId, bookId } = req.body;
  
  if (!userId || !bookId) {
    return res.status(400).json({ error: 'userId and bookId are required' });
  }

  try {
    const { data, error } = await supabase.rpc('create_borrow_request', {
      p_user_id: userId,
      p_book_id: bookId
    });
    
    if (error) throw error;
    
    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }
    
    res.status(201).json({ 
      success: true, 
      requestId: data.request_id,
      message: data.message 
    });
  } catch (err) {
    console.error("Create Borrow Request Error:", err);
    res.status(500).json({ error: 'Failed to create borrow request' });
  }
});

// GET /api/borrow-requests/:userId - Get all borrow requests for a user
// Requirements: 2.1, 2.2
app.get('/api/borrow-requests/:userId', async (req, res) => {
  if (checkDb(res)) return;
  const { userId } = req.params;

  try {
    const { data, error } = await supabase
      .from('borrow_requests')
      .select(`
        id,
        user_id,
        book_id,
        status,
        rejection_reason,
        requested_at,
        processed_at,
        processed_by,
        books (
          id,
          title,
          author,
          cover_url,
          category_id,
          categories (name)
        )
      `)
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });

    if (error) throw error;

    const requests = (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      bookId: r.book_id,
      status: r.status,
      rejectionReason: r.rejection_reason,
      requestedAt: r.requested_at,
      processedAt: r.processed_at,
      processedBy: r.processed_by,
      book: r.books ? {
        id: r.books.id,
        title: r.books.title,
        author: r.books.author,
        coverUrl: r.books.cover_url,
        category: r.books.categories?.name || 'Uncategorized'
      } : null
    }));

    res.json(requests);
  } catch (err) {
    console.error("Get User Borrow Requests Error:", err);
    res.status(500).json({ error: 'Failed to fetch borrow requests' });
  }
});

// GET /api/admin/active-loans - Get all active loans (admin)
app.get('/api/admin/active-loans', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase
      .from('active_loans')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) throw error;

    const loans = data.map(l => ({
      id: l.id,
      checkoutDate: l.checkout_date,
      dueDate: l.due_date,
      isOverdue: l.is_overdue,
      fineAmount: l.fine_amount,
      daysRemaining: l.days_remaining,
      userId: l.user_id,
      userName: l.user_name,
      userAdmissionNo: l.admission_no,
      book: {
        id: l.book_id,
        title: l.book_title,
        author: l.book_author,
        coverUrl: l.book_cover,
        category: l.book_category
      }
    }));

    res.json(loans);
  } catch (err) {
    console.error("Fetch Admin Active Loans Error:", err);
    res.status(500).json({ error: 'Failed to fetch active loans' });
  }
});

// GET /api/admin/borrow-requests - Get all pending borrow requests (admin)
// Requirements: 3.2, 3.4, 6.1
app.get('/api/admin/borrow-requests', async (req, res) => {
  if (checkDb(res)) return;
  const { search, status } = req.query;

  try {
    let query = supabase
      .from('borrow_requests')
      .select(`
        id,
        user_id,
        book_id,
        status,
        rejection_reason,
        requested_at,
        processed_at,
        processed_by,
        users!borrow_requests_user_id_fkey (
          id,
          name,
          admission_no
        ),
        books (
          id,
          title,
          author,
          cover_url,
          copies_available
        )
      `)
      .order('requested_at', { ascending: true });

    // Filter by status (default to pending)
    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.eq('status', 'pending');
    }

    const { data, error } = await query;

    if (error) throw error;

    let requests = (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      bookId: r.book_id,
      status: r.status,
      rejectionReason: r.rejection_reason,
      requestedAt: r.requested_at,
      processedAt: r.processed_at,
      processedBy: r.processed_by,
      userName: r.users?.name,
      userAdmissionNo: r.users?.admission_no,
      bookTitle: r.books?.title,
      bookAuthor: r.books?.author,
      bookCoverUrl: r.books?.cover_url,
      copiesAvailable: r.books?.copies_available
    }));

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      requests = requests.filter(r => 
        (r.userName && r.userName.toLowerCase().includes(searchLower)) ||
        (r.userAdmissionNo && r.userAdmissionNo.toLowerCase().includes(searchLower)) ||
        (r.bookTitle && r.bookTitle.toLowerCase().includes(searchLower)) ||
        (r.bookAuthor && r.bookAuthor.toLowerCase().includes(searchLower))
      );
    }

    res.json(requests);
  } catch (err) {
    console.error("Get Admin Borrow Requests Error:", err);
    res.status(500).json({ error: 'Failed to fetch borrow requests' });
  }
});

// POST /api/admin/borrow-requests/:id/approve - Approve a borrow request
// Requirements: 4.1, 4.2, 4.3, 4.5
app.post('/api/admin/borrow-requests/:id/approve', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { adminId } = req.body;

  if (!adminId) {
    return res.status(400).json({ error: 'adminId is required' });
  }

  try {
    const { data, error } = await supabase.rpc('approve_borrow_request', {
      p_request_id: id,
      p_admin_id: adminId
    });

    if (error) throw error;

    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    res.json({
      success: true,
      loanId: data.loan_id,
      message: data.message
    });
  } catch (err) {
    console.error("Approve Borrow Request Error:", err);
    res.status(500).json({ error: 'Failed to approve borrow request' });
  }
});

// POST /api/admin/borrow-requests/:id/reject - Reject a borrow request
// Requirements: 5.1, 5.2, 5.3, 5.4
app.post('/api/admin/borrow-requests/:id/reject', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { adminId, rejectionReason } = req.body;

  if (!adminId) {
    return res.status(400).json({ error: 'adminId is required' });
  }

  try {
    const { data, error } = await supabase.rpc('reject_borrow_request', {
      p_request_id: id,
      p_admin_id: adminId,
      p_rejection_reason: rejectionReason || null
    });

    if (error) throw error;

    if (!data.success) {
      return res.status(400).json({ error: data.error });
    }

    res.json({
      success: true,
      message: data.message
    });
  } catch (err) {
    console.error("Reject Borrow Request Error:", err);
    res.status(500).json({ error: 'Failed to reject borrow request' });
  }
});

// --- FAVORITES ROUTES ---

// Get User Favorites
app.get('/api/favorites/:userId', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        id,
        book_id,
        books (id, title, author, cover_url)
      `)
      .eq('user_id', req.params.userId);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Fetch Favorites Error:", err);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Add to Favorites
app.post('/api/favorites', async (req, res) => {
  if (checkDb(res)) return;
  const { userId, bookId } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('favorites')
      .insert([{ user_id: userId, book_id: bookId }])
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Add Favorite Error:", err);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove from Favorites
app.delete('/api/favorites/:userId/:bookId', async (req, res) => {
  if (checkDb(res)) return;
  const { userId, bookId } = req.params;
  
  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('book_id', bookId);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Remove Favorite Error:", err);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// --- READING ACTIVITY ---

// Get Reading Activity
app.get('/api/activity/:userId', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase
      .from('reading_activity')
      .select('*')
      .eq('user_id', req.params.userId)
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Fetch Activity Error:", err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// --- CHAT HISTORY ROUTES ---

// Get user's chat history
app.get('/api/chat/history/:userId', async (req, res) => {
  if (checkDb(res)) return;
  
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', req.params.userId)
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (error) throw error;
    
    const messages = (data || []).map(m => ({
      id: m.id,
      role: m.role,
      text: m.message,
      timestamp: m.created_at
    }));
    
    res.json(messages);
  } catch (err) {
    console.error("Fetch Chat History Error:", err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Save a chat message
app.post('/api/chat/history', async (req, res) => {
  if (checkDb(res)) return;
  
  const { userId, role, message } = req.body;
  
  if (!userId || !role || !message) {
    return res.status(400).json({ error: 'userId, role, and message are required' });
  }
  
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .insert([{ user_id: userId, role, message }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, message: data });
  } catch (err) {
    console.error("Save Chat Message Error:", err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});

// Clear user's chat history
app.delete('/api/chat/history/:userId', async (req, res) => {
  if (checkDb(res)) return;
  
  try {
    const { error } = await supabase
      .from('chat_history')
      .delete()
      .eq('user_id', req.params.userId);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (err) {
    console.error("Clear Chat History Error:", err);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// --- AI ROUTE (OpenRouter with Memory) ---

app.post('/api/ai/chat', async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI Service not configured.' });
  }

  const { query, userContext, userId } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    // Get recent chat history for context (last 10 exchanges = 20 messages)
    let chatHistory = [];
    if (userId && supabase) {
      const { data: historyData } = await supabase
        .from('chat_history')
        .select('role, message')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (historyData && historyData.length > 0) {
        // Reverse to get chronological order
        chatHistory = historyData.reverse().map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.message
        }));
      }
    }

    const responseText = await chatWithOpenRouter(query, userContext || {}, chatHistory);
    
    // Save both user message and AI response to history
    if (userId && supabase) {
      await supabase.from('chat_history').insert([
        { user_id: userId, role: 'user', message: query },
        { user_id: userId, role: 'model', message: responseText }
      ]);
    }
    
    res.json({ text: responseText });
  } catch (err) {
    console.error("OpenRouter Error:", err);
    res.status(500).json({ error: 'AI Service unavailable' });
  }
});

// --- AI BOOK METADATA ---

// Search for book metadata using AI
app.post('/api/ai/book-metadata', async (req, res) => {
  if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'AI Service not configured.' });
  const { title, author } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Book title is required' });
  }

  try {
    const prompt = `You are a librarian assistant. Search your knowledge for information about this book:
Title: "${title}"
${author ? `Author: "${author}"` : ''}

Provide the following information in JSON format (use null for unknown fields):
{
  "title": "exact book title",
  "author": "author name(s)",
  "isbn": "ISBN-13 if known",
  "publishedYear": year as number,
  "publisher": "publisher name",
  "description": "brief 2-3 sentence description of the book",
  "category": "main category/genre"
}

Only respond with valid JSON, no other text.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://drizaikn-library.vercel.app',
        'X-Title': 'Drizaikn Digital Library'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error('AI API error');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    
    let metadata = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error('Failed to parse AI response:', parseErr);
    }

    res.json({ metadata });
  } catch (err) {
    console.error('Book metadata search error:', err);
    res.status(500).json({ error: 'Failed to search book metadata' });
  }
});

// Search for book cover image - Enhanced with multiple sources and better quality
app.post('/api/ai/book-cover', async (req, res) => {
  const { title, author, isbn } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Book title is required' });
  }

  try {
    let coverUrl = null;
    let coverSource = 'placeholder';

    // 1. Try ISBN-based lookup first (most accurate)
    if (isbn) {
      const cleanIsbn = isbn.replace(/[-\s]/g, '');
      
      // Try Open Library ISBN cover
      const isbnCoverUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
      try {
        const checkResponse = await fetch(isbnCoverUrl, { method: 'HEAD' });
        if (checkResponse.ok && checkResponse.headers.get('content-length') > 1000) {
          coverUrl = isbnCoverUrl;
          coverSource = 'open_library';
        }
      } catch (e) { /* continue to next source */ }
      
      // Try Google Books with ISBN
      if (!coverUrl) {
        try {
          const googleIsbnResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
          if (googleIsbnResponse.ok) {
            const googleData = await googleIsbnResponse.json();
            if (googleData.items && googleData.items.length > 0) {
              const volumeInfo = googleData.items[0].volumeInfo;
              if (volumeInfo.imageLinks) {
                coverUrl = volumeInfo.imageLinks.extraLarge || 
                           volumeInfo.imageLinks.large || 
                           volumeInfo.imageLinks.medium ||
                           volumeInfo.imageLinks.thumbnail;
                if (coverUrl) {
                  coverUrl = coverUrl.replace('http://', 'https://').replace('&edge=curl', '').replace('zoom=1', 'zoom=0');
                  coverSource = 'google_books';
                }
              }
            }
          }
        } catch (e) { /* continue to next source */ }
      }
    }
    
    // 2. Try Open Library search by title/author
    if (!coverUrl) {
      const searchQuery = encodeURIComponent(`${title} ${author || ''}`);
      try {
        const searchResponse = await fetch(`https://openlibrary.org/search.json?q=${searchQuery}&limit=3`);
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          if (searchData.docs && searchData.docs.length > 0) {
            // Find the best match with a cover
            for (const book of searchData.docs) {
              if (book.cover_i) {
                coverUrl = `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`;
                coverSource = 'open_library';
                break;
              }
            }
          }
        }
      } catch (e) { /* continue to next source */ }
    }

    // 3. Try Google Books API with title/author search
    if (!coverUrl) {
      const googleQuery = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ''}`);
      try {
        const googleResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${googleQuery}&maxResults=3&printType=books`);
        if (googleResponse.ok) {
          const googleData = await googleResponse.json();
          if (googleData.items && googleData.items.length > 0) {
            // Find the best match with highest quality cover
            for (const item of googleData.items) {
              const volumeInfo = item.volumeInfo;
              if (volumeInfo.imageLinks) {
                const potentialCover = volumeInfo.imageLinks.extraLarge || 
                                       volumeInfo.imageLinks.large || 
                                       volumeInfo.imageLinks.medium ||
                                       volumeInfo.imageLinks.thumbnail;
                if (potentialCover) {
                  coverUrl = potentialCover.replace('http://', 'https://').replace('&edge=curl', '').replace('zoom=1', 'zoom=0');
                  coverSource = 'google_books';
                  break;
                }
              }
            }
          }
        }
      } catch (e) { /* continue to placeholder */ }
    }

    // 4. Generate styled placeholder if no cover found
    if (!coverUrl) {
      const encodedTitle = encodeURIComponent(title.substring(0, 25));
      const encodedAuthor = encodeURIComponent((author || 'Unknown').substring(0, 20));
      // Use a nicer placeholder with book styling
      coverUrl = `https://via.placeholder.com/400x600/1A365D/FFFFFF?text=${encodedTitle}%0A%0Aby%0A${encodedAuthor}`;
      coverSource = 'placeholder';
    }

    res.json({ coverUrl, source: coverSource });
  } catch (err) {
    console.error('Book cover search error:', err);
    const encodedTitle = encodeURIComponent(title.substring(0, 25));
    res.json({ 
      coverUrl: `https://via.placeholder.com/400x600/1A365D/FFFFFF?text=${encodedTitle}`,
      source: 'placeholder'
    });
  }
});

// Auto-update book covers for books with placeholder images
app.post('/api/admin/auto-update-covers', async (req, res) => {
  if (checkDb(res)) return;
  
  try {
    // Get books with placeholder or missing covers
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select('id, title, author, isbn, cover_url')
      .or('cover_url.is.null,cover_url.ilike.%placeholder%,cover_url.ilike.%picsum%,cover_url.ilike.%ui-avatars%');
    
    if (fetchError) throw fetchError;
    
    if (!books || books.length === 0) {
      return res.json({ success: true, message: 'No books need cover updates', updated: 0 });
    }
    
    let updatedCount = 0;
    const updatePromises = books.slice(0, 10).map(async (book) => { // Limit to 10 at a time
      try {
        let coverUrl = null;
        
        // 1. Try Open Library by ISBN
        if (book.isbn) {
          const cleanIsbn = book.isbn.replace(/-/g, '');
          coverUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`;
        }
        
        // 2. Try Open Library search
        if (!coverUrl || !book.isbn) {
          const searchQuery = encodeURIComponent(`${book.title} ${book.author || ''}`);
          const searchResponse = await fetch(`https://openlibrary.org/search.json?q=${searchQuery}&limit=1`);
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.docs && searchData.docs.length > 0 && searchData.docs[0].cover_i) {
              coverUrl = `https://covers.openlibrary.org/b/id/${searchData.docs[0].cover_i}-L.jpg`;
            }
          }
        }
        
        // 3. Try Google Books
        if (!coverUrl) {
          const googleQuery = encodeURIComponent(`${book.title} ${book.author || ''}`);
          const googleResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${googleQuery}&maxResults=1`);
          
          if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            if (googleData.items && googleData.items.length > 0) {
              const volumeInfo = googleData.items[0].volumeInfo;
              if (volumeInfo.imageLinks) {
                coverUrl = volumeInfo.imageLinks.extraLarge || 
                           volumeInfo.imageLinks.large || 
                           volumeInfo.imageLinks.medium ||
                           volumeInfo.imageLinks.thumbnail;
                if (coverUrl) {
                  coverUrl = coverUrl.replace('&edge=curl', '').replace('zoom=1', 'zoom=0');
                }
              }
            }
          }
        }
        
        // Update the book if we found a cover
        if (coverUrl && !coverUrl.includes('placeholder')) {
          const { error: updateError } = await supabase
            .from('books')
            .update({ cover_url: coverUrl })
            .eq('id', book.id);
          
          if (!updateError) {
            updatedCount++;
            return { id: book.id, title: book.title, coverUrl, success: true };
          }
        }
        
        return { id: book.id, title: book.title, success: false };
      } catch (err) {
        console.error(`Error updating cover for ${book.title}:`, err);
        return { id: book.id, title: book.title, success: false, error: err.message };
      }
    });
    
    const results = await Promise.all(updatePromises);
    
    res.json({ 
      success: true, 
      message: `Updated ${updatedCount} book covers`,
      updated: updatedCount,
      total: books.length,
      results 
    });
  } catch (err) {
    console.error('Auto-update covers error:', err);
    res.status(500).json({ error: 'Failed to update book covers' });
  }
});

// Extract metadata from PDF filename
app.post('/api/ai/extract-pdf-metadata', async (req, res) => {
  if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'AI Service not configured.' });
  const { fileName } = req.body;
  
  if (!fileName) {
    return res.status(400).json({ error: 'File name is required' });
  }

  try {
    const cleanName = fileName
      .replace(/\.pdf$/i, '')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const prompt = `Based on this PDF filename, identify the book and provide metadata:
Filename: "${cleanName}"

Search your knowledge for this book and provide information in JSON format:
{
  "title": "exact book title",
  "author": "author name(s)",
  "isbn": "ISBN-13 if known",
  "publishedYear": year as number,
  "publisher": "publisher name",
  "description": "brief 2-3 sentence description",
  "category": "main category/genre"
}

Only respond with valid JSON, no other text.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://drizaikn-library.vercel.app',
        'X-Title': 'Drizaikn Digital Library'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error('AI API error');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    
    let metadata = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error('Failed to parse AI response:', parseErr);
    }

    res.json({ metadata });
  } catch (err) {
    console.error('PDF metadata extraction error:', err);
    res.status(500).json({ error: 'Failed to extract PDF metadata' });
  }
});

// --- ADMIN ROUTES ---

// PDF Upload endpoint for Supabase Storage
app.post('/api/admin/upload-pdf', async (req, res) => {
  if (checkDb(res)) return;
  
  try {
    const { fileName, fileData } = req.body;
    
    if (!fileName || !fileData) {
      return res.status(400).json({ error: 'fileName and fileData are required' });
    }
    
    // Decode base64 to buffer
    const buffer = Buffer.from(fileData, 'base64');
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('book-pdfs')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (error) {
      console.error('Supabase Storage Error:', error);
      throw error;
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('book-pdfs')
      .getPublicUrl(fileName);
    
    res.json({ 
      success: true, 
      url: urlData.publicUrl,
      path: data.path
    });
  } catch (err) {
    console.error('PDF Upload Error:', err);
    res.status(500).json({ error: 'Failed to upload PDF. Make sure the "book-pdfs" storage bucket exists in Supabase.' });
  }
});

// Add a new book (Admin only)
app.post('/api/admin/books', async (req, res) => {
  if (checkDb(res)) return;
  
  const { title, author, categoryId, coverUrl, description, totalCopies, copiesAvailable, isbn, publishedYear, callNumber, shelfLocation, floorNumber, softCopyUrl, hasSoftCopy } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('books')
      .insert([{
        title,
        author,
        category_id: categoryId || null,
        cover_url: coverUrl || `https://picsum.photos/seed/${Date.now()}/400/600`,
        description,
        total_copies: totalCopies || 1,
        copies_available: copiesAvailable || totalCopies || 1,
        isbn: isbn || null,
        published_year: publishedYear || null,
        popularity: 0,
        call_number: callNumber || null,
        shelf_location: shelfLocation || null,
        floor_number: floorNumber || null,
        soft_copy_url: softCopyUrl || null,
        has_soft_copy: hasSoftCopy || false
      }])
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({ success: true, book: data });
  } catch (err) {
    console.error("Add Book Error:", err);
    res.status(500).json({ error: 'Failed to add book' });
  }
});

// Update book stock (Admin only)
app.put('/api/admin/books/:bookId/stock', async (req, res) => {
  if (checkDb(res)) return;
  
  const { bookId } = req.params;
  const { totalCopies, copiesAvailable } = req.body;
  
  try {
    // Validate that copiesAvailable doesn't exceed totalCopies
    if (copiesAvailable > totalCopies) {
      return res.status(400).json({ error: 'Available copies cannot exceed total copies' });
    }
    
    const { data, error } = await supabase
      .from('books')
      .update({
        total_copies: totalCopies,
        copies_available: copiesAvailable,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, book: data });
  } catch (err) {
    console.error("Update Stock Error:", err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// Update book details (Admin only)
app.put('/api/admin/books/:bookId', async (req, res) => {
  if (checkDb(res)) return;
  
  const { bookId } = req.params;
  const { title, author, categoryId, coverUrl, description, isbn, publishedYear, totalCopies, copiesAvailable, callNumber, shelfLocation, floorNumber, softCopyUrl, hasSoftCopy } = req.body;
  
  try {
    const updateData = {};
    if (title) updateData.title = title;
    if (author) updateData.author = author;
    if (categoryId) updateData.category_id = categoryId;
    if (coverUrl) updateData.cover_url = coverUrl;
    if (description !== undefined) updateData.description = description;
    if (isbn !== undefined) updateData.isbn = isbn;
    if (publishedYear) updateData.published_year = publishedYear;
    if (totalCopies !== undefined) updateData.total_copies = totalCopies;
    if (copiesAvailable !== undefined) updateData.copies_available = copiesAvailable;
    if (callNumber !== undefined) updateData.call_number = callNumber;
    if (shelfLocation !== undefined) updateData.shelf_location = shelfLocation;
    if (floorNumber !== undefined) updateData.floor_number = floorNumber;
    if (softCopyUrl !== undefined) updateData.soft_copy_url = softCopyUrl;
    if (hasSoftCopy !== undefined) updateData.has_soft_copy = hasSoftCopy;
    updateData.updated_at = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('books')
      .update(updateData)
      .eq('id', bookId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, book: data });
  } catch (err) {
    console.error("Update Book Error:", err);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// Delete a book (Admin only)
app.delete('/api/admin/books/:bookId', async (req, res) => {
  if (checkDb(res)) return;
  
  const { bookId } = req.params;
  
  try {
    // Check if book has active loans
    const { data: activeLoans } = await supabase
      .from('loans')
      .select('id')
      .eq('book_id', bookId)
      .eq('is_returned', false);
    
    if (activeLoans && activeLoans.length > 0) {
      return res.status(400).json({ error: 'Cannot delete book with active loans' });
    }
    
    const { error } = await supabase
      .from('books')
      .delete()
      .eq('id', bookId);
    
    if (error) throw error;
    
    res.json({ success: true });
  } catch (err) {
    console.error("Delete Book Error:", err);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// Get all users (Admin only)
app.get('/api/admin/users', async (req, res) => {
  if (checkDb(res)) return;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, admission_no, role, created_at')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json(data);
  } catch (err) {
    console.error("Fetch Users Error:", err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (Admin only)
app.put('/api/admin/users/:userId/role', async (req, res) => {
  if (checkDb(res)) return;
  
  const { userId } = req.params;
  const { role } = req.body;
  
  if (!['Student', 'Faculty', 'Admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, user: data });
  } catch (err) {
    console.error("Update Role Error:", err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// --- USER PROFILE ROUTES ---
// PUT /api/users/:userId/profile - Update user profile
app.put('/api/users/:userId/profile', async (req, res) => {
  if (checkDb(res)) return;
  const { userId } = req.params;
  const { name, email, course } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    // Check if email is already used by another user
    if (email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return res.status(400).json({ error: 'Email is already in use by another account' });
      }
    }

    // Generate new avatar URL if name changed
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1A365D&color=fff`;

    const { data, error } = await supabase
      .from('users')
      .update({ 
        name: name.trim(), 
        email: email || null, 
        course: course || null,
        avatar_url: avatarUrl
      })
      .eq('id', userId)
      .select('id, name, email, admission_no, role, avatar_url, course')
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        admissionNo: data.admission_no,
        role: data.role,
        avatarUrl: data.avatar_url,
        course: data.course
      }
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// PUT /api/users/:userId/password - Update user password
app.put('/api/users/:userId/password', async (req, res) => {
  if (checkDb(res)) return;
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    // Get current user
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId);

    if (updateError) throw updateError;

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error("Update Password Error:", err);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: supabase ? 'connected' : 'not configured',
    ai: OPENROUTER_API_KEY ? 'configured (OpenRouter)' : 'not configured'
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on http://0.0.0.0:${PORT} (accessible at http://192.168.100.40:${PORT})`));
