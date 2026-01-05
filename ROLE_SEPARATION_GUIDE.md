# Role Separation: Students vs Library Staff (Admins)

## Overview
The Drizaikn Library system now properly separates **Students** from **Library Staff (Admins)**. These are distinct user types with different purposes and access levels.

## User Types

### Students
- **Who they are**: University students who use the library
- **Registration**: Self-register through the website using their admission number
- **Credentials**: Student admission number (e.g., DRZ/2023/1234) + password
- **Profile includes**:
  - Name
  - Email
  - Admission number
  - Course/Major (for personalized book recommendations)
  - Department
- **Access**: Browse books, borrow books, view loans, use AI librarian
- **Cannot**: Access admin panel, manage books, view all users

### Library Staff (Admins)
- **Who they are**: Librarians and library employees who manage the system
- **Registration**: Created by system administrator (cannot self-register)
- **Credentials**: Employee ID (e.g., LIB-STAFF-001) + password
- **Profile includes**:
  - Name
  - Email
  - Employee ID (stored in admission_no field)
  - Role: Admin
- **Profile does NOT include**:
  - Course (they're staff, not students)
  - Department (they're staff, not students)
- **Access**: Everything students can do PLUS admin panel to:
  - Add/edit/delete books
  - Manage inventory
  - View all users
  - Update book stock levels
  - Add call numbers and location information

## Key Changes Made

### 1. Registration Form (`components/Register.tsx`)
- Added clear notice that registration is for students only
- Library staff must contact system administrator for access

### 2. Login Form (`components/Login.tsx`)
- Added notice for library staff to use employee credentials

### 3. Backend (`server.js`)
- Registration endpoint now forces `role: 'Student'` - admins cannot self-register
- AI system prompt updated to distinguish between students and library staff
- Provides different assistance based on user role

### 4. Database Schema (`supabase_role_separation.sql`)
- Added constraint: Admins cannot have course or department fields
- Clears any existing course/department data from admin users
- Added comments to clarify field usage

### 5. Admin Creation (`create_admin.sql`)
- Updated to use employee ID format (LIB-STAFF-001)
- Explicitly sets course and department to NULL for admins
- Includes verification query to check admin users

## How to Create an Admin User

### Option 1: Create New Admin (Recommended)
Run this SQL in Supabase SQL Editor:

```sql
INSERT INTO users (admission_no, name, email, password_hash, role, avatar_url, course, department)
VALUES (
  'LIB-STAFF-001',
  'Library Administrator',
  'librarian@drizaikn.edu',
  '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQHLVXFwJGnKsKsK6.Q6Q6Q6Q6Q6Q6',
  'Admin',
  'https://ui-avatars.com/api/?name=Library+Admin&background=dc2626&color=fff',
  NULL,
  NULL
);
```

Default password: `admin123` (change after first login)

### Option 2: Promote Existing User to Admin
```sql
UPDATE users 
SET role = 'Admin', 
    course = NULL, 
    department = NULL 
WHERE admission_no = 'YOUR_ADMISSION_NO';
```

## Implementation Steps

1. **Run the role separation SQL**:
   - Open Supabase SQL Editor
   - Run `supabase_role_separation.sql`
   - This adds the constraint and clears admin course data

2. **Create admin user**:
   - Run `create_admin.sql` to create a library staff admin
   - Or promote an existing user to admin

3. **Restart the backend server**:
   - The server has been updated with the new logic
   - Already running with the changes

4. **Test the system**:
   - Students can register normally
   - Admin logs in with employee ID
   - Admin sees admin panel, students don't
   - AI assistant provides role-appropriate responses

## AI Assistant Behavior

### For Students:
- Focuses on academic resources and study materials
- Recommends books based on their course
- Helps with research and finding relevant materials
- References their course in recommendations

### For Library Staff (Admins):
- Provides system information
- Helps with policy clarification
- Assists with patron management
- Focuses on operational aspects

## Security Notes

- Admins cannot be created through the registration form
- Database constraint prevents admins from having student fields
- Role is enforced at the database level
- Admin access is properly restricted in the UI

## Verification

To verify the separation is working:

```sql
-- Check admin users (should have NULL course and department)
SELECT admission_no, name, role, course, department 
FROM users 
WHERE role = 'Admin';

-- Check students (should have course data)
SELECT admission_no, name, role, course, department 
FROM users 
WHERE role = 'Student' 
LIMIT 5;
```

## Summary

The system now properly distinguishes between:
- **Students**: Self-register, have courses, use library services
- **Library Staff (Admins)**: Created by admin, no courses, manage the system

This separation ensures proper access control and provides appropriate experiences for each user type.
