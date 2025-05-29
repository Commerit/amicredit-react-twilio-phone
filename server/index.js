const config = require("./config");
const express = require("express");
const bodyParser = require("body-parser");
const pino = require("express-pino-logger")();
const { chatToken, videoToken, voiceToken } = require("./tokens");
const { VoiceResponse } = require("twilio").twiml;
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

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

    const { CallSid, CallStatus, From, To, Direction, Timestamp, StartTime, EndTime, Duration } = req.body;
    
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

    const result = await supabase.from('call_logs').upsert({
      id: CallSid,
      direction: callDirection,
      from_number: From,
      to_number: To,
      started_at: StartTime || Timestamp || new Date().toISOString(),
      ended_at: EndTime || (CallStatus === 'completed' ? new Date().toISOString() : null),
      duration_seconds: Duration ? parseInt(Duration) : null,
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
      const result = await supabase.from('call_logs').update({
        recording_url: RecordingUrl,
        updated_at: new Date().toISOString()
      }).eq('id', CallSid);

      if (result.error) {
        console.error("Error updating recording URL:", result.error);
        return res.status(500).json({ error: "Failed to update recording" });
      }

      console.log("Recording URL updated successfully");
    }
    res.sendStatus(200);
  } catch (error) {
    console.error("Exception in recording webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/twilio/transcription", async (req, res) => {
  try {
    console.log("Transcription webhook received:", {
      CallSid: req.body.CallSid,
      TranscriptionStatus: req.body.TranscriptionStatus
    });

    const { CallSid, TranscriptionText } = req.body;
    if (CallSid && TranscriptionText) {
      const result = await supabase.from('call_logs').update({
        transcript: TranscriptionText,
        updated_at: new Date().toISOString()
      }).eq('id', CallSid);

      if (result.error) {
        console.error("Error updating transcript:", result.error);
        return res.status(500).json({ error: "Failed to update transcript" });
      }

      console.log("Transcript updated successfully");
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
