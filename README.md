<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# PUEA Digital Library

A digital library system with AI-powered book ingestion from Internet Archive, featuring genre classification, filtering, and comprehensive book management.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Configure environment variables in [.env.local](.env.local) (see Configuration section below)
3. Run the app:
   `npm run dev`

## Configuration

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Your Supabase service role key |
| `VITE_SUPABASE_URL` | Supabase URL for frontend (same as SUPABASE_URL) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key for frontend |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI features |
| `ADMIN_HEALTH_SECRET` | Secret key for admin API authentication |

### Ingestion Filter Configuration

The book ingestion pipeline supports configurable filtering by genre and author. Configure these environment variables to control which books are ingested:

#### Genre Filtering

| Variable | Description | Example |
|----------|-------------|---------|
| `INGEST_ALLOWED_GENRES` | Comma-separated list of allowed genres | `Philosophy,History,Science` |
| `ENABLE_GENRE_FILTER` | Enable/disable genre filtering (`true`/`false`) | `true` |

**Valid Genres:** Philosophy, Religion, Theology, Sacred Texts, History, Biography, Science, Mathematics, Medicine, Law, Politics, Economics, Literature, Poetry, Drama, Mythology, Military & Strategy, Education, Linguistics, Ethics, Anthropology, Sociology, Psychology, Geography, Astronomy, Alchemy & Esoterica, Art & Architecture

#### Author Filtering

| Variable | Description | Example |
|----------|-------------|---------|
| `INGEST_ALLOWED_AUTHORS` | Comma-separated list of allowed authors | `Robin Sharma,Paulo Coelho` |
| `ENABLE_AUTHOR_FILTER` | Enable/disable author filtering (`true`/`false`) | `true` |

**Author Matching:**
- Case-insensitive matching (e.g., "sharma" matches "Robin Sharma")
- Partial name matching supported (e.g., "Sharma" matches "Robin Sharma")

#### Filter Behavior

- **Empty filter list + filter enabled:** Allows all books (no filtering)
- **Filter disabled:** Allows all books regardless of filter list
- **Both filters enabled:** Book must pass BOTH genre AND author filters
- **Filters applied before PDF download:** Saves bandwidth by filtering early

### Example .env.local Configuration

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# AI Configuration
OPENROUTER_API_KEY=your-openrouter-api-key

# Admin Configuration
ADMIN_HEALTH_SECRET=your-admin-secret-key

# Ingestion Filter Configuration
# Genre filtering - only ingest books matching these genres
INGEST_ALLOWED_GENRES=Philosophy,History,Science,Literature
ENABLE_GENRE_FILTER=true

# Author filtering - only ingest books by these authors
INGEST_ALLOWED_AUTHORS=
ENABLE_AUTHOR_FILTER=false

# Server Configuration
PORT=5000
VITE_API_URL=http://localhost:5000/api
```

### Filter Configuration via Admin UI

Filters can also be configured through the Admin Panel:
1. Navigate to Admin Panel
2. Click on "Ingestion Filters" section
3. Select allowed genres from the dropdown
4. Enter allowed authors (comma-separated)
5. Toggle filters on/off
6. Click "Save Configuration"

**Note:** Environment variables take precedence over UI configuration. For production deployments, configure filters via environment variables.

For comprehensive documentation including troubleshooting, see [docs/INGESTION_FILTERING.md](docs/INGESTION_FILTERING.md).

## Features

- **AI-Powered Book Ingestion:** Automatically fetches and classifies public domain books from Internet Archive
- **Genre Classification:** AI determines book genres from metadata
- **Configurable Filtering:** Filter ingested books by genre and author
- **Category Sync:** Automatically syncs book category with primary genre
- **Admin Dashboard:** Monitor system health and manage ingestion
- **User Preferences:** Personalized recommendations based on reading history

## API Endpoints

### Ingestion Filter APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/ingestion/filters` | GET | Get current filter configuration |
| `/api/admin/ingestion/filters` | POST | Update filter configuration |
| `/api/admin/ingestion/filter-stats` | GET | Get filter statistics |
| `/api/admin/books/bulk-update-categories` | POST | Trigger bulk category update |

All admin endpoints require `Authorization: Bearer <ADMIN_HEALTH_SECRET>` header.

For detailed API documentation and examples, see [docs/INGESTION_FILTERING.md](docs/INGESTION_FILTERING.md).

## Testing

Run tests:
```bash
npm test
```

Run specific test file:
```bash
npm test -- tests/ingestion/envVariableLoading.unit.test.ts
```

## Database Setup

### Filter Statistics Table (Optional)

For detailed filter statistics including top filtered genres and authors, run the `supabase_ingestion_filter_stats.sql` migration in your Supabase SQL Editor:

```sql
-- Creates the ingestion_filter_stats table with:
-- - Filter decision tracking (passed, filtered_genre, filtered_author)
-- - Book metadata (identifier, title, author, genres)
-- - Job linking (references ingestion_logs)
-- - Indexes for efficient querying
-- - Helper functions for statistics aggregation
```

**Benefits of the filter stats table:**
- Detailed breakdown of filtered books by genre vs author
- Top filtered genres and authors reporting
- Per-job filter statistics
- Complete audit trail of filter decisions

**Without the table:** The API falls back to computing statistics from `ingestion_logs`, which provides basic counts but no detailed genre/author breakdown.
