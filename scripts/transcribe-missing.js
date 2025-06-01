const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const OpenAI = require('openai');

// Load env vars
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_KEY, or OPENAI_API_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function main() {
  console.log('Fetching calls with recordings but no transcript...');
  const { data: calls, error } = await supabase
    .from('call_logs')
    .select('*')
    .not('recording_url', 'is', null)
    .or('transcript_url.is.null,transcript_url.eq.');

  if (error) {
    console.error('Error fetching call logs:', error);
    process.exit(1);
  }
  if (!calls || calls.length === 0) {
    console.log('No calls found needing transcription.');
    return;
  }
  console.log(`Found ${calls.length} calls to process.`);

  for (const call of calls) {
    try {
      console.log(`\nProcessing call: ${call.id}`);
      const mp3Url = call.recording_url;
      if (!mp3Url) {
        console.warn('No recording_url for call:', call.id);
        continue;
      }
      // Download MP3 to temp file
      const tempFile = path.join(os.tmpdir(), `${call.id}.mp3`);
      console.log('Downloading MP3 from:', mp3Url);
      const response = await axios.get(mp3Url, { responseType: 'stream' });
      const writer = fs.createWriteStream(tempFile);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      console.log('MP3 downloaded to:', tempFile);

      // Send to OpenAI Whisper
      console.log('Sending audio to OpenAI Whisper API...');
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: 'gpt-4o-transcribe',
        response_format: 'text',
      });
      const transcriptText = transcription.text;
      console.log('Transcript received:', transcriptText.slice(0, 100) + (transcriptText.length > 100 ? '...' : ''));

      // Save transcript to Supabase Storage
      const transcriptFilename = `${call.id}.txt`;
      const transcriptBuffer = Buffer.from(transcriptText, 'utf-8');
      console.log('Uploading transcript to Supabase Storage:', transcriptFilename);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('transcripts')
        .upload(transcriptFilename, transcriptBuffer, { contentType: 'text/plain', upsert: true });
      if (uploadError) {
        console.error('Error uploading transcript:', uploadError);
        continue;
      }
      const transcriptUrl = `${SUPABASE_URL}/storage/v1/object/public/transcripts/${transcriptFilename}`;
      console.log('Transcript public URL:', transcriptUrl);

      // Update call_logs row
      const { error: updateError } = await supabase.from('call_logs').update({
        transcript: transcriptText,
        transcript_url: transcriptUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', call.id);
      if (updateError) {
        console.error('Error updating call_logs with transcript:', updateError);
        continue;
      }
      console.log('call_logs updated successfully.');

      // Clean up temp file
      fs.unlinkSync(tempFile);
    } catch (err) {
      console.error('Error processing call', call.id, err);
    }
  }
  console.log('Done processing all calls.');
}

main(); 