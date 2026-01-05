# Admission Number Format Validation Guide

## Overview
The login and registration system now enforces proper admission number formats for students, while allowing flexible employee IDs for library staff (admins).

## Admission Number Formats

### For Students:
Students must use one of two standardized formats:

#### Format 1: With "GV" Designation
```
PREFIX/GV/NUMBER/YEAR
```
**Example**: `DRZ/GV/1234/2023`

**Components**:
- **PREFIX**: Alphanumeric institution code (e.g., DRZ, SCH, DEPT)
- **GV**: Government designation (literal "GV")
- **NUMBER**: Numeric student ID (e.g., 1234, 0001, 9999)
- **YEAR**: 4-digit year (e.g., 2023, 2024)

#### Format 2: Without "GV" Designation
```
PREFIX/NUMBER/YEAR
```
**Example**: `DRZ/1234/2023`

**Components**:
- **PREFIX**: Alphanumeric institution code
- **NUMBER**: Numeric student ID
- **YEAR**: 4-digit year

### For Library Staff (Admins):
Admins can use any employee ID format:
- **Example**: `LIB-STAFF-001`
- **Example**: `ADMIN-2023-01`
- **Example**: `LIBRARIAN-JOHN`

No specific format is enforced for admin employee IDs.

## Validation Rules

### Student Admission Numbers:
✅ **Valid Examples**:
- `DRZ/GV/1234/2023`
- `DRZ/GV/0001/2024`
- `SCH/GV/9999/2022`
- `DRZ/1234/2023`
- `DEPT/5678/2024`
- `ABC123/GV/1000/2023`

❌ **Invalid Examples**:
- `DRZ/2023/1234` (wrong order)
- `DRZ-1234-2023` (wrong separator)
- `DRZ/1234/23` (year must be 4 digits)
- `DRZ/GV/ABC/2023` (number must be numeric)
- `1234/2023` (missing prefix)
- `DRZ/1234` (missing year)

### Admin Employee IDs:
✅ **All formats accepted** - no validation

## Implementation

### Backend Validation (`server.js`)

#### Validation Function:
```javascript
function validateAdmissionNumber(admissionNo) {
  // Format 1: XXX/GV/NNNN/YYYY (e.g., DRZ/GV/1234/2023)
  // Format 2: XXX/NNNN/YYYY (e.g., DRZ/1234/2023)
  const format1 = /^[A-Za-z0-9]+\/GV\/\d+\/\d{4}$/;
  const format2 = /^[A-Za-z0-9]+\/\d+\/\d{4}$/;
  
  return format1.test(admissionNo) || format2.test(admissionNo);
}
```

#### Registration Endpoint:
The `/api/auth/register` endpoint validates admission numbers before creating accounts:
- Returns 400 error if format is invalid
- Error message: "Invalid admission number format. Use: XXX/GV/NNNN/YYYY or XXX/NNNN/YYYY"
- Prevents invalid admission numbers from being stored in database

### Login Component (`components/Login.tsx`)

#### Features:
1. **Role Selection**: User chooses Student or Library Staff
2. **Dynamic Validation**: Only validates students
3. **Real-time Feedback**: Shows error if format is wrong
4. **Format Hints**: Displays expected format below input
5. **Uppercase Input**: Automatically converts to uppercase

#### Validation Function:
```typescript
const validateAdmissionNumber = (value: string): boolean => {
  if (selectedRole === 'admin') {
    return value.length > 0; // Any format for admin
  }
  
  // Student formats
  const format1 = /^[A-Za-z0-9]+\/GV\/\d+\/\d{4}$/;
  const format2 = /^[A-Za-z0-9]+\/\d+\/\d{4}$/;
  
  return format1.test(value) || format2.test(value);
};
```

#### Error Messages:
- **Student**: "Invalid admission number format. Use: XXX/GV/NNNN/YYYY or XXX/NNNN/YYYY"
- **Admin**: No validation errors

### Register Component (`components/Register.tsx`)

#### Features:
1. **Student-Only Registration**: Only students can self-register
2. **Format Validation**: Enforces admission number format
3. **Inline Examples**: Shows format examples below input
4. **Error Display**: Red banner shows validation errors
5. **Uppercase Input**: Automatically converts to uppercase

#### Validation Function:
```typescript
const validateAdmissionNumber = (value: string): boolean => {
  const format1 = /^[A-Za-z0-9]+\/GV\/\d+\/\d{4}$/;
  const format2 = /^[A-Za-z0-9]+\/\d+\/\d{4}$/;
  
  return format1.test(value) || format2.test(value);
};
```

## Regular Expression Breakdown

### Format 1: `^[A-Za-z0-9]+\/GV\/\d+\/\d{4}$`
- `^` - Start of string
- `[A-Za-z0-9]+` - One or more alphanumeric characters (PREFIX)
- `\/` - Literal forward slash
- `GV` - Literal "GV"
- `\/` - Literal forward slash
- `\d+` - One or more digits (NUMBER)
- `\/` - Literal forward slash
- `\d{4}` - Exactly 4 digits (YEAR)
- `$` - End of string

