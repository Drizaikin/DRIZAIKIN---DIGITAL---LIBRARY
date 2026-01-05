# Requirements Document

## Introduction

This document specifies the requirements for enhanced book recommendations and user display preferences in the PUEA Digital Library system. The feature allows users to receive personalized book recommendations based on their search history and course/major, customize the display size of book icons, choose between different view layouts for browsing books, toggle dark/light mode, and select from predefined professional theme color combinations. All features must work seamlessly across mobile phones, tablets/iPads, and desktop/laptop computers.

## Glossary

- **Library_System**: The PUEA Digital Library web application
- **User**: An authenticated library patron (Student, Lecturer, Faculty, or Admin)
- **Recommendation_Engine**: The component that generates personalized book suggestions
- **Search_History**: A record of books and search terms a user has previously searched for or viewed
- **Display_Preferences**: User-configurable settings for visual presentation of content
- **View_Layout**: The arrangement pattern for displaying book collections (grid, list, etc.)
- **Icon_Size**: The dimensional scale of book cover images and cards
- **Theme_Mode**: Light or dark color scheme for the application interface
- **Theme_Color**: A predefined professional color combination using red, blue, and white as primary colors
- **Responsive_Design**: Interface that adapts to different screen sizes (mobile, tablet, desktop)

## Requirements

### Requirement 1: Enhanced Book Recommendations

**User Story:** As a user, I want to receive personalized book recommendations based on my search history and course/major, so that I can discover relevant books more easily.

#### Acceptance Criteria

1. WHEN a user has search history THEN the Library_System SHALL include books related to previous searches in the recommendations
2. WHEN a user has a course/major set in their profile THEN the Library_System SHALL prioritize books relevant to that course in recommendations
3. WHEN a user has both search history and a course/major THEN the Library_System SHALL combine both factors to generate recommendations
4. WHEN a user has no search history and no course/major THEN the Library_System SHALL display popular books as default recommendations
5. WHEN displaying recommendations THEN the Library_System SHALL show a maximum of 10 recommended books
6. WHEN a user searches for a book THEN the Library_System SHALL record the search term in the user's search history

### Requirement 2: Icon Size Preferences

**User Story:** As a user, I want to change the size of book icons/cards, so that I can customize the display to my visual preferences.

#### Acceptance Criteria

1. WHEN a user accesses display settings THEN the Library_System SHALL provide five icon size options: Extra Small, Small, Medium, Large, and Extra Large
2. WHEN a user selects an icon size THEN the Library_System SHALL immediately apply the size change to all book displays
3. WHEN a user changes icon size THEN the Library_System SHALL persist the preference in local storage
4. WHEN a user returns to the application THEN the Library_System SHALL restore their previously selected icon size
5. WHEN no icon size preference exists THEN the Library_System SHALL default to Medium size

### Requirement 3: View Layout Options

**User Story:** As a user, I want to choose how books are displayed (grid, list, compact, etc.), so that I can browse books in my preferred format.

#### Acceptance Criteria

1. WHEN a user accesses display settings THEN the Library_System SHALL provide at least four view layout options
2. WHEN a user selects Grid view THEN the Library_System SHALL display books in a responsive grid with cover images prominently shown
3. WHEN a user selects List view THEN the Library_System SHALL display books in a vertical list with horizontal book details
4. WHEN a user selects Compact view THEN the Library_System SHALL display books in a dense grid with minimal information
5. WHEN a user selects Table view THEN the Library_System SHALL display books in a tabular format with sortable columns
6. WHEN a user changes view layout THEN the Library_System SHALL persist the preference in local storage
7. WHEN a user returns to the application THEN the Library_System SHALL restore their previously selected view layout
8. WHEN no view layout preference exists THEN the Library_System SHALL default to Grid view

### Requirement 4: Display Preferences UI

**User Story:** As a user, I want easy access to display preference controls, so that I can quickly adjust my viewing experience.

#### Acceptance Criteria

