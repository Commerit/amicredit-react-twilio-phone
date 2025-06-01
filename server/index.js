const config = require("./config");
const express = require("express");
const bodyParser = require("body-parser");
const pino = require("express-pino-logger")();
const { chatToken, videoToken, voiceToken } = require("./tokens");
const { VoiceResponse } = require("twilio").twiml;
const path = require("path");
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(pino);

// Serve static files from the React app build
app.use(express.static(path.join(__dirname, "../build")));

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// Helper to get the base URL for webhooks
const getBaseUrl = (req) => {
  // In production (Railway), use the actual host
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  // Fallback to request host
  const protocol = req.secure ? 'https' : 'http';
  return `${protocol}://${req.get('host')}`;
};

const sendTokenResponse = (token, res) => {
  res.set("Content-Type", "application/json");
  res.send(
    JSON.stringify({
      token: token.toJwt()
    })
  );
};

app.get("/api/greeting", (req, res) => {
  const name = req.query.name || "World";
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify({ greeting: `Hello ${name}!` }));
});

app.get("/chat/token", (req, res) => {
  const identity = req.query.identity;
  const token = chatToken(identity, config);
  sendTokenResponse(token, res);
});

app.post("/chat/token", (req, res) => {
  const identity = req.body.identity;
  const token = chatToken(identity, config);
  sendTokenResponse(token, res);
});

app.get("/video/token", (req, res) => {
  const identity = req.query.identity;
  const room = req.query.room;
  const token = videoToken(identity, room, config);
  sendTokenResponse(token, res);
});

app.post("/video/token", (req, res) => {
  const identity = req.body.identity;
  const room = req.body.room;
  const token = videoToken(identity, room, config);
  sendTokenResponse(token, res);
});

app.get("/voice/token", (req, res) => {
  const identity = req.query.identity;
  const token = voiceToken(identity, config);
  sendTokenResponse(token, res);
});

app.post("/voice/token", (req, res) => {
  const identity = req.body.identity;
  const token = voiceToken(identity, config);
  sendTokenResponse(token, res);
});

app.post("/voice", (req, res) => {
  const To = req.body.To;
  const baseUrl = getBaseUrl(req);
  const response = new VoiceResponse();
  const dial = response.dial({
    callerId: config.twilio.callerId,
    record: "record-from-answer-dual",
    recordingStatusCallback: `${baseUrl}/twilio/recording`,
    recordingStatusCallbackEvent: "completed",
    recordingStatusCallbackMethod: "POST"
  });
  dial.number({
    statusCallbackEvent: "initiated ringing answered completed",
    statusCallback: `${baseUrl}/twilio/call-status`,
    statusCallbackMethod: "POST"
  }, To);
  res.set("Content-Type", "text/xml");
  res.send(response.toString());
});

app.post("/voice/incoming", (req, res) => {
  const baseUrl = getBaseUrl(req);
  const response = new VoiceResponse();
  const dial = response.dial({
    callerId: req.body.From,
    answerOnBridge: true,
    record: "record-from-answer-dual",
    recordingStatusCallback: `${baseUrl}/twilio/recording`,
    recordingStatusCallbackEvent: "completed",
    recordingStatusCallbackMethod: "POST"
  });
  dial.client({
    statusCallbackEvent: "initiated ringing answered completed",
    statusCallback: `${baseUrl}/twilio/call-status`,
    statusCallbackMethod: "POST"
  }, "phil");
  res.set("Content-Type", "text/xml");
  res.send(response.toString());
});

