# Requirements Document

## Introduction

This feature migrates the library system from an institution-based model (university library with Student/Lecturer/Faculty roles and admission numbers) to a global platform model with generic user roles (Reader/Premium/Admin) and usernames. This transformation makes the system suitable for any library or book lending platform, not just educational institutions.

## Glossary

- **User**: A registered individual who can browse, borrow, and interact with the library system
- **Reader**: Basic user role with standard borrowing privileges (formerly "Student")
- **Premium**: Enhanced user role with extended borrowing privileges (formerly "Lecturer/Faculty")
- **Admin**: Administrative user with full system management capabilities
- **Username**: Unique identifier chosen by the user for login (replaces "admission_no")
- **Auth_Service**: The authentication service handling login, registration, and session management
- **Database**: The Supabase PostgreSQL database storing user and library data

## Requirements

### Requirement 1: Username-Based Authentication

**User Story:** As a user, I want to register and login using a username of my choice, so that I can access the library system without needing an institution-specific identifier.

#### Acceptance Criteria

1. WHEN a user registers, THE Auth_Service SHALL accept a username field instead of admission_no
2. WHEN a user logs in, THE Auth_Service SHALL authenticate using username and password
3. THE Database SHALL store user identifiers in a column named "username" instead of "admission_no"
4. WHEN displaying user information, THE System SHALL show the username field in profile views
5. THE System SHALL enforce username uniqueness across all users

### Requirement 2: Global Role System

**User Story:** As a platform operator, I want generic user roles that aren't tied to educational institutions, so that the system can be used by any type of library.

#### Acceptance Criteria

1. THE System SHALL support three user roles: Reader, Premium, and Admin
2. WHEN a new user registers, THE System SHALL assign the Reader role by default
3. WHEN migrating existing data, THE Database SHALL convert Student role to Reader
4. WHEN migrating existing data, THE Database SHALL convert Lecturer and Faculty roles to Premium
5. WHEN displaying role information, THE UI SHALL show Reader, Premium, or Admin labels
6. THE Admin_Panel SHALL display and manage users using the new role terminology

### Requirement 3: Database Schema Migration

**User Story:** As a system administrator, I want to migrate the existing database schema to support the new global platform model, so that existing data is preserved while adopting the new structure.

#### Acceptance Criteria

1. THE Migration_Script SHALL rename the admission_no column to username in the users table
2. THE Migration_Script SHALL update all role values from institution-based to global terminology
3. THE Migration_Script SHALL update database views that reference the old column names
4. THE Migration_Script SHALL create appropriate indexes on the username column
5. IF the migration encounters an already-migrated database, THEN THE Migration_Script SHALL handle it gracefully without errors

### Requirement 4: UI Component Updates

**User Story:** As a user, I want the interface to reflect the new global platform terminology, so that the experience is consistent and not confusing.

#### Acceptance Criteria

1. THE Login_Component SHALL display "Username" label instead of "Admission Number"
2. THE Register_Component SHALL collect username instead of admission_no
3. THE User_Profile_Component SHALL display username and hide institution-specific fields like course
4. THE Admin_Panel SHALL display username column in user management tables
5. THE Role_Selector SHALL offer Reader, Premium, and Admin options during login (for testing/demo purposes)

### Requirement 5: API Endpoint Updates

**User Story:** As a developer, I want the API to use consistent field names matching the new schema, so that frontend and backend remain synchronized.

#### Acceptance Criteria

1. WHEN processing login requests, THE API SHALL accept username field in the request body
2. WHEN processing registration requests, THE API SHALL accept username field in the request body
3. WHEN returning user data, THE API SHALL include username field in the response
4. THE API SHALL validate role values against Reader, Premium, and Admin
5. IF an invalid role is provided, THEN THE API SHALL return an appropriate error message

### Requirement 6: Backward Compatibility

**User Story:** As an existing user, I want my account to continue working after the migration, so that I don't lose access to my account.

#### Acceptance Criteria

1. WHEN a user with old role values logs in after migration, THE System SHALL recognize their converted role
2. WHEN session storage contains old format data, THE Auth_Service SHALL handle the transition gracefully
