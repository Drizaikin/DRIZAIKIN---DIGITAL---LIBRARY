// Vercel Serverless Function - Main API Entry Point
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// OpenRouter Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite';
const OPENROUTER_EXTRACTION_MODEL = 'openai/gpt-4o-mini'; // More capable model for metadata extraction

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
  
  let personalContext = '';
  if (name || course || interests) {
    personalContext = '\n\nStudent Context:';
    if (name) personalContext += `\n- Name: ${name}`;
    if (course) personalContext += `\n- Course of Study: ${course}`;
    if (interests) personalContext += `\n- Additional Interests: ${interests}`;
    if (role) personalContext += `\n- Role: ${role}`;
    personalContext += '\n\nUse this information to provide personalized book recommendations and research guidance relevant to their field of study and interests.';
  }
  
  let memoryContext = '';
  if (chatHistory.length > 0) {
    memoryContext = '\n\nYou have an ongoing conversation with this student. Use the conversation history to provide contextual and personalized responses.';
  }

  const systemPrompt = `You are the AI Librarian for Drizaikn Digital Library - Architect of Knowledge. 

Your Role:
- Assist students with finding books, understanding library policies, and academic research
- Help lecturers with teaching resources, course materials, and pedagogical support
- Help library staff (admins) with system information and patron assistance

Library Policies:
- Loan period: 14 days
- Late fine: KES 50 per day
- Maximum books: 5 for students, 5 for lecturers, 10 for faculty
- Renewals: Up to 2 times per book (7 days each)
${personalContext}
${memoryContext}

Be helpful, concise, and professional.`;

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
      'HTTP-Referer': 'https://drizaikn-library.vercel.app',
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
app.post('/api/auth/register', async (req, res) => {
  if (checkDb(res)) return;
  const { name, email, admissionNo, password, course, securityQuestion1, securityAnswer1, securityQuestion2, securityAnswer2 } = req.body;

  // Validate required fields
  if (!name || !email || !admissionNo || !password) {
    return res.status(400).json({ error: 'Name, email, admission number, and password are required.' });
  }

  try {
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('admission_no', admissionNo)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected for new users
      console.error('Error checking existing user:', checkError);
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Admission number already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1A365D&color=fff`;

    // Hash security answers (case-insensitive) - only if provided
    const answer1Hash = securityAnswer1 ? await bcrypt.hash(securityAnswer1.toLowerCase().trim(), salt) : null;
    const answer2Hash = securityAnswer2 ? await bcrypt.hash(securityAnswer2.toLowerCase().trim(), salt) : null;

    // Build insert object - only include security fields if they exist in the table
    const insertData = { 
      name, 
      email, 
      admission_no: admissionNo, 
      password_hash: passwordHash, 
      avatar_url: avatarUrl, 
      course: course || null, 
      role: 'Student'
    };

    // Only add security fields if they were provided
    if (securityQuestion1) insertData.security_question_1 = securityQuestion1;
    if (answer1Hash) insertData.security_answer_1 = answer1Hash;
    if (securityQuestion2) insertData.security_question_2 = securityQuestion2;
    if (answer2Hash) insertData.security_answer_2 = answer2Hash;

    console.log('Attempting to register user:', { name, email, admissionNo, course });

    const { data, error } = await supabase
      .from('users')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    console.log('User registered successfully:', data.id);

    res.status(201).json({ 
      user: { id: data.id, name: data.name, admissionNo: data.admission_no, role: data.role, avatarUrl: data.avatar_url, course: data.course } 
    });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: err.message || 'Server error during registration.' });
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

// Forgot Password - Generate reset token and send email
app.post('/api/auth/forgot-password', async (req, res) => {
  if (checkDb(res)) return;
  const { email, admissionNo } = req.body;

  try {
    // Find user by admission number and email
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('admission_no', admissionNo)
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'No account found with this admission number and email combination.' });
    }

    // Generate a simple reset token (in production, use crypto.randomBytes)
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const resetExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    // Store reset token in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        reset_token: resetToken, 
        reset_token_expiry: resetExpiry 
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // In a real application, you would send an email here using a service like SendGrid, Mailgun, etc.
    // For now, we'll just return success (the token would be sent via email)
    console.log(`Password reset requested for ${user.email}. Token: ${resetToken}`);

    res.json({ 
      success: true, 
      message: 'Password reset instructions have been sent to your email.' 
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ error: 'Server error processing request.' });
  }
});

// Reset Password - Verify token and update password
app.post('/api/auth/reset-password', async (req, res) => {
  if (checkDb(res)) return;
  const { token, newPassword } = req.body;

  try {
    // Find user by reset token
    const { data: user, error } = await supabase
      .from('users')
      .select('id, reset_token_expiry')
      .eq('reset_token', token)
      .single();

    if (error || !user) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    // Check if token is expired
    if (new Date(user.reset_token_expiry) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash: passwordHash, 
        reset_token: null, 
        reset_token_expiry: null 
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});

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
    console.error("Login Error:", err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// --- BOOKS ROUTES ---
// GET /api/books - Get all published books for public catalog
// Requirements: 7.2, 7.3, 7.4 (User Visibility Isolation)
// Property 4: User Visibility Isolation
// - This endpoint queries books_with_status view which only shows books from the main 'books' table
// - Extracted books are stored in a separate 'extracted_books' table and are NOT visible here
// - Only books that have been explicitly published via publish_extracted_books() appear in results
// - This ensures users never see books from in-progress extraction jobs
app.get('/api/books', async (req, res) => {
  if (checkDb(res)) return;
  try {
    // Query books_with_status view - excludes unpublished extracted books by design
    // The view only shows books from the main 'books' table, not from 'extracted_books'
    const { data, error } = await supabase
      .from('books_with_status')
      .select('*')
      .order('popularity', { ascending: false });
    
    if (error) throw error;
    
    const books = data.map(b => ({
      id: b.id, title: b.title, author: b.author, category: b.category || 'Uncategorized',
      coverUrl: b.cover_url, status: b.status, popularity: b.popularity,
      copiesAvailable: b.copies_available, totalCopies: b.total_copies, description: b.description,
      publishedYear: b.published_year, addedDate: b.added_date, isbn: b.isbn,
      callNumber: b.call_number, shelfLocation: b.shelf_location, floorNumber: b.floor_number,
      softCopyUrl: b.soft_copy_url, hasSoftCopy: b.has_soft_copy
    }));
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

app.get('/api/categories', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/courses', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase.from('courses').select('*').order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});


// GET /api/books/recommendations/:userId - Get personalized book recommendations
// Requirements: 1.1, 1.2, 1.3, 5.3, 7.2, 7.3, 7.4 (User Visibility Isolation)
// Property 4: User Visibility Isolation
// - All queries use books_with_status view which only shows published books
// - Extracted books from in-progress jobs are NOT included in recommendations
// - This ensures users only see books that have been properly published
app.get('/api/books/recommendations/:userId', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const userId = req.params.userId;
    
    // Get user's course and search history in parallel
    // Requirements: 1.1, 1.2, 1.3, 5.3
    const [userResult, historyResult] = await Promise.all([
      supabase.from('users').select('course').eq('id', userId).single(),
      supabase.from('search_history')
        .select('type, query, book_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50) // Requirement 5.3: Limit to 50 most recent entries
    ]);
    
    const user = userResult.data;
    const searchHistory = historyResult.data || [];
    
    // Extract search terms and viewed book IDs from history
    const searchTerms = searchHistory
      .filter(h => h.type === 'search' && h.query)
      .map(h => h.query.toLowerCase().trim())
      .filter((term, index, self) => self.indexOf(term) === index); // Deduplicate
    
    const viewedBookIds = searchHistory
      .filter(h => h.type === 'view' && h.book_id)
      .map(h => h.book_id)
      .filter((id, index, self) => self.indexOf(id) === index); // Deduplicate
    
    // Collect recommended books from different sources
    let recommendedBooks = [];
    const addedBookIds = new Set();
    
    // Helper to add books without duplicates
    const addBooks = (books) => {
      for (const b of books || []) {
        if (!addedBookIds.has(b.id)) {
          addedBookIds.add(b.id);
          recommendedBooks.push({
            id: b.id, title: b.title, author: b.author, 
            category: b.category || 'Uncategorized',
            coverUrl: b.cover_url, status: b.status, popularity: b.popularity,
            copiesAvailable: b.copies_available, totalCopies: b.total_copies, 
            description: b.description
          });
        }
      }
    };
    
    // 1. Get books related to search history (Requirement 1.1)
    // Uses books_with_status view - excludes unpublished extracted books (Req 7.4)
    if (searchTerms.length > 0) {
      // Search for books matching any of the search terms in title, author, or description
      for (const term of searchTerms.slice(0, 5)) { // Limit to top 5 search terms
        const { data: searchBooks } = await supabase
          .from('books_with_status')
          .select('*')
          .gt('copies_available', 0)
          .or(`title.ilike.%${term}%,author.ilike.%${term}%,description.ilike.%${term}%`)
          .order('popularity', { ascending: false })
          .limit(5);
        
        addBooks(searchBooks);
        if (recommendedBooks.length >= 10) break;
      }
    }
    
    // 2. Get books similar to viewed books (based on category)
    // Uses books_with_status view - excludes unpublished extracted books (Req 7.4)
    if (viewedBookIds.length > 0 && recommendedBooks.length < 10) {
      // Get categories of viewed books
      const { data: viewedBooks } = await supabase
        .from('books')
        .select('category_id')
        .in('id', viewedBookIds.slice(0, 10));
      
      const viewedCategoryIds = (viewedBooks || [])
        .map(b => b.category_id)
        .filter(Boolean)
        .filter((id, index, self) => self.indexOf(id) === index);
      
      if (viewedCategoryIds.length > 0) {
        const { data: similarBooks } = await supabase
          .from('books_with_status')
          .select('*')
          .in('category_id', viewedCategoryIds)
          .not('id', 'in', `(${viewedBookIds.join(',')})`) // Exclude already viewed books
          .gt('copies_available', 0)
          .order('popularity', { ascending: false })
          .limit(10 - recommendedBooks.length);
        
        addBooks(similarBooks);
      }
    }
    
    // 3. Get course-based recommendations (Requirement 1.2)
    // Uses books_with_status view - excludes unpublished extracted books (Req 7.4)
    if (user?.course && recommendedBooks.length < 10) {
      const { data: mappings } = await supabase
        .from('course_category_mapping')
        .select(`relevance_score, categories (id, name), courses!inner (name)`)
        .eq('courses.name', user.course);
      
      const categoryIds = (mappings || []).map(m => m.categories?.id).filter(Boolean);
      
      if (categoryIds.length > 0) {
        const { data: courseBooks } = await supabase
          .from('books_with_status')
          .select('*')
          .in('category_id', categoryIds)
          .gt('copies_available', 0)
          .order('popularity', { ascending: false })
          .limit(10 - recommendedBooks.length);
        
        addBooks(courseBooks);
      }
    }
    
    // 4. Fall back to popular books if no recommendations yet (Requirement 1.4)
    // Uses books_with_status view - excludes unpublished extracted books (Req 7.4)
    if (recommendedBooks.length < 10) {
      const { data: popularBooks } = await supabase
        .from('books_with_status')
        .select('*')
        .gt('copies_available', 0)
        .order('popularity', { ascending: false })
        .limit(10 - recommendedBooks.length);
      
      addBooks(popularBooks);
    }
    
    // Return max 10 recommendations (Requirement 1.5)
    res.json(recommendedBooks.slice(0, 10));
  } catch (err) {
    console.error("Recommendations Error:", err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// --- LOANS ROUTES ---
app.get('/api/loans/:userId', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase
      .from('active_loans')
      .select('*')
      .eq('user_id', req.params.userId);

    if (error) throw error;

    const loans = data.map(l => ({
      id: l.id, checkoutDate: l.checkout_date, dueDate: l.due_date,
      isOverdue: l.is_overdue, fineAmount: l.fine_amount, daysRemaining: l.days_remaining,
      book: { id: l.book_id, title: l.book_title, author: l.book_author, coverUrl: l.book_cover, category: l.book_category }
    }));
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

app.post('/api/loans/borrow', async (req, res) => {
  if (checkDb(res)) return;
  const { userId, bookId } = req.body;
  try {
    const { data, error } = await supabase.rpc('borrow_book', { p_user_id: userId, p_book_id: bookId });
    if (error) throw error;
    if (!data.success) return res.status(400).json({ error: data.error });
    res.json({ success: true, loanId: data.loan_id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to borrow book' });
  }
});

app.post('/api/loans/return', async (req, res) => {
  if (checkDb(res)) return;
  const { loanId } = req.body;
  try {
    const { data, error } = await supabase.rpc('return_book', { p_loan_id: loanId });
    if (error) throw error;
    if (!data.success) return res.status(400).json({ error: data.error });
    res.json({ success: true, fine: data.fine });
  } catch (err) {
    res.status(500).json({ error: 'Failed to return book' });
  }
});

app.post('/api/loans/renew', async (req, res) => {
  if (checkDb(res)) return;
  const { loanId } = req.body;
  try {
    const { data, error } = await supabase.rpc('renew_loan', { p_loan_id: loanId });
    if (error) throw error;
    if (!data.success) return res.status(400).json({ error: data.error });
    res.json({ success: true, message: data.message });
  } catch (err) {
    res.status(500).json({ error: 'Failed to renew loan' });
  }
});

app.post('/api/waitlist/join', async (req, res) => {
  if (checkDb(res)) return;
  const { userId, bookId } = req.body;
  try {
    const { data, error } = await supabase.rpc('join_waitlist', { p_user_id: userId, p_book_id: bookId });
    if (error) throw error;
    if (!data.success) return res.status(400).json({ error: data.error });
    res.json({ success: true, position: data.position });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join waitlist' });
  }
});

// --- FAVORITES ---
app.get('/api/favorites/:userId', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select(`id, book_id, books (id, title, author, cover_url)`)
      .eq('user_id', req.params.userId);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

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
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

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
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});


// --- CHAT HISTORY ---
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
    const messages = (data || []).map(m => ({ id: m.id, role: m.role, text: m.message, timestamp: m.created_at }));
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

app.post('/api/chat/history', async (req, res) => {
  if (checkDb(res)) return;
  const { userId, role, message } = req.body;
  if (!userId || !role || !message) return res.status(400).json({ error: 'userId, role, and message are required' });
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .insert([{ user_id: userId, role, message }])
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, message: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save message' });
  }
});

app.delete('/api/chat/history/:userId', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { error } = await supabase.from('chat_history').delete().eq('user_id', req.params.userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

// --- AI CHAT ---
app.post('/api/ai/chat', async (req, res) => {
  if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'AI Service not configured.' });
  const { query, userContext, userId } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    let chatHistory = [];
    if (userId && supabase) {
      const { data: historyData } = await supabase
        .from('chat_history')
        .select('role, message')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (historyData && historyData.length > 0) {
        chatHistory = historyData.reverse().map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.message
        }));
      }
    }

    const responseText = await chatWithOpenRouter(query, userContext || {}, chatHistory);
    
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

// Search for book metadata using AI and online sources
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
    
    // Parse JSON from response
    let metadata = {};
    try {
      // Extract JSON from response (handle markdown code blocks)
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

// Extract metadata from PDF title/filename
app.post('/api/ai/extract-pdf-metadata', async (req, res) => {
  if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'AI Service not configured.' });
  const { fileName } = req.body;
  
  if (!fileName) {
    return res.status(400).json({ error: 'File name is required' });
  }

  try {
    // Clean up filename to extract potential title
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

// Extract full book metadata from PDF content using GPT-4o-mini
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
app.post('/api/ai/extract-book-metadata', async (req, res) => {
  if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'AI Service not configured.' });
  const { pdfData, maxTextLength = 8000, categories = [], fileName = '' } = req.body;
  
  if (!pdfData && !fileName) {
    return res.status(400).json({ error: 'PDF data or filename is required' });
  }

  try {
    // Build the category list for the prompt
    const categoryList = categories.length > 0 
      ? categories.join(', ')
      : 'Fiction, Non-Fiction, Science, Technology, History, Biography, Self-Help, Business, Education, Reference';

    const prompt = `You are an expert librarian and book cataloger. Analyze the provided book information and extract accurate metadata.

${fileName ? `Filename: ${fileName}` : ''}

TASK: Extract and generate comprehensive book metadata with the following requirements:

1. TITLE: Extract the exact book title. If it's an academic text, include edition if mentioned.
2. AUTHOR: Extract all author names. Use "Unknown Author" only if truly not identifiable.
3. DESCRIPTION: Write a detailed 150-200 word description covering:
   - Main subject matter and themes
   - Key topics or chapters covered
   - Target audience (students, professionals, general readers)
   - What makes this book valuable or unique
4. SYNOPSIS: Write a compelling 60-80 word overview suitable for a library catalog card.
5. CATEGORY: Select the most appropriate category from: ${categoryList}
6. ISBN: Extract if visible in the content (format: ISBN-10 or ISBN-13)

OUTPUT FORMAT (JSON only, no markdown):
{
  "title": "Exact book title with edition if applicable",
  "author": "Author Name(s)",
  "description": "Detailed 150-200 word description...",
  "synopsis": "Concise 60-80 word overview...",
  "suggestedCategory": "Best matching category",
  "isbn": "ISBN if found, or null",
  "confidence": 0.85
}

Provide accurate, professional metadata. Only respond with valid JSON.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://drizaikn-library.vercel.app',
        'X-Title': 'Drizaikn Digital Library'
      },
      body: JSON.stringify({
        model: OPENROUTER_EXTRACTION_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error('AI API error');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';
    
    let metadata = {
      title: 'Unknown Title',
      author: 'Unknown Author',
      description: '',
      synopsis: '',
      suggestedCategory: '',
      isbn: null,
      confidence: 0
    };
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        metadata = {
          title: parsed.title || 'Unknown Title',
          author: parsed.author || 'Unknown Author',
          description: parsed.description || '',
          synopsis: parsed.synopsis || '',
          suggestedCategory: parsed.suggestedCategory || parsed.category || '',
          isbn: parsed.isbn || null,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
        };
      }
    } catch (parseErr) {
      console.error('Failed to parse AI response:', parseErr);
    }

    res.json({ metadata });
  } catch (err) {
    console.error('Book metadata extraction error:', err);
    res.status(500).json({ error: 'Failed to extract book metadata' });
  }
});

