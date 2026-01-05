# Login Role Selector Feature

## Overview
The login page now includes a role selector that allows users to choose whether they're logging in as a **Student** or **Library Staff (Admin)** before entering their credentials.

## Features

### 1. Visual Role Selection
- **Two large buttons** at the top of the login form
- **Student Button**: 
  - Blue theme with graduation cap icon
  - Indicates student login
  - Shows admission number field
  
- **Library Staff Button**:
  - Orange/red theme with briefcase icon
  - Indicates admin/staff login
  - Shows employee ID field

### 2. Dynamic Form Labels
The form adapts based on selected role:

#### When "Student" is selected:
- Label: "Admission Number"
- Placeholder: "e.g., DRZ/2023/1234"
- Hint: "Students: Use your admission number and password"
- Button: "Log In" (blue gradient)
- Footer: Shows "Create Account" link

#### When "Library Staff" is selected:
- Label: "Employee ID"
- Placeholder: "e.g., LIB-STAFF-001"
- Hint: "Library Staff: Use your employee ID and password"
- Button: "Access Admin Panel" (orange/red gradient)
- Footer: Shows "Library staff accounts are created by the system administrator"

### 3. Visual Feedback
- **Selected role** is highlighted with:
  - Colored border (blue for student, orange for admin)
  - Colored background tint
  - Colored icon
  - Shadow effect
  
- **Unselected role** appears:
  - Gray border
  - White background
  - Gray icon
  - Hover effect for easy switching

### 4. Role-Specific Hints
- Blue info box for students
- Amber info box for library staff
- Clear instructions for each role type

## User Experience

### Student Login Flow:
1. Open login page
2. "Student" is selected by default
3. See admission number field
4. Enter Drizaikn admission number
5. Enter password
6. Click blue "Log In" button
7. Access student features (Browse, My Loans, AI Librarian)

### Library Staff Login Flow:
1. Open login page
2. Click "Library Staff" button
3. See employee ID field change
4. Enter employee ID (e.g., LIB-STAFF-001)
5. Enter password
6. Click orange "Access Admin Panel" button
7. Access admin features (Browse, AI Librarian, Admin Panel)

## Visual Design

### Color Scheme:
- **Student**: Blue (#1A365D) - matches university branding
- **Library Staff**: Orange/Red (#f97316 to #ef4444) - distinct admin color
- **Inactive**: Gray (#e2e8f0) - neutral state

### Icons:
- **Student**: Graduation Cap (GraduationCap from lucide-react)
- **Library Staff**: Briefcase (Briefcase from lucide-react)

### Layout:
```
┌─────────────────────────────────┐
│         Drizaikn Logo               │
│      Welcome Back               │
│                                 │
│  I am a:                        │
│  ┌──────────┐  ┌──────────┐   │
│  │  🎓      │  │  💼      │   │
│  │ Student  │  │  Staff   │   │
│  └──────────┘  └──────────┘   │
│                                 │
│  [Info Box]                     │
│                                 │
│  Admission Number / Employee ID │
│  [Input Field]                  │
│                                 │
│  Password                       │
│  [Input Field]                  │
│                                 │
│  [Log In / Access Admin Panel]  │
│                                 │
│  ─────────────────────────      │
│  New student? Create Account    │
│  or                             │
│  Staff accounts by admin        │
└─────────────────────────────────┘
```

## Benefits

### For Users:
- **Clear distinction** between student and staff login
- **No confusion** about which credentials to use
- **Visual guidance** with icons and colors
- **Contextual help** with role-specific hints

### For the System:
- **Better UX** - users know exactly what to enter
- **Reduced errors** - clear labeling prevents wrong credential types
- **Professional appearance** - polished, modern interface
- **Accessibility** - clear visual indicators and labels

## Technical Implementation

### Files Modified:
1. **components/Login.tsx**
   - Added role state (`selectedRole`)
   - Added role selector buttons
   - Dynamic form labels based on role
   - Conditional styling and text
   - Role-specific hints and footer

### State Management:
```typescript
type LoginRole = 'student' | 'admin';
const [selectedRole, setSelectedRole] = useState<LoginRole>('student');
```

### Conditional Rendering:
- Form labels change based on `selectedRole`
- Placeholders adapt to role type
- Button text and color change
- Footer message changes
- Info boxes show role-specific guidance

## Default Behavior
- **Student** is selected by default
- Most users are students, so this reduces clicks
- Library staff can easily switch to their role

## Future Enhancements

Potential additions:
- Remember last selected role (localStorage)
- Faculty role option (if needed)
- Quick switch between roles without clearing form
- Role-based password requirements display
- Forgot password flow per role type

## Testing Checklist

### As a Student:
- [ ] Default selection is "Student"
- [ ] Blue theme is applied
- [ ] Admission number label shows
- [ ] Student hint appears
- [ ] Blue login button shows
- [ ] "Create Account" link visible
- [ ] Can successfully log in

### As Library Staff:
- [ ] Can click "Library Staff" button
- [ ] Orange theme is applied
- [ ] Employee ID label shows
- [ ] Staff hint appears
- [ ] Orange "Access Admin Panel" button shows
- [ ] Admin message in footer
- [ ] Can successfully log in with employee ID

### Visual Testing:
- [ ] Icons display correctly
- [ ] Colors match design
- [ ] Hover effects work
- [ ] Selected state is clear
- [ ] Mobile responsive
- [ ] Smooth transitions

## Summary

The login page now provides:
✅ Clear role selection (Student vs Library Staff)
✅ Visual distinction with icons and colors
✅ Dynamic form labels and placeholders
✅ Role-specific guidance and hints
✅ Professional, modern interface
✅ Better user experience and reduced confusion

Users can now easily identify which type of account they're logging in with!