// Webhook endpoints for Twilio events
app.post("/twilio/call-status", async (req, res) => {
  try {
    console.log("Call status webhook received:", {
      CallSid: req.body.CallSid,
      CallStatus: req.body.CallStatus,
      Direction: req.body.Direction,
      From: req.body.From,
      To: req.body.To
    });

    const { CallSid, CallStatus, From, To, Direction, Timestamp, StartTime, EndTime, Duration, CallDuration, RecordingDuration, ParentCallSid } = req.body;
    
    // Determine call direction based on webhook data
    let callDirection = Direction || '';
    if (!callDirection && req.body.Caller && req.body.Called) {
      // For outbound calls from the client
      callDirection = 'outbound-dial';
    }
    
    // Map Twilio statuses to our internal statuses
    let internalStatus = CallStatus;
    if (CallStatus === 'busy' || CallStatus === 'no-answer' || CallStatus === 'failed') {
      internalStatus = 'missed';
    } else if (CallStatus === 'completed') {
      internalStatus = 'completed';
    }

    // Calculate duration
    let durationSeconds = null;
    if (CallDuration) {
      durationSeconds = parseInt(CallDuration);
    } else if (RecordingDuration) {
      durationSeconds = parseInt(RecordingDuration);
    } else if (Duration) {
      durationSeconds = parseInt(Duration);
    } else if (StartTime && EndTime) {
      durationSeconds = Math.floor((new Date(EndTime) - new Date(StartTime)) / 1000);
    }

    const result = await supabase.from('call_logs').upsert({
      id: CallSid,
      parent_call_sid: ParentCallSid || null,
      direction: callDirection,
      from_number: From,
      to_number: To,
      started_at: StartTime || Timestamp || new Date().toISOString(),
      ended_at: EndTime || (CallStatus === 'completed' ? new Date().toISOString() : null),
      duration_seconds: durationSeconds,
      status: internalStatus,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (result.error) {
      console.error("Error upserting call log:", result.error);
      return res.status(500).json({ error: "Failed to log call" });
    }

    console.log("Call log upserted successfully");
    res.sendStatus(200);
  } catch (error) {
    console.error("Exception in call-status webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/twilio/recording", async (req, res) => {
  try {
    console.log("Recording webhook received:", {
      CallSid: req.body.CallSid,
      RecordingUrl: req.body.RecordingUrl,
      RecordingStatus: req.body.RecordingStatus
    });

    const { CallSid, RecordingUrl } = req.body;
    if (CallSid && RecordingUrl) {
      // Download the recording from Twilio (as .mp3)
      try {
        const twilioAuth = {
          username: process.env.TWILIO_ACCOUNT_SID || config.twilio.accountSid,
          password: process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_SECRET || config.twilio.apiSecret
        };
        const response = await axios.get(`${RecordingUrl}.mp3`, {
          responseType: 'arraybuffer',
          auth: twilioAuth,
        });
        const buffer = Buffer.from(response.data, 'binary');
        const filename = `${CallSid}.mp3`;
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(filename, buffer, { contentType: 'audio/mpeg', upsert: true });
        if (uploadError) throw uploadError;
        // Manually construct the public URL
        const supabaseUrl = config.supabase.url || process.env.SUPABASE_URL;
        const manualPublicUrl = `${supabaseUrl}/storage/v1/object/public/recordings/${filename}`;
        console.log('Manually constructed public URL:', manualPublicUrl);
        if (!manualPublicUrl || !manualPublicUrl.startsWith('http') || !filename) {
          console.error('Failed to construct manual public URL for recording:', filename);
          return res.status(500).json({ error: 'Failed to construct public URL for recording' });
        }

        // Update call_logs with recording_url and set transcription_status to 'processing'
        await supabase.from('call_logs').update({
          recording_url: manualPublicUrl,
          transcription_status: 'processing',
          updated_at: new Date().toISOString()
        }).eq('id', CallSid);

        // --- Begin transcription process ---
        try {
          // Send to OpenAI Whisper API
          const OpenAI = require('openai');
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const fs = require('fs');
          const os = require('os');
          const path = require('path');
          const tempFile = path.join(os.tmpdir(), filename);
          fs.writeFileSync(tempFile, buffer);
          const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFile),
            model: 'gpt-4o-transcribe',
            response_format: 'text',
          });
          const transcriptText = transcription.text;
          const transcriptFilename = `${CallSid}.txt`;
          const transcriptBuffer = Buffer.from(transcriptText, 'utf-8');
          // Upload transcript to Supabase Storage
          const { error: transcriptUploadError } = await supabase.storage
            .from('transcripts')
            .upload(transcriptFilename, transcriptBuffer, { contentType: 'text/plain', upsert: true });
          if (transcriptUploadError) throw transcriptUploadError;
          const transcriptUrl = `${supabaseUrl}/storage/v1/object/public/transcripts/${transcriptFilename}`;
          // Update call_logs with transcript and transcript_url
          await supabase.from('call_logs').update({
            transcript: transcriptText,
            transcript_url: transcriptUrl,
            transcription_status: 'completed',
            updated_at: new Date().toISOString()
          }).eq('id', CallSid);
          fs.unlinkSync(tempFile);
          console.log('Transcription completed and updated in call_logs.');
        } catch (transcriptionError) {
          console.error('Transcription failed:', transcriptionError);
          await supabase.from('call_logs').update({
            transcription_status: 'failed',
            updated_at: new Date().toISOString()
          }).eq('id', CallSid);
        }
        // --- End transcription process ---
      } catch (err) {
        console.error("Error downloading/uploading recording or during transcription:", err);
        await supabase.from('call_logs').update({
          transcription_status: 'failed',
          updated_at: new Date().toISOString()
        }).eq('id', CallSid);
        return res.status(500).json({ error: "Failed to process recording or transcription" });
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error("Exception in recording webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/twilio/transcription", async (req, res) => {
  try {
    console.log("Transcription webhook received:", req.body);

    const { CallSid, TranscriptionText } = req.body;
    let transcript = TranscriptionText;
    let isChat = false;
    // Try to parse as JSON array for chat UI
    try {
      if (typeof transcript === 'string' && transcript.trim().startsWith('[')) {
        transcript = JSON.parse(transcript);
        isChat = true;
      }
    } catch (e) {
      // fallback to raw string
    }
    if (CallSid && transcript) {
      // Prepare transcript file for upload
      let fileBuffer, filename, contentType;
      if (isChat) {
        fileBuffer = Buffer.from(JSON.stringify(transcript, null, 2), 'utf-8');
        filename = `${CallSid}.json`;
        contentType = 'application/json';
      } else {
        fileBuffer = Buffer.from(typeof transcript === 'string' ? transcript : JSON.stringify(transcript), 'utf-8');
        filename = `${CallSid}.txt`;
        contentType = 'text/plain';
      }
      console.log('[TRANSCRIPT] Prepared file:', { filename, contentType, transcript });
      try {
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('transcripts')
          .upload(filename, fileBuffer, { contentType, upsert: true });
        console.log('[TRANSCRIPT] Upload result:', { uploadData, uploadError });
        if (uploadError) throw uploadError;
        // Manually construct the public URL
        const supabaseUrl = config.supabase.url || process.env.SUPABASE_URL;
        const manualPublicUrl = `${supabaseUrl}/storage/v1/object/public/transcripts/${filename}`;
        console.log('[TRANSCRIPT] Manually constructed public URL:', manualPublicUrl);
        // Upsert transcript_url and transcript into call_logs
        const upsertPayload = {
          id: CallSid,
          transcript: transcript,
          transcript_url: manualPublicUrl,
          updated_at: new Date().toISOString()
        };
        console.log('[TRANSCRIPT] Upsert payload:', upsertPayload);
        const result = await supabase.from('call_logs').upsert(upsertPayload, { onConflict: 'id' });
        console.log('[TRANSCRIPT] Upsert result:', result);
        if (result.error) {
          console.error("Error upserting transcript:", result.error);
          return res.status(500).json({ error: "Failed to update transcript" });
        }
        console.log("Transcript uploaded to Supabase and URL upserted successfully");
      } catch (err) {
        console.error("Error uploading transcript file:", err);
        return res.status(500).json({ error: "Failed to process transcript file" });
      }
    } else {
      console.warn('[TRANSCRIPT] Missing CallSid or transcript:', { CallSid, transcript });
    }
    res.sendStatus(200);
  } catch (error) {
    console.error("Exception in transcription webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List calls with optional filters
app.get("/api/calls", async (req, res) => {
  const { direction, status, from, to, start, end, search, limit = 50, offset = 0 } = req.query;
  let query = supabase.from('call_logs').select('*');
  if (direction) query = query.eq('direction', direction);
  if (status) query = query.eq('status', status);
  if (from) query = query.ilike('from_number', `%${from}%`);
  if (to) query = query.ilike('to_number', `%${to}%`);
  if (start) query = query.gte('started_at', start);
  if (end) query = query.lte('started_at', end);
  if (search) {
    query = query.or(`from_number.ilike.%${search}%,to_number.ilike.%${search}%`);
  }
  query = query.order('started_at', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get call details by ID
app.get("/api/calls/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('call_logs').select('*').eq('id', id).single();
  if (error) return res.status(404).json({ error: 'Call not found' });
  res.json(data);
});

// Catch-all handler to serve React's index.html for any other requests (client-side routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build", "index.html"));
});

app.listen(3001, () =>
  console.log("Express server is running on localhost:3001")
);
