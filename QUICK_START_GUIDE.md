# Quick Start Guide - Lecturer Role Implementation

## 🚀 Quick Setup (5 Minutes)

### Step 1: Update Database (1 minute)
```bash
# Open Supabase SQL Editor and run:
```
```sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('Student', 'Lecturer', 'Faculty', 'Admin'));
```

### Step 2: Create Lecturer Accounts (1 minute)
```bash
node setup_lecturer.js
```

### Step 3: Test Login (1 minute)
1. Open http://localhost:3000
2. Select "Lecturer" role
3. Login with: `LEC-001` / `lecturer123`

### Step 4: Test Features (2 minutes)
- ✅ Browse books
- ✅ Borrow a book
- ✅ Ask AI for teaching tips
- ✅ Check user info on homepage

## 📋 What's New

### Login Page
- Now has 3 roles: **Student** | **Lecturer** | **Library Staff**
- Lecturer uses green theme with book icon
- Role-specific validation

### Homepage
- Shows user info card with:
  - Name, Email, ID, Role badge

### AI Librarian
- Provides teaching tips for lecturers
- Suggests course materials
- Offers pedagogical guidance

### Removed
- ❌ Christmas decorations (partially)
- ❌ Christmas animations (partially)

## 🎯 Test Accounts

| Role | ID | Password |
|------|-----|----------|
| Student | DRZ/GV/1234/2023 | (register new) |
| Lecturer | LEC-001 | lecturer123 |
| Lecturer | LEC-002 | lecturer123 |
| Admin | LIB-STAFF-001 | (existing) |

## 💡 Quick Tips

### For Lecturers
- Ask AI: "Give me teaching tips for engaging students"
- Ask AI: "Recommend books for my computer science course"
- Ask AI: "How can I improve my classroom management?"

### For Students
- Same as before - no changes

### For Admins
- Can now see Lecturer role in user management
- Can edit user roles to/from Lecturer

## 🐛 Troubleshooting

**Problem**: Can't login as Lecturer
- **Solution**: Run database migration first

**Problem**: Role mismatch error
- **Solution**: Select correct role on login page

**Problem**: AI not giving teaching tips
- **Solution**: Make sure you're logged in as Lecturer

## 📚 Documentation

- Full Guide: `LECTURER_ROLE_IMPLEMENTATION_GUIDE.md`
- Summary: `IMPLEMENTATION_SUMMARY.md`
- This Guide: `QUICK_START_GUIDE.md`

## ✅ Checklist

- [ ] Run database migration
- [ ] Create lecturer accounts
- [ ] Test lecturer login
- [ ] Test book borrowing
- [ ] Test AI responses
- [ ] Remove remaining Christmas elements (optional)

**Time to complete**: ~5 minutes
**Difficulty**: Easy ⭐

---

**Ready to go!** 🎓📚
