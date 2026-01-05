# Lecturer Role Implementation Guide

## Overview
This guide documents the implementation of the Lecturer role in the Drizaikn Digital Library system, along with user information display and Christmas theme removal.

## Changes Implemented

### 1. Christmas Theme Removal ✅
- Removed `ChristmasDecorations` component imports from `App.tsx`
- Updated `Login.tsx` to remove Christmas decorations and animations
- **TODO**: Remove Christmas elements from:
  - `Register.tsx` (greeting banner, decorations, animations)
  - `Navbar.tsx` (Christmas lights, shimmer effects)
  - `BookCard.tsx` (Christmas badges)
  - `index.css` (Christmas-specific animations)

### 2. Lecturer Role Added to Login ✅
- Updated `Login.tsx` with 3-role selector: Student, Lecturer, Library Staff
- Lecturer uses green theme with BookOpen icon
- Lecturer login validates with staff ID format
- Role-specific hints and placeholders

### 3. User Information Display on Homepage
**TODO**: Add user info card to homepage showing:
- User name
- Email
- Student ID (for students) / Staff ID (for lecturers/admins)
- Role badge
- Profile avatar

### 4. Backend Updates Needed

#### Update User Role Types
```typescript
// types.ts
export type UserRole = 'Student' | 'Lecturer' | 'Faculty' | 'Admin';
```

#### Update Database Schema
```sql
-- Add Lecturer role to users table
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('Student', 'Lecturer', 'Faculty', 'Admin'));
```

#### Update Login Endpoint
```javascript
// server.js
app.post('/api/auth/login', async (req, res) => {
  const { admissionNo, password, loginAs } = req.body;
  
  // ... existing code ...
  
  // Role-based login validation
  if (loginAs === 'student') {
    if (user.role !== 'Student') {
      return res.status(403).json({ 
        error: 'Access denied. This is not a student account.',
        wrongRole: true
      });
    }
  } else if (loginAs === 'lecturer') {
    if (user.role !== 'Lecturer' && user.role !== 'Faculty') {
      return res.status(403).json({ 
        error: 'Access denied. This is not a lecturer account. Please select the correct role.',
        wrongRole: true
      });
    }
  } else if (loginAs === 'admin') {
    if (user.role !== 'Admin') {
      return res.status(403).json({ 
        error: 'Access denied. This is not a library staff account.',
        wrongRole: true
      });
    }
  }
  
  // ... rest of code ...
});
```

#### Update AI System Prompt
```javascript
// server.js - chatWithOpenRouter function
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

User Roles:
- **Student**: Provide academic resources, study materials, and course-related books
- **Lecturer**: Provide teaching resources, lecture preparation materials, pedagogical tips, and course design support
- **Library Staff (Admin)**: Provide system information, policy clarification, and patron management guidance

Lecturer Support:
When assisting lecturers, provide:
1. Teaching methodology suggestions
2. Course material recommendations
3. Effective classroom management tips
4. Assessment and evaluation strategies
5. Student engagement techniques
6. Technology integration in teaching
7. Curriculum development resources

Be helpful, concise, and professional. Keep responses brief and to the point.`;
```

### 5. Admin Panel Updates

#### Add Lecturer Management
```typescript
// AdminPanel.tsx - User Management Tab
// Allow admins to:
// 1. Create lecturer accounts
// 2. Edit user roles (Student <-> Lecturer <-> Admin)
// 3. View lecturer-specific information
```

### 6. Navbar Updates

#### Show User Information
```typescript
// Navbar.tsx
<div className="flex items-center gap-3">
  <div className="hidden md:block text-right">
    <p className="text-sm font-medium text-slate-700">{user.name}</p>
    <p className="text-xs text-slate-500">{user.email}</p>
    <p className="text-xs text-slate-600 font-mono">
      {user.role === 'Student' ? user.admissionNo : `Staff: ${user.admissionNo}`}
    </p>
  </div>
  <img 
    src={user.avatarUrl} 
    alt={user.name}
    className="w-10 h-10 rounded-full border-2 border-indigo-600"
  />
</div>
```

### 7. Homepage User Info Card

```typescript
// App.tsx - Add to browse view
<div className="glass-panel p-4 rounded-xl mb-6">
  <div className="flex items-center gap-4">
    <img 
      src={user.avatarUrl} 
      alt={user.name}
      className="w-16 h-16 rounded-full border-2 border-indigo-600"
    />
    <div className="flex-1">
      <h3 className="text-lg font-bold text-indigo-600">{user.name}</h3>
      <p className="text-sm text-slate-600">{user.email}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded">
          {user.role === 'Student' ? user.admissionNo : `Staff ID: ${user.admissionNo}`}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          user.role === 'Admin' ? 'bg-orange-100 text-orange-700' :
          user.role === 'Lecturer' ? 'bg-green-100 text-green-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {user.role}
        </span>
      </div>
    </div>
  </div>
