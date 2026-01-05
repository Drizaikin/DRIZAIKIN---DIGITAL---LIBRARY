# Implementation Plan

- [x] 1. Set up preferences infrastructure






  - [x] 1.1 Create preferences service with local storage persistence

    - Create `services/preferencesService.ts` with types for IconSize, ViewLayout, ThemeMode, ThemeColor
    - Implement get/set methods for each preference type
    - Implement local storage read/write with error handling
    - Add default values (md, grid, light, classic)
    - _Requirements: 2.3, 2.4, 2.5, 3.6, 3.7, 3.8, 6.4, 6.5, 6.6, 7.6, 7.7, 7.8_

  - [ ]* 1.2 Write property test for preferences round-trip
    - **Property 1: Preferences Round-Trip Persistence**
    - **Validates: Requirements 2.3, 2.4, 3.6, 3.7, 6.4, 6.5, 7.6, 7.7**


  - [x] 1.3 Create theme constants and color configurations

    - Create `constants/themes.ts` with THEME_COLORS and ICON_SIZES
    - Define light/dark variants for all 3 theme colors
    - Define CSS class mappings for icon sizes
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 2. Implement theme system





  - [x] 2.1 Create ThemeContext for React


    - Create `contexts/ThemeContext.tsx` with theme state management
    - Implement CSS custom property updates on theme change
    - Add dark mode class toggle on document root
    - _Requirements: 6.2, 6.3, 6.7, 7.5_

  - [x] 2.2 Write property test for theme mode application






    - **Property 9: Theme Mode Application**
    - **Validates: Requirements 6.2, 6.3, 6.7**

  - [x] 2.3 Write property test for theme color application









    - **Property 10: Theme Color Application**
    - **Validates: Requirements 7.5**

  - [x] 2.4 Update index.css with CSS custom properties and dark mode styles


    - Add CSS custom properties for theme colors
    - Add dark mode variant styles
    - Update existing components to use CSS variables
    - _Requirements: 6.2, 6.3, 7.2, 7.3, 7.4_

- [x] 3. Implement view layout components





  - [x] 3.1 Create BookList component for list view


    - Horizontal layout with book details
    - Responsive design for mobile/tablet/desktop
    - _Requirements: 3.3, 8.1, 8.2, 8.3_

  - [x] 3.2 Create BookCompact component for compact view


    - Dense grid with minimal information
    - Smaller cards with essential info only
    - _Requirements: 3.4, 8.1, 8.2, 8.3_

  - [x] 3.3 Create BookTable component for table view


    - Tabular format with sortable columns
    - Responsive table for different screen sizes
    - _Requirements: 3.5, 8.1, 8.2, 8.3_

  - [x] 3.4 Update BookCard to support dynamic icon sizes


    - Accept iconSize prop
    - Apply size classes from ICON_SIZES constant
    - _Requirements: 2.2_

  - [x] 3.5 Write property test for icon size application






    - **Property 11: Icon Size Application**
    - **Validates: Requirements 2.2**

- [x] 4. Create preferences toolbar UI






  - [x] 4.1 Create PreferencesToolbar component

    - Icon size selector (5 options: XS, SM, MD, LG, XL)
    - View layout selector (4 options: Grid, List, Compact, Table)
    - Theme mode toggle (Light/Dark)
    - Theme color selector (3 options)
    - Responsive design for mobile/tablet/desktop
    - _Requirements: 2.1, 3.1, 4.1, 4.2, 4.4, 6.1, 7.1_


  - [x] 4.2 Integrate PreferencesToolbar into App.tsx

    - Add toolbar near filter controls
    - Connect to preferences service
    - Apply preferences to book display
    - _Requirements: 4.1, 4.2_

- [x] 5. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement search history backend





  - [x] 6.1 Create search_history table in Supabase


    - Create SQL migration file `supabase_search_history.sql`
    - Add indexes for user_id and created_at
    - _Requirements: 5.1, 5.5_

  - [x] 6.2 Add search history API endpoints


    - POST /api/search-history - Record search/view
    - GET /api/search-history/:userId - Get recent history
    - DELETE /api/search-history/:userId - Clear history
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 6.3 Write property test for search history recording







    - **Property 5: Search History Recording**
    - **Validates: Requirements 1.6, 5.1**



  - [x] 6.4 Write property test for book view recording




    - **Property 6: Book View Recording**
    - **Validates: Requirements 5.2**

  - [x] 6.5 Write property test for search history clear






    - **Property 8: Search History Clear**
    - **Validates: Requirements 5.4**

- [x] 7. Enhance recommendation engine






  - [x] 7.1 Update recommendation API to include search history

    - Modify `/api/books/recommendations/:userId` endpoint
    - Query search history for recent searches
    - Combine with course-based recommendations
    - Limit to 50 most recent history entries
    - _Requirements: 1.1, 1.2, 1.3, 5.3_

  - [x] 7.2 Write property test for recommendation with search history






    - **Property 2: Recommendation Generation Includes Search History**
    - **Validates: Requirements 1.1, 1.3**


  - [x] 7.3 Write property test for recommendation with course









    - **Property 3: Recommendation Generation Includes Course**
    - **Validates: Requirements 1.2, 1.3**

  - [x] 7.4 Write property test for recommendation count limit






    - **Property 4: Recommendation Count Limit**
    - **Validates: Requirements 1.5**

  - [x] 7.5 Write property test for search history limit






    - **Property 7: Search History Limit**
    - **Validates: Requirements 5.3**

- [x] 8. Integrate search history tracking in frontend






  - [x] 8.1 Record searches when user performs search

    - Call search history API on search submit
    - Include search query and timestamp
    - _Requirements: 1.6, 5.1_


  - [x] 8.2 Record book views when user opens book details

    - Call search history API when BookDetailsModal opens
    - Include book ID and timestamp
    - _Requirements: 5.2_


  - [x] 8.3 Add clear search history option in user profile

    - Add button in UserProfile component
    - Call delete API endpoint
    - _Requirements: 5.4_

- [x] 9. Update login page badge size






  - [x] 9.1 Increase badge size on Login component

    - Set minimum width 120px on mobile
    - Set minimum width 160px on desktop
    - Ensure clear readability
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 10. Final Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
