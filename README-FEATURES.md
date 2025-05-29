# Call Logging and Activity Features

## Overview

This application now includes comprehensive call logging with recordings and transcripts stored in Supabase. All calls are automatically logged with detailed information, and historical Twilio data can be synced.

## Features

### 1. Real-time Call Logging
- Automatic logging of all inbound and outbound calls
- Call direction, duration, status, and timestamps tracked
- Recording URLs captured when available
- Transcripts can be added (requires additional Twilio configuration)

### 2. Activity Dashboard
- View all call history with search and filters
- Filter by call type: All, Inbound, Outbound, or Missed
- Search by phone number
- Visual indicators for recordings and transcripts
- Auto-refresh for pending recordings (⏳ indicates processing)

### 3. Call Details View
- Detailed information for each call
- Audio player for call recordings
- Transcript display when available
- Quick action to view all calls with the same number

### 4. Historical Data Sync
- Script to import existing Twilio call history
- Includes recordings and transcripts from past calls

## Setup

### 1. Supabase Database

The `call_logs` table is automatically created with this schema:

```sql
CREATE TABLE call_logs (
  id TEXT PRIMARY KEY,  -- Twilio Call SID
  direction TEXT,       -- inbound, outbound, etc.
  from_number TEXT,
  to_number TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  status TEXT,          -- completed, missed, etc.
  recording_url TEXT,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_logs_direction ON call_logs(direction);
CREATE INDEX idx_call_logs_status ON call_logs(status);
CREATE INDEX idx_call_logs_from ON call_logs(from_number);
CREATE INDEX idx_call_logs_to ON call_logs(to_number);
CREATE INDEX idx_call_logs_started ON call_logs(started_at);
```

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Supabase configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Railway deployment (auto-set by Railway)
RAILWAY_PUBLIC_DOMAIN=your_domain.up.railway.app
```

### 3. Twilio Webhook Configuration

The application automatically configures webhooks in the TwiML responses. No manual Twilio configuration needed!

## Usage

### Viewing Call Activity

1. Click the "Activity" tab in the bottom navigation
2. Browse your call history
3. Use filters to find specific calls
4. Click any call to view details

### Syncing Historical Data

Run the sync script to import past calls from Twilio:

```bash
# Sync last 100 calls
node scripts/sync-twilio-history.js --limit 100

# Sync calls from a specific date range
node scripts/sync-twilio-history.js --start-date 2024-01-01 --end-date 2024-12-31

# View help
node scripts/sync-twilio-history.js --help
```

### Recording and Transcription

- **Recordings**: Automatically captured for all calls
- **Transcripts**: Require additional Twilio configuration:
  1. Enable transcription in your Twilio account
  2. Update recording webhook to include transcription callback
  3. Transcripts will appear automatically when ready

## Webhook Endpoints

The server exposes these webhook endpoints for Twilio:

- `POST /twilio/call-status` - Receives call status updates
- `POST /twilio/recording` - Receives recording URLs when ready
- `POST /twilio/transcription` - Receives transcription text

## Troubleshooting

### Calls Not Logging

1. Check server logs for webhook errors
2. Verify Supabase credentials are correct
3. Ensure Railway public domain is set correctly
4. Test webhooks using Twilio's webhook debugger

### Recordings Not Appearing

1. Recordings may take 1-2 minutes to process
2. Check if recording URL shows "pending" status
3. Verify recording is enabled in TwiML configuration

### Auto-refresh Not Working

The activity page auto-refreshes every 5 seconds when there are pending recordings. If not working:
1. Check browser console for errors
2. Verify API endpoints are accessible
3. Check network tab for failed requests

## Future Enhancements

- Add call analytics and statistics
- Export call logs to CSV
- Advanced search with date ranges
- Call tagging and notes
- Voicemail detection and handling
- Integration with CRM systems 