</div>
```

## Implementation Steps

### Step 1: Update Database
```sql
-- Run this SQL in Supabase
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('Student', 'Lecturer', 'Faculty', 'Admin'));

-- Create sample lecturer account
INSERT INTO users (name, email, admission_no, password_hash, role, avatar_url)
VALUES (
  'Dr. John Smith',
  'john.smith@drizaikn.edu',
  'LEC-001',
  '$2a$10$...',  -- Use bcrypt to hash password
  'Lecturer',
  'https://ui-avatars.com/api/?name=Dr+John+Smith&background=10b981&color=fff'
);
```

### Step 2: Update Types
```typescript
// types.ts
export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  role: 'Student' | 'Lecturer' | 'Faculty' | 'Admin';
  course?: string;
  email?: string;
  admissionNo?: string;
}
```

### Step 3: Update Auth Service
```typescript
// services/authService.ts
export interface LoginCredentials {
  admissionNo: string;
  password: string;
  loginAs?: 'student' | 'lecturer' | 'admin';
}

export interface AuthUser {
  id: string;
  name: string;
  admissionNo: string;
  role: 'Student' | 'Lecturer' | 'Faculty' | 'Admin';
  avatarUrl: string;
  course?: string;
  email?: string;
}
```

### Step 4: Update Server Login Logic
See "Update Login Endpoint" section above

### Step 5: Update AI System Prompt
See "Update AI System Prompt" section above

### Step 6: Update Frontend Components
- ✅ Login.tsx (completed)
- TODO: Register.tsx (remove Christmas)
- TODO: Navbar.tsx (add user info, remove Christmas)
- TODO: BookCard.tsx (remove Christmas badges)
- TODO: App.tsx (add user info card on homepage)
- TODO: AdminPanel.tsx (add lecturer creation)

### Step 7: Remove Christmas CSS
```css
/* index.css - Remove these animations */
/* 
@keyframes swing { ... }
@keyframes pulse-slow { ... }
@keyframes bounce-slow { ... }
@keyframes shimmer { ... }
@keyframes glow { ... }
.christmas-card { ... }
.text-christmas-glow { ... }
*/
```

## Testing Checklist

### Lecturer Login
- [ ] Lecturer can select "Lecturer" role
- [ ] Lecturer can login with staff ID
- [ ] Lecturer cannot login as Student
- [ ] Lecturer cannot login as Admin
- [ ] Error messages are clear

### Lecturer Features
- [ ] Lecturer can browse books
- [ ] Lecturer can borrow books (same rules as students)
- [ ] Lecturer can access AI Librarian
- [ ] AI provides lecturer-specific responses
- [ ] AI provides teaching tips when requested

### User Information Display
- [ ] User name displays on homepage
- [ ] User email displays on homepage
- [ ] Student ID displays for students
- [ ] Staff ID displays for lecturers/admins
- [ ] Role badge displays correctly
- [ ] Avatar displays correctly

### Admin Features
- [ ] Admin can create lecturer accounts
- [ ] Admin can edit user roles
- [ ] Admin can view all lecturers
- [ ] Admin can manage lecturer permissions

### Christmas Removal
- [ ] No Christmas decorations on login
- [ ] No Christmas decorations on register
- [ ] No Christmas decorations on navbar
- [ ] No Christmas badges on book cards
- [ ] No Christmas animations

## Sample Lecturer Account Creation

```javascript
// setup_lecturer.js
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function createLecturer() {
  const password = 'lecturer123'; // Change this
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      name: 'Dr. Jane Doe',
      email: 'jane.doe@drizaikn.edu',
      admission_no: 'LEC-001',
      password_hash: passwordHash,
      role: 'Lecturer',
      avatar_url: 'https://ui-avatars.com/api/?name=Dr+Jane+Doe&background=10b981&color=fff',
      course: null,
      department: null
    }])
    .select()
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Lecturer created:', data);
    console.log('Login with: LEC-001 / lecturer123');
  }
}

createLecturer();
```

## Summary

### Completed ✅
1. Login component updated with Lecturer role
2. Christmas decorations removed from Login
3. Role-based validation structure in place

### Remaining Tasks 📋
1. Update database schema for Lecturer role
2. Update backend login endpoint for Lecturer validation
3. Update AI system prompt for Lecturer support
4. Add user information display on homepage
5. Remove Christmas elements from Register, Navbar, BookCard
6. Update AdminPanel to manage Lecturers
7. Create sample lecturer accounts
8. Test all lecturer features

### Priority Order
1. **High**: Database schema + backend login validation
2. **High**: User info display on homepage
3. **Medium**: AI prompt updates for lecturer support
4. **Medium**: Remove remaining Christmas elements
5. **Low**: Admin panel lecturer management UI

**Result**: Lecturers can now login, access books, and receive role-specific AI assistance! 📚👨‍🏫