1. WHEN viewing the book browse page THEN the Library_System SHALL display a preferences toolbar near the filter controls
2. WHEN the preferences toolbar is displayed THEN the Library_System SHALL show icon size selector and view layout selector
3. WHEN a user interacts with preference controls THEN the Library_System SHALL provide immediate visual feedback
4. WHEN on mobile devices THEN the Library_System SHALL adapt the preferences toolbar to fit smaller screens

### Requirement 5: Search History Tracking

**User Story:** As a user, I want the system to remember my search history, so that recommendations can be personalized to my interests.

#### Acceptance Criteria

1. WHEN a user performs a search THEN the Library_System SHALL store the search query with a timestamp
2. WHEN a user views a book's details THEN the Library_System SHALL record the book view in search history
3. WHEN generating recommendations THEN the Library_System SHALL consider the most recent 50 search history entries
4. WHEN a user requests to clear search history THEN the Library_System SHALL remove all stored search history for that user
5. WHEN storing search history THEN the Library_System SHALL associate it with the authenticated user's account

### Requirement 6: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light mode, so that I can use the application comfortably in different lighting conditions.

#### Acceptance Criteria

1. WHEN a user accesses display settings THEN the Library_System SHALL provide a toggle for dark/light mode
2. WHEN a user enables dark mode THEN the Library_System SHALL apply dark color scheme to all interface elements
3. WHEN a user enables light mode THEN the Library_System SHALL apply light color scheme to all interface elements
4. WHEN a user changes theme mode THEN the Library_System SHALL persist the preference in local storage
5. WHEN a user returns to the application THEN the Library_System SHALL restore their previously selected theme mode
6. WHEN no theme mode preference exists THEN the Library_System SHALL default to light mode
7. WHEN theme mode changes THEN the Library_System SHALL apply the change immediately without page reload

### Requirement 7: Professional Theme Color Combinations

**User Story:** As a user, I want to choose from predefined professional theme colors, so that I can personalize the application's appearance to my preference.

#### Acceptance Criteria

1. WHEN a user accesses display settings THEN the Library_System SHALL provide three professional theme color options
2. WHEN Theme 1 (Classic PUEA) is selected THEN the Library_System SHALL use navy blue (#1A365D) as primary, red (#DC2626) as accent, and white (#FFFFFF) as background
3. WHEN Theme 2 (Modern Blue) is selected THEN the Library_System SHALL use royal blue (#2563EB) as primary, crimson red (#B91C1C) as accent, and off-white (#F8FAFC) as background
4. WHEN Theme 3 (Elegant Navy) is selected THEN the Library_System SHALL use deep navy (#0F172A) as primary, coral red (#EF4444) as accent, and warm white (#FFFBEB) as background
5. WHEN a user selects a theme color THEN the Library_System SHALL apply the color scheme to all interface elements
6. WHEN a user changes theme color THEN the Library_System SHALL persist the preference in local storage
7. WHEN a user returns to the application THEN the Library_System SHALL restore their previously selected theme color
8. WHEN no theme color preference exists THEN the Library_System SHALL default to Theme 1 (Classic PUEA)

### Requirement 8: Responsive Design Across Devices

**User Story:** As a user, I want all display preferences to work seamlessly on my phone, tablet, and computer, so that I have a consistent experience across devices.

#### Acceptance Criteria

1. WHEN viewing on mobile phone THEN the Library_System SHALL adapt all preference controls to fit smaller screens
2. WHEN viewing on tablet/iPad THEN the Library_System SHALL optimize layout for medium-sized screens
3. WHEN viewing on desktop/laptop THEN the Library_System SHALL utilize full screen width for optimal display
4. WHEN icon size is changed on any device THEN the Library_System SHALL scale appropriately for that device's screen
5. WHEN view layout is changed THEN the Library_System SHALL maintain readability and usability on all device sizes

### Requirement 9: Login Page Badge Size

**User Story:** As a user, I want the login page badge to be clearly visible, so that I can easily identify the application.

#### Acceptance Criteria

1. WHEN the login page is displayed THEN the Library_System SHALL show the badge at a size that is clearly readable
2. WHEN on mobile devices THEN the Library_System SHALL display the badge at minimum 120px width
3. WHEN on desktop devices THEN the Library_System SHALL display the badge at minimum 160px width
