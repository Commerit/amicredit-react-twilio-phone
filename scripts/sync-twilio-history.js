require('dotenv').config();
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Helper function to map Twilio call status to our internal status
function mapCallStatus(twilioStatus) {
  switch (twilioStatus) {
    case 'completed':
      return 'completed';
    case 'busy':
    case 'no-answer':
    case 'failed':
    case 'canceled':
      return 'missed';
    default:
      return twilioStatus;
  }
}

// Helper function to determine call direction
function determineDirection(call) {
  // Twilio direction can be: inbound, outbound-api, outbound-dial
  if (call.direction === 'inbound') {
    return 'inbound';
  } else if (call.direction.startsWith('outbound')) {
    return 'outbound';
  }
  return call.direction;
}

// Sync a single call to Supabase
async function syncCall(call) {
  try {
    // Prepare call data
    const callData = {
      id: call.sid,
      direction: determineDirection(call),
      from_number: call.from,
      to_number: call.to,
      started_at: call.startTime.toISOString(),
      ended_at: call.endTime ? call.endTime.toISOString() : null,
      duration_seconds: call.duration ? parseInt(call.duration) : null,
      status: mapCallStatus(call.status),
      created_at: call.dateCreated.toISOString(),
      updated_at: new Date().toISOString()
    };

    // Fetch recordings for this call if any
    const recordings = await call.recordings().list();
    if (recordings.length > 0) {
      // Use the first recording (usually there's only one)
      const recording = recordings[0];
      callData.recording_url = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
      
      // Fetch transcriptions if available
      const transcriptions = await recording.transcriptions().list();
      if (transcriptions.length > 0) {
        const transcription = transcriptions[0];
        if (transcription.transcriptionText) {
          callData.transcript = transcription.transcriptionText;
        }
      }
    }

    // Upsert call data to Supabase
    const { error } = await supabase
      .from('call_logs')
      .upsert(callData, { onConflict: 'id' });

    if (error) {
      console.error(`Error syncing call ${call.sid}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Exception syncing call ${call.sid}:`, error);
    return false;
  }
}

// Main sync function
async function syncCallHistory(options = {}) {
  const {
    limit = 1000, // Max number of calls to sync
    startDate = null, // Optional: sync calls from this date
    endDate = null // Optional: sync calls until this date
  } = options;

  console.log('Starting Twilio call history sync...');
  console.log(`Config: limit=${limit}, startDate=${startDate}, endDate=${endDate}`);

  let totalCalls = 0;
  let successfulSyncs = 0;
  let failedSyncs = 0;

  try {
    // Build filter options
    const filterOptions = { limit: Math.min(limit, 1000) };
    if (startDate) filterOptions.startTimeBefore = startDate;
    if (endDate) filterOptions.startTimeAfter = endDate;

    // Fetch calls with pagination
    let hasMore = true;
    let page = await twilioClient.calls.page(filterOptions);

    while (hasMore && totalCalls < limit) {
      console.log(`Processing page with ${page.instances.length} calls...`);

      // Process each call on the current page
      for (const call of page.instances) {
        if (totalCalls >= limit) break;

        totalCalls++;
        process.stdout.write(`\rProcessing call ${totalCalls}...`);

        const success = await syncCall(call);
        if (success) {
          successfulSyncs++;
        } else {
          failedSyncs++;
        }
      }

      // Check if there are more pages
      if (page.hasNextPage() && totalCalls < limit) {
        page = await page.nextPage();
      } else {
        hasMore = false;
      }
    }

    console.log('\n\nSync completed!');
    console.log(`Total calls processed: ${totalCalls}`);
    console.log(`Successful syncs: ${successfulSyncs}`);
    console.log(`Failed syncs: ${failedSyncs}`);

  } catch (error) {
    console.error('Error during sync:', error);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    switch (args[i]) {
      case '--limit':
        options.limit = parseInt(args[i + 1]);
        break;
      case '--start-date':
        options.startDate = new Date(args[i + 1]);
        break;
      case '--end-date':
        options.endDate = new Date(args[i + 1]);
        break;
      case '--help':
        console.log(`
Usage: node sync-twilio-history.js [options]

Options:
  --limit <number>      Maximum number of calls to sync (default: 1000)
  --start-date <date>   Sync calls after this date (ISO format)
  --end-date <date>     Sync calls before this date (ISO format)
  --help                Show this help message

Examples:
  node sync-twilio-history.js --limit 100
  node sync-twilio-history.js --start-date 2024-01-01 --end-date 2024-12-31
        `);
        process.exit(0);
    }
  }

  // Validate environment variables
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.error('Error: Missing Twilio credentials. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Error: Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
    process.exit(1);
  }

  // Run the sync
  syncCallHistory(options)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { syncCallHistory }; 