### Format 2: `^[A-Za-z0-9]+\/\d+\/\d{4}$`
- `^` - Start of string
- `[A-Za-z0-9]+` - One or more alphanumeric characters (PREFIX)
- `\/` - Literal forward slash
- `\d+` - One or more digits (NUMBER)
- `\/` - Literal forward slash
- `\d{4}` - Exactly 4 digits (YEAR)
- `$` - End of string

## User Experience

### Login Flow:

#### As Student:
1. Select "Student" role
2. See format hint: "Format: XXX/GV/NNNN/YYYY or XXX/NNNN/YYYY"
3. Enter admission number (e.g., DRZ/GV/1234/2023)
4. Input automatically converts to uppercase
5. If format is wrong, see error message
6. If format is correct, proceed to login

#### As Admin:
1. Select "Library Staff" role
2. See hint: "Use your employee ID and password"
3. Enter any employee ID format
4. No validation - any format accepted
5. Proceed to login

### Registration Flow:

#### As Student:
1. Open registration page
2. See format examples below admission number field
3. Enter admission number following format
4. Input automatically converts to uppercase
5. If format is wrong, see red error banner
6. If format is correct, proceed with registration

## Visual Feedback

### Format Hints:
- **Login (Student)**: Blue info box with format and example
- **Register**: Small text below input with format and example

### Error Display:
- **Login**: Red banner above form with error message
- **Register**: Red banner at top of form with error message

### Input Styling:
- **Uppercase**: All admission numbers displayed in uppercase
- **Placeholder**: Shows example format
- **Border**: Red border on validation error (optional enhancement)

## Benefits

### For Students:
- ✅ Clear format requirements
- ✅ Immediate validation feedback
- ✅ Examples provided
- ✅ Prevents typos and errors
- ✅ Consistent data format

### For Admins:
- ✅ Flexible employee ID format
- ✅ No unnecessary restrictions
- ✅ Quick login process

### For the System:
- ✅ Standardized student data
- ✅ Easier database queries
- ✅ Better data integrity
- ✅ Reduced login errors
- ✅ Clear role separation
- ✅ **Double validation** (frontend + backend) for security
- ✅ **Prevents invalid data** from reaching the database

## Database Considerations

### Storage:
- Admission numbers stored as entered (uppercase)
- No additional formatting needed
- Consistent format aids searching

### Queries:
```sql
-- Easy to query by year
SELECT * FROM users WHERE admission_no LIKE '%/2023';

-- Easy to query by prefix
SELECT * FROM users WHERE admission_no LIKE 'DRZ/%';

-- Easy to query GV students
SELECT * FROM users WHERE admission_no LIKE '%/GV/%';
```

## Testing

### Test Cases:

#### Valid Student Admission Numbers:
```
✅ DRZ/GV/1234/2023
✅ DRZ/GV/0001/2024
✅ SCH/GV/9999/2022
✅ DRZ/1234/2023
✅ DEPT/5678/2024
✅ ABC123/GV/1000/2023
✅ X/GV/1/2023 (minimal)
✅ VERYLONGPREFIX/GV/999999/2023
```

#### Invalid Student Admission Numbers:
```
❌ DRZ/2023/1234 (wrong order)
❌ DRZ-1234-2023 (wrong separator)
❌ DRZ/1234/23 (year too short)
❌ DRZ/GV/ABC/2023 (non-numeric number)
❌ /GV/1234/2023 (missing prefix)
❌ DRZ/GV//2023 (missing number)
❌ DRZ/GV/1234/ (missing year)
❌ 1234/2023 (missing prefix)
```

#### Valid Admin Employee IDs:
```
✅ LIB-STAFF-001
✅ ADMIN-2023-01
✅ LIBRARIAN-JOHN
✅ EMP123
✅ STAFF_MARY_2023
✅ Any format works!
```

## Future Enhancements

### Potential Additions:
- 📅 Year validation (must be reasonable year)
- 🔢 Number range validation (e.g., 1-9999)
- 🏫 Prefix validation (only allowed prefixes)
- 📝 Auto-formatting as user types
- 💾 Remember last used format
- 🔍 Admission number lookup/verification
- 📊 Format statistics and reporting

## Summary

The system now enforces:
✅ **Standardized admission number formats** for students
✅ **Two accepted formats**: With or without "GV"
✅ **Flexible employee IDs** for library staff
✅ **Real-time validation** with clear error messages
✅ **Format hints and examples** for user guidance
✅ **Uppercase conversion** for consistency
✅ **Role-based validation** (students vs admins)

**Result**: Clean, consistent student data with proper format validation while maintaining flexibility for library staff! 🎓📚
