# Implementation Tasks

## Task 1: Enhance AI Chat to Search Library Database
- **Requirements**: 1, 3
- **File**: `services/geminiService.ts`, `api/index.js`
- [ ] Add book search function that queries the books database
- [ ] Implement multi-field search (title, author, ISBN, category)
- [ ] Integrate search into AI chat flow when book-related queries detected
- [ ] Return book availability and soft copy info in search results

## Task 2: Implement AI Book Summary Generation
- **Requirements**: 1, 5
- **File**: `services/geminiService.ts`, `components/AILibrarian.tsx`
- [ ] Create prompt template for generating book summaries
- [ ] Include book metadata (title, author, category, description) in summary generation
- [ ] Format summaries with markdown (bold titles, bullet points)
- [ ] Handle multiple book matches by listing options with numbers

## Task 3: Add Download Link Support in AI Chat
- **Requirements**: 2, 4, 5
- **File**: `components/AILibrarian.tsx`, `services/geminiService.ts`
- [ ] Detect download requests in user queries
- [ ] Check if book has soft copy available
- [ ] Generate clickable download links in chat responses
- [ ] Format download links as highlighted buttons/links

## Task 4: Implement Global Book Search
- **Requirements**: 6
- **File**: `services/geminiService.ts`, `components/AILibrarian.tsx`
- [ ] When book not found locally, offer global search option
- [ ] Generate comprehensive summary from AI knowledge when user agrees
- [ ] Include key events, themes, and important details in global summaries
- [ ] Clearly indicate when summary is from global search vs local library

## Task 5: Add User Feedback System
- **Requirements**: 7
- **File**: `components/Footer.tsx`, `api/index.js`
- [ ] Create feedback form/modal accessible from footer
- [ ] Collect user name, email, and feedback message
- [ ] Send feedback to developer email (danotyanga@gmail.com)
- [ ] Show confirmation message after successful submission

## Task 6: Add Company Branding to Login Page
- **Requirements**: 8
- **File**: `components/Login.tsx`
- [ ] Add company name "DRIZAIKN" prominently on login page
- [ ] Ensure branding is consistent with footer and navbar
- [ ] Style to match existing theme

## Task 7: Remove Borrow Functionality (COMPLETED)
- **Requirements**: N/A (User request)
- **File**: `components/BookDetailsModal.tsx`, `components/BookList.tsx`
- [x] Remove borrow button from BookDetailsModal
- [x] Remove borrow/waitlist buttons from BookList
- [x] Clean up unused state and imports