// Extract text content from PDF (first pages)
// This endpoint would ideally use a PDF parsing library
app.post('/api/ai/extract-pdf-text', async (req, res) => {
  const { pdfData } = req.body;
  
  if (!pdfData) {
    return res.status(400).json({ error: 'PDF data is required' });
  }

  try {
    // In a production environment, you would use a library like pdf-parse
    // For now, we return a placeholder indicating the PDF was received
    // The actual text extraction would happen server-side with proper PDF parsing
    
    // Note: In serverless environments like Vercel, PDF parsing can be challenging
    // Consider using a dedicated service or cloud function for heavy PDF processing
    
    res.json({ 
      text: '',
      message: 'PDF text extraction requires server-side PDF parsing library',
      pdfReceived: true
    });
  } catch (err) {
    console.error('PDF text extraction error:', err);
    res.status(500).json({ error: 'Failed to extract PDF text' });
  }
});

// --- ADMIN ROUTES ---

// PDF Upload endpoint for Supabase Storage
app.post('/api/admin/upload-pdf', async (req, res) => {
  if (checkDb(res)) return;
  
  // For multipart form data, we need to handle the file
  // This endpoint expects the file to be sent as base64 or we use a different approach
  
  try {
    // Check if we have the file data
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
      // For multipart, we'll need to parse the form data
      // Since we're in a serverless environment, let's use a simpler approach
      // The frontend will send the file as base64
      return res.status(400).json({ 
        error: 'Please use the base64 upload method',
        hint: 'Send { fileName: string, fileData: base64string }'
      });
    }
    
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

// Cover Image Upload endpoint for Supabase Storage
// Requirements: 3.6, 3.7
app.post('/api/admin/upload-cover', async (req, res) => {
  if (checkDb(res)) return;
  
  try {
    const { fileName, imageData, contentType = 'image/jpeg' } = req.body;
    
    if (!fileName || !imageData) {
      return res.status(400).json({ error: 'fileName and imageData are required' });
    }
    
    // Decode base64 to buffer
    const buffer = Buffer.from(imageData, 'base64');
    
    // Upload to Supabase Storage (book-covers bucket)
    const { data, error } = await supabase.storage
      .from('book-covers')
      .upload(fileName, buffer, {
        contentType: contentType,
        upsert: true
      });
    
    if (error) {
      console.error('Supabase Storage Error:', error);
      throw error;
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('book-covers')
      .getPublicUrl(fileName);
    
    res.json({ 
      success: true, 
      url: urlData.publicUrl,
      path: data.path
    });
  } catch (err) {
    console.error('Cover Upload Error:', err);
    res.status(500).json({ error: 'Failed to upload cover. Make sure the "book-covers" storage bucket exists in Supabase.' });
  }
});

// Fetch and upload cover image from URL to Supabase Storage
// Requirements: 3.6, 3.7
app.post('/api/admin/fetch-and-upload-cover', async (req, res) => {
  if (checkDb(res)) return;
  
  try {
    const { imageUrl, fileName } = req.body;
    
    if (!imageUrl || !fileName) {
      return res.status(400).json({ error: 'imageUrl and fileName are required' });
    }
    
    // Fetch the image from the URL
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('book-covers')
      .upload(fileName, buffer, {
        contentType: contentType,
        upsert: true
      });
    
    if (error) {
      console.error('Supabase Storage Error:', error);
      throw error;
    }
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('book-covers')
      .getPublicUrl(fileName);
    
    res.json({ 
      success: true, 
      url: urlData.publicUrl,
      path: data.path,
      originalUrl: imageUrl
    });
  } catch (err) {
    console.error('Fetch and Upload Cover Error:', err);
    res.status(500).json({ error: 'Failed to fetch and upload cover image.' });
  }
});

app.post('/api/admin/books', async (req, res) => {
  if (checkDb(res)) return;
  const { title, author, categoryId, coverUrl, description, totalCopies, copiesAvailable, isbn, publishedYear, callNumber, shelfLocation, floorNumber, softCopyUrl, hasSoftCopy } = req.body;
  
  // Validate required fields
  if (!title || !author) {
    return res.status(400).json({ error: 'Title and author are required' });
  }
  
  try {
    const { data, error } = await supabase
      .from('books')
      .insert([{
        title, author, category_id: categoryId || null,
        cover_url: coverUrl || `https://picsum.photos/seed/${Date.now()}/400/600`,
        description: description || null, 
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
    if (error) {
      console.error('Supabase error adding book:', error);
      throw error;
    }
    res.status(201).json({ success: true, book: data });
  } catch (err) {
    console.error('Error adding book:', err);
    res.status(500).json({ error: err.message || 'Failed to add book' });
  }
});

app.put('/api/admin/books/:bookId', async (req, res) => {
  if (checkDb(res)) return;
  const { bookId } = req.params;
  const { title, author, categoryId, coverUrl, description, isbn, publishedYear, totalCopies, copiesAvailable, callNumber, shelfLocation, floorNumber, softCopyUrl, hasSoftCopy } = req.body;
  try {
    const updateData = { updated_at: new Date().toISOString() };
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
    
    const { data, error } = await supabase.from('books').update(updateData).eq('id', bookId).select().single();
    if (error) throw error;
    res.json({ success: true, book: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update book' });
  }
});

app.delete('/api/admin/books/:bookId', async (req, res) => {
  if (checkDb(res)) return;
  const { bookId } = req.params;
  try {
    const { data: activeLoans } = await supabase.from('loans').select('id').eq('book_id', bookId).eq('is_returned', false);
    if (activeLoans && activeLoans.length > 0) return res.status(400).json({ error: 'Cannot delete book with active loans' });
    const { error } = await supabase.from('books').delete().eq('id', bookId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { data, error } = await supabase.from('users').select('id, name, email, admission_no, role, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/admin/users/:userId/role', async (req, res) => {
  if (checkDb(res)) return;
  const { userId } = req.params;
  const { role } = req.body;
  if (!['Student', 'Lecturer', 'Faculty', 'Admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const { data, error } = await supabase.from('users').update({ role }).eq('id', userId).select().single();
    if (error) throw error;
    res.json({ success: true, user: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
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

// --- SEARCH HISTORY ROUTES ---
// POST /api/search-history - Record a search query or book view
// Requirements: 5.1, 5.2
app.post('/api/search-history', async (req, res) => {
  if (checkDb(res)) return;
  const { userId, type, query, bookId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!type || !['search', 'view'].includes(type)) {
    return res.status(400).json({ error: 'type must be "search" or "view"' });
  }

  if (type === 'search' && !query) {
    return res.status(400).json({ error: 'query is required for search type' });
  }

  if (type === 'view' && !bookId) {
    return res.status(400).json({ error: 'bookId is required for view type' });
  }

  try {
    const insertData = {
      user_id: userId,
      type,
      query: type === 'search' ? query : null,
      book_id: type === 'view' ? bookId : null
    };

    const { data, error } = await supabase
      .from('search_history')
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      entry: {
        id: data.id,
        userId: data.user_id,
        type: data.type,
        query: data.query,
        bookId: data.book_id,
        createdAt: data.created_at
      }
    });
  } catch (err) {
    console.error("Record Search History Error:", err);
    res.status(500).json({ error: 'Failed to record search history' });
  }
});

// GET /api/search-history/:userId - Get recent search history for a user
// Requirements: 5.1, 5.2
app.get('/api/search-history/:userId', async (req, res) => {
  if (checkDb(res)) return;
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 50;

  try {
    const { data, error } = await supabase
      .from('search_history')
      .select(`
        id,
        user_id,
        type,
        query,
        book_id,
        created_at,
        books (
          id,
          title,
          author,
          cover_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const history = (data || []).map(h => ({
      id: h.id,
      userId: h.user_id,
      type: h.type,
      query: h.query,
      bookId: h.book_id,
      createdAt: h.created_at,
      book: h.books ? {
        id: h.books.id,
        title: h.books.title,
        author: h.books.author,
        coverUrl: h.books.cover_url
      } : null
    }));

    res.json(history);
  } catch (err) {
    console.error("Get Search History Error:", err);
    res.status(500).json({ error: 'Failed to fetch search history' });
  }
});

// DELETE /api/search-history/:userId - Clear all search history for a user
// Requirements: 5.4
app.delete('/api/search-history/:userId', async (req, res) => {
  if (checkDb(res)) return;
  const { userId } = req.params;

  try {
    const { error } = await supabase
      .from('search_history')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Search history cleared successfully' });
  } catch (err) {
    console.error("Clear Search History Error:", err);
    res.status(500).json({ error: 'Failed to clear search history' });
  }
});

// --- EXTRACTION JOB ROUTES ---
// Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2, 5.3, 5.4

// Default limits (Requirement 2.6)
const DEFAULT_MAX_TIME_MINUTES = 60;
const DEFAULT_MAX_BOOKS = 100;

// Valid state transitions (Property 5: Job State Transitions)
const VALID_TRANSITIONS = {
  'pending': ['running'],
  'running': ['paused', 'completed', 'stopped', 'failed'],
  'paused': ['running', 'stopped'],
  'completed': [],
  'failed': [],
  'stopped': []
};

// Helper function to validate state transitions
function isValidTransition(fromStatus, toStatus) {
  const validTargets = VALID_TRANSITIONS[fromStatus] || [];
  return validTargets.includes(toStatus);
}

// POST /api/admin/extractions - Create a new extraction job
// Requirements: 1.1, 2.1, 2.2, 2.6
app.post('/api/admin/extractions', async (req, res) => {
  if (checkDb(res)) return;
  const { sourceUrl, adminId, maxTimeMinutes, maxBooks } = req.body;

  if (!sourceUrl) {
    return res.status(400).json({ error: 'sourceUrl is required' });
  }

  if (!adminId) {
    return res.status(400).json({ error: 'adminId is required' });
  }

  try {
    // Apply default limits if not specified (Requirement 2.6)
    const effectiveMaxTime = maxTimeMinutes ?? DEFAULT_MAX_TIME_MINUTES;
    const effectiveMaxBooks = maxBooks ?? DEFAULT_MAX_BOOKS;

    const { data, error } = await supabase
      .from('extraction_jobs')
      .insert({
        source_url: sourceUrl,
        created_by: adminId,
        max_time_minutes: effectiveMaxTime,
        max_books: effectiveMaxBooks,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Log job creation
    await supabase.from('extraction_logs').insert({
      job_id: data.id,
      level: 'info',
      message: 'Extraction job created',
      details: { source_url: sourceUrl, max_time_minutes: effectiveMaxTime, max_books: effectiveMaxBooks }
    });

    res.status(201).json({ success: true, job: data });
  } catch (err) {
    console.error("Create Extraction Job Error:", err);
    res.status(500).json({ error: 'Failed to create extraction job' });
  }
});

// GET /api/admin/extractions - List all extraction jobs
// Requirement 6.1
app.get('/api/admin/extractions', async (req, res) => {
  if (checkDb(res)) return;
  const { adminId } = req.query;

  try {
    let query = supabase
      .from('extraction_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (adminId) {
      query = query.eq('created_by', adminId);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error("List Extraction Jobs Error:", err);
    res.status(500).json({ error: 'Failed to list extraction jobs' });
  }
});

// GET /api/admin/extractions/:id - Get extraction job details
// Requirement 6.3
app.get('/api/admin/extractions/:id', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('extraction_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    res.json(data);
  } catch (err) {
    console.error("Get Extraction Job Error:", err);
    res.status(500).json({ error: 'Failed to get extraction job' });
  }
});

// POST /api/admin/extractions/:id/start - Start an extraction job
// Requirement 5.1 (state transition: pending → running)
app.post('/api/admin/extractions/:id/start', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;

  try {
    // Get current job status
    const { data: job, error: fetchError } = await supabase
      .from('extraction_jobs')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    // Validate state transition
    if (!isValidTransition(job.status, 'running')) {
      return res.status(400).json({ 
        error: `Invalid status transition from ${job.status} to running` 
      });
    }

    // Update job status
    const { data, error } = await supabase
      .from('extraction_jobs')
      .update({ 
        status: 'running',
        started_at: job.status === 'pending' ? new Date().toISOString() : undefined
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log status change
    await supabase.from('extraction_logs').insert({
      job_id: id,
      level: 'info',
      message: `Job status changed from ${job.status} to running`,
      details: { previous_status: job.status, new_status: 'running' }
    });

    res.json({ success: true, job: data });
  } catch (err) {
    console.error("Start Extraction Job Error:", err);
    res.status(500).json({ error: 'Failed to start extraction job' });
  }
});

// POST /api/admin/extractions/:id/pause - Pause an extraction job
// Requirement 5.1: Suspend processing and retain current progress
app.post('/api/admin/extractions/:id/pause', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;

  try {
    // Get current job status
    const { data: job, error: fetchError } = await supabase
      .from('extraction_jobs')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    // Validate state transition
    if (!isValidTransition(job.status, 'paused')) {
      return res.status(400).json({ 
        error: `Invalid status transition from ${job.status} to paused` 
      });
    }

    // Update job status (progress is automatically retained)
    const { data, error } = await supabase
      .from('extraction_jobs')
      .update({ status: 'paused' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log status change
    await supabase.from('extraction_logs').insert({
      job_id: id,
      level: 'info',
      message: `Job status changed from ${job.status} to paused`,
      details: { previous_status: job.status, new_status: 'paused' }
    });

    res.json({ success: true, job: data });
  } catch (err) {
    console.error("Pause Extraction Job Error:", err);
    res.status(500).json({ error: 'Failed to pause extraction job' });
  }
});

// POST /api/admin/extractions/:id/resume - Resume a paused extraction job
// Requirement 5.2: Continue processing from where it stopped
app.post('/api/admin/extractions/:id/resume', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;

  try {
    // Get current job status
    const { data: job, error: fetchError } = await supabase
      .from('extraction_jobs')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    // Validate state transition (paused → running)
    if (!isValidTransition(job.status, 'running')) {
      return res.status(400).json({ 
        error: `Invalid status transition from ${job.status} to running` 
      });
    }

    // Update job status (progress is preserved, started_at is NOT reset)
    const { data, error } = await supabase
      .from('extraction_jobs')
      .update({ status: 'running' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log status change
    await supabase.from('extraction_logs').insert({
      job_id: id,
      level: 'info',
      message: `Job status changed from ${job.status} to running (resumed)`,
      details: { previous_status: job.status, new_status: 'running' }
    });

    res.json({ success: true, job: data });
  } catch (err) {
    console.error("Resume Extraction Job Error:", err);
    res.status(500).json({ error: 'Failed to resume extraction job' });
  }
});

// POST /api/admin/extractions/:id/stop - Stop an extraction job
// Requirements 5.3, 5.4: Terminate and retain all extracted books
app.post('/api/admin/extractions/:id/stop', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;

  try {
    // Get current job status
    const { data: job, error: fetchError } = await supabase
      .from('extraction_jobs')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    // Validate state transition
    if (!isValidTransition(job.status, 'stopped')) {
      return res.status(400).json({ 
        error: `Invalid status transition from ${job.status} to stopped` 
      });
    }

    // Update job status (books are retained via foreign key relationship)
    const { data, error } = await supabase
      .from('extraction_jobs')
      .update({ 
        status: 'stopped',
        completed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log status change
    await supabase.from('extraction_logs').insert({
      job_id: id,
      level: 'info',
      message: `Job status changed from ${job.status} to stopped`,
      details: { previous_status: job.status, new_status: 'stopped' }
    });

    res.json({ success: true, job: data });
  } catch (err) {
    console.error("Stop Extraction Job Error:", err);
    res.status(500).json({ error: 'Failed to stop extraction job' });
  }
});

// GET /api/admin/extractions/:id/progress - Get real-time progress
// Requirements: 4.1, 4.2, 4.3
app.get('/api/admin/extractions/:id/progress', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;

  try {
    const { data: job, error } = await supabase
      .from('extraction_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!job) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    // Calculate elapsed time
    let elapsedSeconds = 0;
    if (job.started_at) {
      elapsedSeconds = Math.floor((Date.now() - new Date(job.started_at).getTime()) / 1000);
    }

    // Estimate remaining time based on progress
    let estimatedRemainingSeconds = 0;
    if (job.books_extracted > 0 && job.books_queued > job.books_extracted) {
      const avgTimePerBook = elapsedSeconds / job.books_extracted;
      estimatedRemainingSeconds = Math.floor(avgTimePerBook * (job.books_queued - job.books_extracted));
    }

    res.json({
      job_id: job.id,
      status: job.status,
      books_extracted: job.books_extracted,
      books_queued: job.books_queued,
      error_count: job.error_count,
      elapsed_seconds: elapsedSeconds,
      estimated_remaining_seconds: estimatedRemainingSeconds,
      max_time_minutes: job.max_time_minutes,
      max_books: job.max_books
    });
  } catch (err) {
    console.error("Get Extraction Progress Error:", err);
    res.status(500).json({ error: 'Failed to get extraction progress' });
  }
});

// GET /api/admin/extractions/:id/books - Get extracted books for a job
// Requirement 6.3
app.get('/api/admin/extractions/:id/books', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('extracted_books')
      .select(`
        *,
        categories (name)
      `)
      .eq('job_id', id)
      .order('extracted_at', { ascending: false });

    if (error) throw error;

    const books = (data || []).map(b => ({
      ...b,
      category_name: b.categories?.name || null
    }));

    res.json(books);
  } catch (err) {
    console.error("Get Extracted Books Error:", err);
    res.status(500).json({ error: 'Failed to get extracted books' });
  }
});

// GET /api/admin/extractions/:id/logs - Get extraction logs
// Requirement 4.4
app.get('/api/admin/extractions/:id/logs', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const limit = parseInt(req.query.limit) || 100;

  try {
    const { data, error } = await supabase
      .from('extraction_logs')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error("Get Extraction Logs Error:", err);
    res.status(500).json({ error: 'Failed to get extraction logs' });
  }
});

// DELETE /api/admin/extractions/:id - Delete an extraction job
// Requirement 6.4
app.delete('/api/admin/extractions/:id', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;

  try {
    // Get job status first
    const { data: job, error: fetchError } = await supabase
      .from('extraction_jobs')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return res.status(404).json({ error: 'Extraction job not found' });
    }

    // Only allow deletion of failed, stopped, or completed jobs
    if (!['failed', 'stopped', 'completed'].includes(job.status)) {
      return res.status(400).json({ 
        error: 'Can only delete failed, stopped, or completed jobs' 
      });
    }

    // Delete logs first (due to foreign key)
    await supabase.from('extraction_logs').delete().eq('job_id', id);
    
    // Delete extracted books (due to foreign key)
    await supabase.from('extracted_books').delete().eq('job_id', id);
    
    // Delete the job
    const { error } = await supabase
      .from('extraction_jobs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error("Delete Extraction Job Error:", err);
    res.status(500).json({ error: 'Failed to delete extraction job' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    database: supabase ? 'connected' : 'not configured',
    ai: OPENROUTER_API_KEY ? 'configured' : 'not configured'
  });
});

export default app;
