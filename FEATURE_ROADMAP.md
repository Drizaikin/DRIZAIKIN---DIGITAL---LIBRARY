# Feature Roadmap - Digital Library Enhancements

## Overview
This document outlines major feature requests for the digital library system. Each feature requires proper specification, design, and implementation.

---

## 1. AI Cover Image Generation & Validation

### Description
Automatically generate cover images for books that don't have one, using AI. Validate that cover details match book metadata.

### Requirements
- Detect books with missing/placeholder cover images
- Generate professional book covers using AI (OpenRouter/DALL-E)
- Validate cover text matches title and author
- Apply to both manual uploads and ingested books
- Batch processing for existing books

### Technical Considerations
- AI image generation API (DALL-E, Midjourney, or Stable Diffusion)
- Image validation using OCR or vision models
- Storage for generated covers
- Cost management (image generation is expensive)

### Estimated Complexity
**HIGH** - Requires AI image generation, validation, and storage integration

### Status
📋 **NEEDS SPECIFICATION**

---

## 2. Genre-Based Ingestion Filtering

### Description
Filter ingestion to only include books from specific genres (e.g., only fiction novels).

### Requirements
- Configure genre filters for ingestion
- Support multiple genre selection
- Filter at API query level (before download)
- Admin UI to configure genre filters
- Save filter preferences

### Technical Considerations
- Internet Archive API supports genre filtering
- Need to map our genre taxonomy to source genres
- Update `internetArchiveFetcher.js` to accept genre filters
- Add configuration storage (database or env vars)

### Estimated Complexity
**MEDIUM** - Requires API query modification and configuration UI

### Status
📋 **NEEDS SPECIFICATION**

---

## 3. Author-Based Ingestion Filtering

### Description
Filter ingestion to only include books by specific authors (e.g., only Robin Sharma).

### Requirements
- Configure author filters for ingestion
- Support multiple author selection
- Filter at API query level (before download)
- Admin UI to configure author filters
- Fuzzy matching for author names

### Technical Considerations
- Internet Archive API supports author filtering
- Need author name normalization (handle variations)
- Update `internetArchiveFetcher.js` to accept author filters
- Add configuration storage

### Estimated Complexity
**MEDIUM** - Similar to genre filtering

### Status
📋 **NEEDS SPECIFICATION**

---

## 4. Remove Loan/Borrow Functionality

### Description
Remove all loan-related features from the UI since the library doesn't offer loaning services.

### Requirements
- Remove "Loans" from navigation bar
- Remove loan status from book details
- Remove borrow request functionality
- Hide loan-related UI components
- Keep database schema (for future use)

### Technical Considerations
- Update `Navbar.tsx` to remove loans tab
- Update `BookDetailsModal.tsx` to hide loan status
- Update `App.tsx` to remove loans view
- Comment out loan-related code (don't delete)

### Estimated Complexity
**LOW** - Simple UI changes

### Status
✅ **CAN IMPLEMENT IMMEDIATELY**

---

## 5. Multi-Source Ingestion System

### Description
Support ingestion from multiple sources beyond Internet Archive (e.g., Project Gutenberg, Google Books, OpenLibrary).

### Requirements
- Abstract ingestion architecture for multiple sources
- Source selection in admin UI
- Source-specific adapters/fetchers
- Unified book metadata format
- Source priority/fallback system

### Technical Considerations
- Create source adapter interface
- Implement adapters for each source:
  - Internet Archive (existing)
  - Project Gutenberg
  - OpenLibrary
  - Google Books API
  - LibGen (if legal)
- Source configuration and credentials
- Rate limiting per source

### Estimated Complexity
**VERY HIGH** - Major architectural change

### Status
📋 **NEEDS SPECIFICATION**

---

## 6. Modern Books Ingestion (Not Just Ancient)

### Description
Expand ingestion beyond public domain books to include modern books (with proper licensing).

### Requirements
- Remove date restriction (currently pre-1927)
- Add copyright/licensing checks
- Support for licensed content
- Publisher partnerships (if applicable)
- Legal compliance verification

### Technical Considerations
- Copyright law compliance (varies by country)
- Licensing agreements needed
- DRM considerations
- Payment/subscription integration (if needed)
- Legal review required

### Estimated Complexity
**VERY HIGH** - Legal and business considerations

### Status
⚠️ **REQUIRES LEGAL REVIEW**

---

## 7. All Genres Support

### Description
Ensure ingestion supports all book genres, not just specific categories.

### Requirements
- Expand genre taxonomy to cover all genres
- Update AI classification to handle all genres
- Remove any genre restrictions
- Support genre combinations

### Technical Considerations
- Update `genreTaxonomy.js` with comprehensive list
- Update AI classification prompts
- Test with diverse book samples

### Estimated Complexity
**LOW** - Taxonomy expansion

### Status
✅ **CAN IMPLEMENT IMMEDIATELY**

---

## Implementation Priority

### Phase 1: Quick Wins (1-2 weeks)
1. ✅ **Remove Loan Functionality** - Simple UI changes
2. ✅ **Expand Genre Support** - Taxonomy update

### Phase 2: Medium Complexity (2-4 weeks)
3. 📋 **Genre-Based Filtering** - Requires spec and implementation
4. 📋 **Author-Based Filtering** - Requires spec and implementation

### Phase 3: High Complexity (1-2 months)
5. 📋 **AI Cover Generation** - Requires spec, API integration, validation
6. 📋 **Multi-Source Ingestion** - Major architectural change

### Phase 4: Strategic (Requires Business Decision)
7. ⚠️ **Modern Books Ingestion** - Legal review and licensing

---

## Next Steps

### Immediate Actions
1. **Remove Loan Functionality** - I can implement this now
2. **Expand Genre Taxonomy** - I can implement this now

### Requires Specification
For features 2-6, we need to create proper specification documents:
- Requirements gathering
- Design documentation
- Implementation tasks
- Testing strategy

### Requires Decision
- **Modern Books**: Legal review and business model decision
- **Multi-Source**: Which sources to prioritize?
- **AI Covers**: Budget for image generation API costs?

---

## Questions for You

1. **Priority**: Which features are most important to you?
2. **Timeline**: What's your target timeline for each feature?
3. **Budget**: Are you comfortable with AI image generation costs (~$0.02-0.10 per image)?
4. **Legal**: Do you have legal counsel for modern book licensing?
5. **Sources**: Which book sources would you like to support first?

---

## Recommendations

### Start With:
1. ✅ Remove loan functionality (quick win)
2. ✅ Expand genre support (quick win)
3. 📋 Create specs for genre/author filtering (medium effort, high value)

### Plan For:
4. 📋 AI cover generation (high value, but expensive)
5. 📋 Multi-source ingestion (strategic, long-term)

### Defer:
6. ⚠️ Modern books (requires legal review and business model)

---

Would you like me to:
1. **Implement the quick wins now** (remove loans, expand genres)?
2. **Create detailed specs** for specific features?
3. **Start with a specific feature** from the list?
