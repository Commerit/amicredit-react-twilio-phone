const axios = require('axios');

// Configuration
const BASE_URL = process.env.WEBHOOK_BASE_URL || 'http://localhost:3001';
const TEST_CALL_SID = 'CA' + Math.random().toString(36).substr(2, 32);

async function testWebhook(endpoint, data, description) {
  console.log(`\nTesting ${description}...`);
  try {
    const response = await axios.post(`${BASE_URL}${endpoint}`, data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    console.log(`✓ Success: ${response.status} ${response.statusText}`);
    return true;
  } catch (error) {
    console.log(`✗ Failed: ${error.response?.status} ${error.response?.statusText || error.message}`);
    if (error.response?.data) {
      console.log('  Error details:', error.response.data);
    }
    return false;
  }
}

async function runTests() {
  console.log('Starting webhook tests...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Call SID: ${TEST_CALL_SID}`);

  // Test 1: Call initiated
  await testWebhook('/twilio/call-status', {
    CallSid: TEST_CALL_SID,
    CallStatus: 'initiated',
    Direction: 'outbound-dial',
    From: '+11234567890',
    To: '+19876543210',
    Timestamp: new Date().toISOString()
  }, 'Call Status - Initiated');

  // Test 2: Call ringing
  await testWebhook('/twilio/call-status', {
    CallSid: TEST_CALL_SID,
    CallStatus: 'ringing',
    Direction: 'outbound-dial',
    From: '+11234567890',
    To: '+19876543210',
    Timestamp: new Date().toISOString()
  }, 'Call Status - Ringing');

  // Test 3: Call answered
  await testWebhook('/twilio/call-status', {
    CallSid: TEST_CALL_SID,
    CallStatus: 'answered',
    Direction: 'outbound-dial',
    From: '+11234567890',
    To: '+19876543210',
    StartTime: new Date().toISOString(),
    Timestamp: new Date().toISOString()
  }, 'Call Status - Answered');

  // Test 4: Call completed
  await testWebhook('/twilio/call-status', {
    CallSid: TEST_CALL_SID,
    CallStatus: 'completed',
    Direction: 'outbound-dial',
    From: '+11234567890',
    To: '+19876543210',
    StartTime: new Date(Date.now() - 60000).toISOString(),
    EndTime: new Date().toISOString(),
    Duration: '60',
    Timestamp: new Date().toISOString()
  }, 'Call Status - Completed');

  // Test 5: Recording ready
  await testWebhook('/twilio/recording', {
    CallSid: TEST_CALL_SID,
    RecordingUrl: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123.mp3',
    RecordingStatus: 'completed',
    RecordingSid: 'RE' + Math.random().toString(36).substr(2, 32)
  }, 'Recording Ready');

  // Test 6: Transcription ready
  await testWebhook('/twilio/transcription', {
    CallSid: TEST_CALL_SID,
    TranscriptionText: 'This is a test transcription of the call.',
    TranscriptionStatus: 'completed',
    TranscriptionSid: 'TR' + Math.random().toString(36).substr(2, 32)
  }, 'Transcription Ready');

  // Test 7: Test API endpoints
  console.log('\nTesting API endpoints...');
  
  try {
    const listResponse = await axios.get(`${BASE_URL}/api/calls?limit=10`);
    console.log(`✓ List calls: Found ${listResponse.data.length} calls`);
  } catch (error) {
    console.log(`✗ List calls failed: ${error.message}`);
  }

  try {
    const detailResponse = await axios.get(`${BASE_URL}/api/calls/${TEST_CALL_SID}`);
    console.log(`✓ Get call details: Found call ${TEST_CALL_SID}`);
  } catch (error) {
    console.log(`✗ Get call details failed: ${error.response?.status === 404 ? 'Call not found (expected if database is empty)' : error.message}`);
  }

  console.log('\nWebhook tests completed!');
  console.log('\nNote: Check your server logs for detailed webhook processing information.');
}

// Run tests
runTests().catch(console.error); 