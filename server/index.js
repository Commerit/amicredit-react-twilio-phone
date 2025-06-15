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

app.post("/voice", async (req, res) => {
  console.log('[VOICE] Incoming /voice request body:', req.body);
  const To = req.body.To;
  const userId = req.body.user_id;
  const baseUrl = getBaseUrl(req);
  // Insert pending call record
  if (userId && To) {
    try {
      await supabase.from('pending_calls').insert({ user_id: userId, to_number: To });
    } catch (err) {
      console.error('Error inserting pending call:', err);
    }
  }
  const response = new VoiceResponse();
  // Always set callerId to the team's number for outbound PSTN calls
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

app.post("/voice/incoming", async (req, res) => {
  console.log('[INBOUND] Incoming /voice/incoming request:', req.body);
  const baseUrl = getBaseUrl(req);
  const response = new VoiceResponse();
  // Find the team by the called number (To)
  let team = null;
  try {
    const { data: teamRow, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('phone_number', req.body.To)
      .single();
    if (teamError) console.error('[INBOUND] Error looking up team:', teamError);
    if (teamRow) team = teamRow;
    console.log('[INBOUND] Team lookup result:', teamRow);
  } catch (e) {
    console.error('[INBOUND] Exception looking up team for inbound call:', e);
  }
  let users = [];
  if (team) {
    try {
      const { data: userRows, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('team_id', team.id);
      if (usersError) console.error('[INBOUND] Error looking up users:', usersError);
      if (userRows) users = userRows;
      console.log('[INBOUND] Users lookup result:', userRows);
    } catch (e) {
      console.error('[INBOUND] Exception looking up users for inbound call:', e);
    }
  } else {
    console.warn('[INBOUND] No team found for inbound call to number:', req.body.To);
  }
  const dial = response.dial({
    callerId: req.body.From,
    answerOnBridge: true,
    record: "record-from-answer-dual",
    recordingStatusCallback: `${baseUrl}/twilio/recording`,
    recordingStatusCallbackEvent: "completed",
    recordingStatusCallbackMethod: "POST"
  });
  if (users.length > 0) {
    users.forEach(user => {
      console.log('[INBOUND] Dialing client identity:', user.id, 'for team:', team.id);
      const client = dial.client({
        statusCallbackEvent: "initiated ringing answered completed",
        statusCallback: `${baseUrl}/twilio/call-status`,
        statusCallbackMethod: "POST"
      }, user.id);
      // Pass the team_id as a custom parameter for logging
      client.parameter({ name: "team_id", value: team.id });
    });
  } else {
    // fallback: dial a default client (for debugging)
    console.warn('[INBOUND] No users found for team, dialing fallback client: phil');
    dial.client({
      statusCallbackEvent: "initiated ringing answered completed",
      statusCallback: `${baseUrl}/twilio/call-status`,
      statusCallbackMethod: "POST"
    }, "phil");
  }
  res.set("Content-Type", "text/xml");
  console.log('[INBOUND] Responding with TwiML:', response.toString());
  res.send(response.toString());
});

// Helper: Find user by ID only (no phone number)
async function findUserByIdOrNumber(userId) {
  if (userId) {
    const { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (user) return user;
  }
  return null;
}

// Helper: Find team by phone number
async function findTeamByNumber(phoneNumber) {
  if (!phoneNumber) return null;
  const { data: team, error } = await supabase.from('teams').select('*').eq('phone_number', phoneNumber).single();
  return team || null;
}

// Webhook endpoints for Twilio events
app.post("/twilio/call-status", async (req, res) => {
  try {
    console.log('[CALL-STATUS] Incoming webhook:', req.body);
    // Try to get userId from custom header or parameter (for outbound)
    let userId = req.headers['x-user-id'] || req.body.user_id || null;
    const { CallSid, CallStatus, From, To, Direction, Timestamp, StartTime, EndTime, Duration, CallDuration, RecordingDuration, ParentCallSid } = req.body;
    // If From is client:USER_ID, extract USER_ID
    if (!userId && typeof From === 'string' && From.startsWith('client:')) {
      userId = From.replace('client:', '');
      console.log('[CALL-STATUS] Extracted userId from From:', userId);
    }
    // For inbound calls, if the event is 'answered' or 'in-progress' and From is not client:..., but To is client:USER_ID, extract userId from To
    if (!userId && typeof To === 'string' && To.startsWith('client:') && (CallStatus === 'answered' || CallStatus === 'in-progress')) {
      userId = To.replace('client:', '');
      console.log('[CALL-STATUS] Extracted userId from To (inbound answered):', userId);
    }
    // If still no userId, try to find from pending_calls
    if (!userId && To) {
      // Find the most recent pending call for this To number within the last 5 minutes
      const { data: pending, error: pendingError } = await supabase
        .from('pending_calls')
        .select('*')
        .eq('to_number', To)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (pending && pending.user_id) {
        userId = pending.user_id;
        console.log('[CALL-STATUS] Matched userId from pending_calls:', userId, 'pending id:', pending.id);
        // Delete the pending call row
        await supabase.from('pending_calls').delete().eq('id', pending.id);
      } else {
        console.warn('[CALL-STATUS] No pending_call match found for To', To, 'pendingError:', pendingError);
        // Debug: fetch count of rows just for investigation
        try {
          const { data: allPendings, error: allPendingsErr } = await supabase
            .from('pending_calls')
            .select('id, user_id, to_number, created_at')
            .eq('to_number', To)
            .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());
          console.log('[CALL-STATUS] Pending calls rows for number', To, ':', allPendings?.length || 0, allPendings);
          if (allPendingsErr) console.error('[CALL-STATUS] Error fetching pending_calls list:', allPendingsErr);
        } catch (e) {
          console.error('[CALL-STATUS] Exception fetching pending_calls list:', e);
        }
      }
    }
    // If custom parameter team_id is present, use it
    let teamIdParam = req.body.team_id || null;
    // Find user and team
    let user = null, team = null, teamPhone = null;
    if (userId) {
      try {
        user = await findUserByIdOrNumber(userId);
        console.log('[CALL-STATUS] Found user:', user);
        if (user && user.team_id) {
          team = { id: user.team_id };
          // Fetch team phone number
          const { data: teamRow } = await supabase.from('teams').select('phone_number').eq('id', user.team_id).single();
          if (teamRow) teamPhone = teamRow.phone_number;
          console.log('[CALL-STATUS] Found team and phone:', team, teamPhone);
        }
      } catch (e) {
        console.error('[CALL-STATUS] Exception looking up user/team:', e);
      }
    }
    // If no team yet, try to find by To or From number
    if (!teamPhone) {
      try {
        const { data: teamByTo } = await supabase.from('teams').select('id, phone_number').eq('phone_number', To).single();
        if (teamByTo) {
          team = { id: teamByTo.id };
          teamPhone = teamByTo.phone_number;
          console.log('[CALL-STATUS] Matched team by To:', team, teamPhone);
        }
      } catch (e) {
        console.error('[CALL-STATUS] Exception matching team by To:', e);
      }
    }
    if (!teamPhone) {
      try {
        const { data: teamByFrom } = await supabase.from('teams').select('id, phone_number').eq('phone_number', From).single();
        if (teamByFrom) {
          team = { id: teamByFrom.id };
          teamPhone = teamByFrom.phone_number;
          console.log('[CALL-STATUS] Matched team by From:', team, teamPhone);
        }
      } catch (e) {
        console.error('[CALL-STATUS] Exception matching team by From:', e);
      }
    }
    // Classify direction
    let callDirection = 'unknown';
    // If From is PSTN and To is client:USER_ID, it's inbound
    if (From && /^\+\d{8,15}$/.test(From) && typeof To === 'string' && To.startsWith('client:')) {
      callDirection = 'inbound';
    } else if (teamPhone) {
      if (From === teamPhone) {
        callDirection = 'outbound';
      } else if (To === teamPhone) {
        callDirection = 'inbound';
      }
    }
    if (callDirection === 'unknown') {
      // Fallback to Twilio's Direction or 'unknown'
      callDirection = Direction || 'unknown';
    }
    console.log('[CALL-STATUS] Final direction:', callDirection);
    // Map Twilio statuses
    let internalStatus = CallStatus;
    if (CallStatus === 'busy' || CallStatus === 'no-answer' || CallStatus === 'failed') {
      internalStatus = 'missed';
    } else if (CallStatus === 'completed') {
      internalStatus = 'completed';
    }
    // Duration
    let durationSeconds = null;
    if (CallDuration) durationSeconds = parseInt(CallDuration);
    else if (RecordingDuration) durationSeconds = parseInt(RecordingDuration);
    else if (Duration) durationSeconds = parseInt(Duration);
    else if (StartTime && EndTime) durationSeconds = Math.floor((new Date(EndTime) - new Date(StartTime)) / 1000);
    // For answered inbound, try to get user who answered (if available)
    if (!user && req.body.answered_by_user_id) {
      try {
        user = await findUserByIdOrNumber(req.body.answered_by_user_id);
        console.log('[CALL-STATUS] Found user by answered_by_user_id:', user);
      } catch (e) {
        console.error('[CALL-STATUS] Exception looking up answered_by_user_id:', e);
      }
    }
    // Fetch existing call log if it exists
    let existingCallLog = null;
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('call_logs')
        .select('user_id, team_id')
        .eq('id', CallSid)
        .single();
      if (existing) existingCallLog = existing;
    } catch (e) {
      console.error('[CALL-STATUS] Exception fetching existing call log:', e);
    }
    const upsertData = {
      id: CallSid,
      parent_call_sid: ParentCallSid || null,
      direction: callDirection,
      from_number: From,
      to_number: To,
      started_at: StartTime || Timestamp || new Date().toISOString(),
      ended_at: EndTime || (CallStatus === 'completed' ? new Date().toISOString() : null),
      duration_seconds: durationSeconds,
      status: internalStatus,
      updated_at: new Date().toISOString(),
      team_id: teamIdParam || (team ? team.id : (existingCallLog ? existingCallLog.team_id : null)),
      user_id:
        (internalStatus === 'missed')
          ? (existingCallLog ? existingCallLog.user_id : null)
          : (user
              ? user.id
              : (existingCallLog ? existingCallLog.user_id : null))
    };
    // Only upsert if both user_id and team_id are present
    if (upsertData.user_id && upsertData.team_id) {
      console.log('[CALL-STATUS] Upserting call log:', upsertData);
      const result = await supabase.from('call_logs').upsert(upsertData, { onConflict: 'id' });
      if (result.error) {
        console.error("Error upserting call log:", result.error);
        return res.status(500).json({ error: "Failed to log call" });
      }
      console.log("Call log upserted successfully", upsertData);
    } else {
      console.log('[CALL-STATUS] Skipping upsert: missing user_id or team_id', upsertData);
      // Extra debug output
      console.log('[CALL-STATUS] Debug context:', { userId_detected: userId, teamId_detected: team ? team.id : null, teamIdParam });
      return res.sendStatus(200);
    }
    // Only log child calls with status 'completed' or parent call
    if (ParentCallSid && CallStatus !== 'completed') {
      // Only log missed for child if status is missed
      if (internalStatus !== 'missed') {
        return res.sendStatus(200);
      }
    }
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
        const { data, error } = await supabase.storage
          .from('recordings')
          .upload(filename, buffer, { contentType: 'audio/mpeg', upsert: true });
        if (error) throw error;
        // Manually construct the public URL
        const supabaseUrl = config.supabase.url || process.env.SUPABASE_URL;
        const manualPublicUrl = `${supabaseUrl}/storage/v1/object/public/recordings/${filename}`;
        console.log('Manually constructed public URL:', manualPublicUrl);
        if (!manualPublicUrl || !manualPublicUrl.startsWith('http') || !filename) {
          console.error('Failed to construct manual public URL for recording:', filename);
          return res.status(500).json({ error: 'Failed to construct public URL for recording' });
        }

        // Try to find the call log row for this CallSid
        let { data: callLog, error: fetchError } = await supabase
          .from('call_logs')
          .select('*')
          .eq('id', CallSid)
          .single();
        let updatedAny = false;
        if (callLog) {
          const updatedLog = { ...callLog, recording_url: manualPublicUrl, updated_at: new Date().toISOString() };
          console.log('[PARENT UPSERT] Payload:', updatedLog);
          const result = await supabase.from('call_logs').upsert(updatedLog, { onConflict: 'id' });
          console.log('[PARENT UPSERT] Result:', result);
          if (result.error) {
            console.error("Error upserting recording URL for id:", CallSid, result.error);
            return res.status(500).json({ error: "Failed to update recording" });
          }
          const { data: afterUpsert, error: afterUpsertError } = await supabase
            .from('call_logs')
            .select('*')
            .eq('id', CallSid)
            .single();
          console.log('[PARENT UPSERT] Row after upsert:', afterUpsert, afterUpsertError);
          updatedAny = true;
        }
        // Now update ALL children where parent_call_sid matches
        const { data: childLogs, error: childError } = await supabase
          .from('call_logs')
          .select('*')
          .eq('parent_call_sid', CallSid);
        if (childError) {
          console.error(`Error fetching child call logs for parent_call_sid ${CallSid}:`, childError);
        } else if (childLogs && childLogs.length > 0) {
          for (const child of childLogs) {
            const updatedChild = { ...child, recording_url: manualPublicUrl, updated_at: new Date().toISOString() };
            console.log(`[CHILD UPSERT] Payload for child id ${child.id}:`, updatedChild);
            const upsertResult = await supabase.from('call_logs').upsert(updatedChild, { onConflict: 'id' });
            console.log(`[CHILD UPSERT] Upsert result for child id ${child.id}:`, upsertResult);
            if (upsertResult.error) {
              console.error(`Error upserting recording URL for child id: ${child.id}`, upsertResult.error);
            } else {
              const updateResult = await supabase.from('call_logs').update({ recording_url: manualPublicUrl, updated_at: new Date().toISOString() }).eq('id', child.id);
              console.log(`[CHILD UPDATE] Direct update result for child id ${child.id}:`, updateResult);
              const { data: afterUpdate, error: afterUpdateError } = await supabase
                .from('call_logs')
                .select('*')
                .eq('id', child.id)
                .single();
              console.log(`[CHILD] Row after update for child id ${child.id}:`, afterUpdate, afterUpdateError);
              updatedAny = true;
            }
          }
        } else {
          console.log(`No child call logs found for parent_call_sid ${CallSid}`);
        }
        if (!updatedAny) {
          console.warn(`No call log rows were updated for CallSid ${CallSid}.`);
        }
        console.log("Recording uploaded to Supabase and recording_url update process completed");
      } catch (err) {
        console.error("Error downloading/uploading recording:", err);
        return res.status(500).json({ error: "Failed to process recording file" });
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
    console.log("Transcription webhook received:", {
      CallSid: req.body.CallSid,
      TranscriptionStatus: req.body.TranscriptionStatus
    });

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
      // Upload transcript to Supabase Storage
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
      try {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('transcripts')
          .upload(filename, fileBuffer, { contentType, upsert: true });
        if (uploadError) throw uploadError;
        // Get public URL
        const { publicURL } = supabase.storage.from('transcripts').getPublicUrl(filename);
        // Update call_logs with transcript_url and transcript (for chat UI)
        const result = await supabase.from('call_logs').upsert({
          id: CallSid,
          transcript: transcript,
          transcript_url: publicURL,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
        if (result.error) {
          console.error("Error upserting transcript:", result.error);
          return res.status(500).json({ error: "Failed to update transcript" });
        }
        console.log("Transcript uploaded to Supabase and URL upserted successfully");
      } catch (err) {
        console.error("Error uploading transcript file:", err);
        return res.status(500).json({ error: "Failed to process transcript file" });
      }
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

// TEMPORARY: Seed initial agent endpoint (remove after use)
app.post('/api/seed-initial-agent', async (req, res) => {
  const email = 'contact@commerit.com';
  const password = 'Commerit1!';
  try {
    // 1. Create Supabase Auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authError) {
      console.error('Error creating Supabase Auth user:', authError);
      return res.status(500).json({ error: 'Failed to create Supabase Auth user', details: authError });
    }
    const userId = authUser.user.id;
    // 2. Insert into users table (no phone number)
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .insert({ id: userId, email })
      .single();
    if (userError) {
      console.error('Error inserting into users table:', userError);
      return res.status(500).json({ error: 'Failed to insert into users table', details: userError });
    }
    console.log('Seeded initial agent:', userRow);
    res.json({ success: true, user: userRow });
  } catch (err) {
    console.error('Exception in seeding initial agent:', err);
    res.status(500).json({ error: 'Exception in seeding initial agent', details: err });
  }
});

// =====================
// USER MANAGEMENT API (ADMIN ONLY)
// =====================

// TODO: Add authentication/authorization middleware to restrict to admins only

// List all users
app.get('/api/users', async (req, res) => {
  try {
    // TODO: Restrict to admin users only
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Add a new user
app.post('/api/users', async (req, res) => {
  try {
    // TODO: Restrict to admin users only
    const { email, password, full_name, phone, team_id, role } = req.body;
    // 1. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) return res.status(400).json({ error: authError.message });
    // 2. Insert user profile in users table
    const { data: user, error: userError } = await supabase.from('users').insert({
      id: authUser.user.id,
      email,
      full_name,
      twilio_phone_number: phone,
      team_id,
      role: role || 'agent',
    }).select().single();
    if (userError) return res.status(400).json({ error: userError.message });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Edit a user
app.put('/api/users/:id', async (req, res) => {
  try {
    // TODO: Restrict to admin users only
    const { id } = req.params;
    const { email, password, full_name, phone, team_id, role } = req.body;
    // 1. Update user in Supabase Auth (if email or password provided)
    if (email || password) {
      const updates = {};
      if (email) updates.email = email;
      if (password) updates.password = password;
      const { error: authError } = await supabase.auth.admin.updateUserById(id, updates);
      if (authError) return res.status(400).json({ error: authError.message });
    }
    // 2. Update user profile in users table
    const { data: user, error: userError } = await supabase.from('users').update({
      email,
      full_name,
      twilio_phone_number: phone,
      team_id,
      role,
    }).eq('id', id).select().single();
    if (userError) return res.status(400).json({ error: userError.message });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete a user
app.delete('/api/users/:id', async (req, res) => {
  try {
    // TODO: Restrict to admin users only
    const { id } = req.params;
    // 1. Delete user from Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) return res.status(400).json({ error: authError.message });
    // 2. Delete user profile from users table
    const { error: userError } = await supabase.from('users').delete().eq('id', id);
    if (userError) return res.status(400).json({ error: userError.message });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Minimal call endpoint for direct agent call UI
app.get("/call/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const { number } = req.query;
  if (!number) {
    return res.status(400).send("Phone number is required");
  }
  try {
    // Verify the agent exists
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('id')
      .eq('id', agentId)
      .single();
    if (agentError || !agent) {
      return res.status(404).send("Agent not found");
    }
    // Serve the React app (the route will be handled client-side)
    res.sendFile(path.join(__dirname, '../build/index.html'));
  } catch (error) {
    console.error('Error in /call/:agentId:', error);
    res.status(500).send("Internal server error");
  }
});

// Catch-all handler to serve React's index.html for any other requests (client-side routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../build", "index.html"));
});

app.listen(3001, () =>
  console.log("Express server is running on localhost:3001")
);
