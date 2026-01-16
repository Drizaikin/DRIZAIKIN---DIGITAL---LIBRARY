# Ingestion Filtering Guide

This guide covers the complete ingestion filtering system for the PUEA Digital Library, including configuration, API usage, troubleshooting, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [API Endpoints](#api-endpoints)
4. [Common Filter Configurations](#common-filter-configurations)
5. [Admin UI](#admin-ui)
6. [Bulk Category Update](#bulk-category-update)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Overview

The ingestion filtering system allows administrators to control which books are ingested from Internet Archive based on:

- **Genre filtering**: Only ingest books matching specific genres
- **Author filtering**: Only ingest books by specific authors

### Key Features

- **AI-powered genre classification**: Books are automatically classified using AI before filtering
- **Category sync**: Book categories automatically sync with their primary genre
- **Filter before download**: Filters are applied before PDF download to save bandwidth
- **Non-blocking**: Filter failures never stop the ingestion pipeline
- **Audit logging**: All filter decisions are logged for review

### How It Works

```
1. Fetch book metadata from Internet Archive
2. AI classifies book into 1-3 genres
3. Apply genre filter (if enabled)
4. Apply author filter (if enabled)
5. If book passes all filters → Download PDF and ingest
6. If book fails any filter → Skip and log reason
```

---

## Configuration

### Environment Variables

Configure filtering via environment variables in `.env.local`:

```bash
# Genre Filtering
INGEST_ALLOWED_GENRES=Philosophy,History,Science,Literature
ENABLE_GENRE_FILTER=true

# Author Filtering
INGEST_ALLOWED_AUTHORS=Robin Sharma,Paulo Coelho
ENABLE_AUTHOR_FILTER=false
```

### Valid Genres

The following genres are supported (from the genre taxonomy):

| Category | Genres |
|----------|--------|
| Philosophy & Religion | Philosophy, Religion, Theology, Sacred Texts |
| History & Biography | History, Biography |
| Science & Mathematics | Science, Mathematics, Medicine |
| Social Sciences | Law, Politics, Economics, Anthropology, Sociology, Psychology |
| Literature & Arts | Literature, Poetry, Drama, Mythology, Art & Architecture |
| Other | Military & Strategy, Education, Linguistics, Ethics, Geography, Astronomy, Alchemy & Esoterica |

### Filter Behavior Matrix

| Genre Filter | Author Filter | Allowed Genres | Allowed Authors | Result |
|--------------|---------------|----------------|-----------------|--------|
| Disabled | Disabled | Any | Any | All books ingested |
| Enabled | Disabled | Empty | Any | All books ingested |
| Enabled | Disabled | Set | Any | Only matching genres |
| Disabled | Enabled | Any | Empty | All books ingested |
| Disabled | Enabled | Any | Set | Only matching authors |
| Enabled | Enabled | Set | Set | Must match BOTH |

### Author Matching Rules

- **Case-insensitive**: "sharma" matches "Robin Sharma"
- **Partial matching**: "Sharma" matches "Robin Sharma", "Anita Sharma"
- **Trimmed**: Leading/trailing spaces are ignored

---

## API Endpoints

All admin endpoints require authentication:
```
Authorization: Bearer YOUR_ADMIN_HEALTH_SECRET
```

### GET /api/admin/ingestion/filters

Get current filter configuration.

**Response:**
```json
{
  "config": {
    "allowedGenres": ["Philosophy", "History"],
    "allowedAuthors": ["Robin Sharma"],
    "enableGenreFilter": true,
    "enableAuthorFilter": true
  },
  "source": "environment",
  "timestamp": "2026-01-16T10:00:00.000Z"
}
```

### POST /api/admin/ingestion/filters

Update filter configuration.

**Request:**
```json
{
  "allowedGenres": ["Philosophy", "History", "Science"],
  "allowedAuthors": ["Robin Sharma", "Paulo Coelho"],
  "enableGenreFilter": true,
  "enableAuthorFilter": true
}
```

**Response:**
```json
{
  "success": true,
  "config": { ... },
  "timestamp": "2026-01-16T10:00:00.000Z"
}
```

**Validation Errors:**
```json
{
  "error": "Validation failed",
  "details": {
    "invalidGenres": ["InvalidGenre"],
    "validGenres": ["Philosophy", "History", ...]
  }
}
```

### GET /api/admin/ingestion/filter-stats

Get filter statistics from recent ingestion runs.

**Response:**
```json
{
  "stats": {
    "totalEvaluated": 1000,
    "passed": 450,
    "filteredByGenre": 400,
    "filteredByAuthor": 150,
    "topFilteredGenres": [
      { "genre": "Science", "count": 200 },
      { "genre": "History", "count": 150 }
    ],
    "topFilteredAuthors": [
      { "author": "Unknown", "count": 100 }
    ]
  },
  "period": "last_30_days",
  "timestamp": "2026-01-16T10:00:00.000Z"
}
```

---

## Common Filter Configurations

### 1. Philosophy Library

Only ingest philosophy and ethics books:

```bash
INGEST_ALLOWED_GENRES=Philosophy,Ethics,Religion,Theology
ENABLE_GENRE_FILTER=true
INGEST_ALLOWED_AUTHORS=
ENABLE_AUTHOR_FILTER=false
```

### 2. Literature Collection

Focus on fiction and literary works:

```bash
INGEST_ALLOWED_GENRES=Literature,Poetry,Drama,Mythology
ENABLE_GENRE_FILTER=true
INGEST_ALLOWED_AUTHORS=
ENABLE_AUTHOR_FILTER=false
```

### 3. Self-Help Authors

Only ingest books by specific self-help authors:

```bash
INGEST_ALLOWED_GENRES=
ENABLE_GENRE_FILTER=false
INGEST_ALLOWED_AUTHORS=Robin Sharma,Paulo Coelho,Dale Carnegie,Napoleon Hill
ENABLE_AUTHOR_FILTER=true
```

### 4. Academic Library

Focus on science and education:

```bash
INGEST_ALLOWED_GENRES=Science,Mathematics,Medicine,Education,History
ENABLE_GENRE_FILTER=true
INGEST_ALLOWED_AUTHORS=
ENABLE_AUTHOR_FILTER=false
```

### 5. Combined Filtering

Philosophy books by classical authors:

```bash
INGEST_ALLOWED_GENRES=Philosophy,Ethics
ENABLE_GENRE_FILTER=true
INGEST_ALLOWED_AUTHORS=Plato,Aristotle,Kant,Nietzsche
ENABLE_AUTHOR_FILTER=true
```

### 6. No Filtering (Default)

Ingest all books:

```bash
ENABLE_GENRE_FILTER=false
ENABLE_AUTHOR_FILTER=false
```

---

## Admin UI

### Accessing the Filters Panel

1. Log in as an administrator
2. Navigate to Admin Panel
3. Click on "Ingestion Filters" section

### Using the Filters Panel

**Genre Selection:**
- Use the multi-select dropdown to choose allowed genres
- Genres are populated from the taxonomy
- Select multiple genres by clicking each one

**Author Input:**
- Enter author names separated by commas
- Example: "Robin Sharma, Paulo Coelho, Dale Carnegie"
- Partial names are supported

**Toggles:**
- Enable/disable genre filtering
- Enable/disable author filtering

**Actions:**
- **Save Configuration**: Save current settings
- **Clear All Filters**: Reset to no filtering

**Statistics Display:**
- View filter statistics from recent runs
- See top filtered genres and authors
- Monitor filter effectiveness

---

## Bulk Category Update

The bulk category update syncs all books' categories with their AI-determined genres.

### When to Run

- After initial deployment
- After AI genre classification
- To fix category inconsistencies
- Periodic maintenance

### Method 1: CLI Script

```bash
npm run bulk-update-categories
```

### Method 2: API Endpoint

```bash
curl -X POST https://your-domain.com/api/admin/books/bulk-update-categories \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

### Verification

```sql
-- Check category distribution
SELECT category, COUNT(*) as count
FROM books
GROUP BY category
ORDER BY count DESC;

-- Verify sync
SELECT id, title, category, genres[1] as first_genre
FROM books
WHERE category != genres[1]
  AND genres IS NOT NULL
  AND array_length(genres, 1) > 0;
```

See [BULK_CATEGORY_UPDATE.md](./BULK_CATEGORY_UPDATE.md) for detailed documentation.

---

## Troubleshooting

### Filter Not Working

**Symptom:** Books are being ingested despite filter configuration.

**Possible Causes & Solutions:**

1. **Filter not enabled**
   ```bash
   # Check that filter is enabled
   ENABLE_GENRE_FILTER=true  # Not "TRUE" or "1"
   ```

2. **Empty filter list**
   - Empty `INGEST_ALLOWED_GENRES` with filter enabled = allow all
   - Add at least one genre to the list

3. **Environment variables not loaded**
   - Restart the server after changing `.env.local`
   - Verify variables are set: `echo $ENABLE_GENRE_FILTER`

4. **UI config vs environment**
   - Environment variables take precedence
   - Check both sources

### Books Being Incorrectly Filtered

**Symptom:** Desired books are being filtered out.

**Possible Causes & Solutions:**

1. **Genre mismatch**
   - AI classification may differ from expected
   - Check the book's actual genres in the database
   - Add more genres to the allowed list

2. **Author name mismatch**
   - Check exact author name in Internet Archive
   - Use partial matching: "Sharma" instead of "Robin Sharma"
   - Author names are case-insensitive

3. **Combined filter too restrictive**
   - Book must pass BOTH filters when both enabled
   - Consider disabling one filter

### API Authentication Errors

**Symptom:** "Unauthorized" or "401" errors.

**Solutions:**

1. **Check header format**
   ```bash
   # Correct
   Authorization: Bearer YOUR_SECRET
   
   # Wrong
   Authorization: YOUR_SECRET
   authorization: Bearer YOUR_SECRET
   ```

2. **Verify secret matches**
   - Check `ADMIN_HEALTH_SECRET` in environment
   - No extra spaces or newlines

3. **Secret not set**
   - Ensure `ADMIN_HEALTH_SECRET` is in `.env.local`
   - Restart server after adding

### Invalid Genre Error

**Symptom:** "Invalid genres" error when saving configuration.

**Solution:**
- Use exact genre names from the taxonomy
- Check spelling and capitalization
- Valid genres are listed in the [Valid Genres](#valid-genres) section

### Filter Statistics Not Showing

**Symptom:** Statistics show zeros or are missing.

**Possible Causes & Solutions:**

1. **No ingestion runs yet**
   - Run an ingestion job first
   - Statistics are collected during ingestion

2. **Filter stats table not created**
   - Run `supabase_ingestion_filter_stats.sql` migration
   - Without the table, only basic stats are available

3. **Database connection issues**
   - Check Supabase connection
   - Verify `SUPABASE_URL` and `SUPABASE_KEY`

### Bulk Update Errors

**Symptom:** Bulk update fails or has many errors.

**Solutions:**

1. **Database connection**
   - Verify `SUPABASE_URL` and `SUPABASE_KEY`
   - Check network connectivity

2. **Permission issues**
   - Ensure service role key has write access
   - Check RLS policies

3. **Invalid data**
   - Some books may have corrupted genres
   - Check error details for specific book IDs
   - Fix data manually if needed

### Performance Issues

**Symptom:** Ingestion is slow with filters enabled.

**Solutions:**

1. **Filter overhead is minimal**
   - Filters add <100ms per book
   - If slow, check AI classification (15s timeout)

2. **Large filter lists**
   - Very large genre/author lists may slow matching
   - Keep lists reasonable (<50 items)

3. **Database queries**
   - Ensure indexes exist on `genres` and `author` columns
   - Check database performance

---

## FAQ

### Q: Can I use wildcards in author names?

**A:** No, but partial matching is supported. "Sharma" will match any author containing "Sharma".

### Q: Are filters case-sensitive?

**A:** No, both genre and author matching are case-insensitive.

### Q: What happens if AI classification fails?

**A:** The book is ingested without genres. Genre filter won't apply (treated as no genres). Category is set to "Uncategorized".

### Q: Can I filter by publication year?

**A:** Not currently. This is planned for a future enhancement.

### Q: How do I see which books were filtered?

**A:** Check the ingestion logs or filter statistics. Filtered books are logged with reasons.

### Q: Can I change filters during an ingestion run?

**A:** No, filters are loaded at job start. Changes apply to the next run.

### Q: What's the difference between category and genre?

**A:** They're unified. Category = first genre. The category field exists for backward compatibility.

### Q: How do I disable all filtering?

**A:** Set both `ENABLE_GENRE_FILTER=false` and `ENABLE_AUTHOR_FILTER=false`.

### Q: Can I filter by language?

**A:** Not currently. This is planned for a future enhancement.

### Q: How often should I run bulk category update?

**A:** Once after initial setup, then only if you notice category inconsistencies.

---

## See Also

- [Requirements Document](../.kiro/specs/ingestion-filtering/requirements.md)
- [Design Document](../.kiro/specs/ingestion-filtering/design.md)
- [Bulk Category Update Guide](./BULK_CATEGORY_UPDATE.md)
- [Environment Example](../.env.example)
