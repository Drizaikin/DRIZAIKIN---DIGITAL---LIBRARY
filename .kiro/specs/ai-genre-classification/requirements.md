# Requirements Document

## Introduction

This feature extends the automated public-domain book ingestion system by adding AI-powered genre classification. For every book imported from Internet Archive, the system will automatically determine and store genre metadata using an external AI API (OpenRouter). The classification uses semantic understanding to assign 1-3 genres and optionally 1 sub-genre from a strict controlled taxonomy.

## Glossary

- **Genre_Classifier**: The service responsible for calling the AI API and parsing genre classification responses
- **AI_API**: The OpenRouter API used for AI-powered genre classification
- **Genre_Taxonomy**: The strict controlled list of allowed genres and sub-genres
- **Classification_Result**: The structured JSON output containing genres and optional sub-genre
- **Source_Identifier**: The unique Internet Archive identifier used for caching classification results

## Requirements

### Requirement 1: AI Genre Classification Service

**User Story:** As a library administrator, I want each ingested book to be automatically classified by genre, so that users can browse and filter books by category.

#### Acceptance Criteria

1. WHEN a book is being ingested, THE Genre_Classifier SHALL send title, author, year, and description to the AI_API
2. THE Genre_Classifier SHALL NOT send the full PDF content to the AI_API
3. WHEN the AI_API returns a response, THE Genre_Classifier SHALL parse and validate the JSON output
4. THE Genre_Classifier SHALL assign between 1 and 3 genres from the allowed taxonomy
5. THE Genre_Classifier SHALL optionally assign 1 sub-genre from the allowed taxonomy
6. IF the AI_API returns genres outside the allowed taxonomy, THEN THE Genre_Classifier SHALL reject those genres and use only valid ones

### Requirement 2: Strict Genre Taxonomy Enforcement

**User Story:** As a library administrator, I want genres to come from a controlled vocabulary, so that the catalog remains consistent and searchable.

#### Acceptance Criteria

1. THE Genre_Classifier SHALL only accept genres from the defined Primary Genres list
2. THE Genre_Classifier SHALL only accept sub-genres from the defined Sub-Genres list
3. IF the AI returns an invalid genre, THEN THE Genre_Classifier SHALL filter it out
4. IF all returned genres are invalid, THEN THE Genre_Classifier SHALL set genres to NULL
5. THE Genre_Classifier SHALL be case-insensitive when validating genres

### Requirement 3: Database Schema for Genres

**User Story:** As a developer, I want genre data stored in the database, so that it can be queried and displayed in the UI.

#### Acceptance Criteria

1. THE books table SHALL have a genres column of type text[] (array)
2. THE books table SHALL have a subgenre column of type text (nullable)
3. WHEN a book is inserted with genres, THE Database_Writer SHALL store the genres array
4. WHEN a book is inserted without classification, THE Database_Writer SHALL allow NULL for genres and subgenre

### Requirement 4: Resilient Ingestion Pipeline

**User Story:** As a library administrator, I want book ingestion to continue even if AI classification fails, so that the library catalog keeps growing.

#### Acceptance Criteria

1. IF the AI_API call fails, THEN THE Ingestion_Service SHALL log the error and continue
2. IF the AI_API call fails, THEN THE Ingestion_Service SHALL insert the book with genres = NULL
3. THE Ingestion_Service SHALL NOT block or abort ingestion due to classification failures
4. WHEN classification fails, THE Ingestion_Service SHALL log sufficient detail for debugging

### Requirement 5: Cost and Performance Optimization

**User Story:** As a library administrator, I want AI classification to be cost-effective, so that the system remains affordable to operate.

#### Acceptance Criteria

1. THE Genre_Classifier SHALL use a lightweight, low-cost AI model
2. THE Genre_Classifier SHALL NOT re-classify books that already have genres stored
3. THE Genre_Classifier SHALL cache results using source_identifier to avoid duplicate API calls
4. THE Genre_Classifier SHALL use environment variables for API keys

### Requirement 6: AI Prompt and Response Format

**User Story:** As a developer, I want a well-defined AI prompt and response format, so that classification is consistent and predictable.

#### Acceptance Criteria

1. THE Genre_Classifier SHALL send a structured prompt with the allowed taxonomy
2. THE AI_API response SHALL be valid JSON in the format: {"genres": [...], "subgenre": "..."}
3. THE genres field SHALL be required and contain 1-3 values
4. THE subgenre field SHALL be optional
5. THE Genre_Classifier SHALL reject responses with extra text or explanations

### Requirement 7: Testing and Debugging Support

**User Story:** As a developer, I want testing utilities for AI classification, so that I can develop and debug without incurring API costs.

#### Acceptance Criteria

1. THE Genre_Classifier SHALL support mock AI responses for local testing
2. THE Genre_Classifier SHALL provide a toggle to disable AI classification
3. THE Ingestion_Service SHALL clearly distinguish AI failures from ingestion failures in logs
4. WHEN AI classification is disabled, THE Ingestion_Service SHALL insert books with genres = NULL

### Requirement 8: Taxonomy Extensibility

**User Story:** As a library administrator, I want to be able to modify the genre taxonomy, so that I can adapt to changing needs.

#### Acceptance Criteria

1. THE Genre_Taxonomy SHALL be defined in a single, easily modifiable location
2. THE Genre_Classifier SHALL validate against the current taxonomy at runtime
3. WHEN the taxonomy is updated, THE Genre_Classifier SHALL use the new values without code changes
4. THE system SHALL provide documentation on how to extend the taxonomy

</content>
