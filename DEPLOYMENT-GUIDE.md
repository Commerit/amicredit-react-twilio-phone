# Deployment Guide for Railway

## Prerequisites
1. Railway account
2. Twilio account with phone number
3. Supabase project created

## Step 1: Deploy to Railway

1. Connect your GitHub repository to Railway
2. Railway will auto-detect the Node.js app

## Step 2: Configure Environment Variables

In Railway dashboard, add these variables:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxx
TWILIO_CALLER_ID=+1234567890
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=xxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxx

# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Railway sets this automatically
# RAILWAY_PUBLIC_DOMAIN=your-app.up.railway.app
```

## Step 3: Update Twilio Configuration

1. Go to Twilio Console → Phone Numbers
2. Select your phone number
3. Configure webhooks:
   - Voice & Fax → A CALL COMES IN: `https://your-app.up.railway.app/voice/incoming`
   - Method: HTTP POST

4. Go to Twilio Console → Voice → TwiML Apps
5. Select your TwiML app
6. Update Request URL: `https://your-app.up.railway.app/voice`
7. Method: HTTP POST

## Step 4: Deploy and Test

1. Railway will automatically deploy on push
2. Access your app at: `https://your-app.up.railway.app`
3. Test making a call
4. Check Activity tab for call logs

## Step 5: Sync Historical Data (Optional)

SSH into Railway service or run locally:

```bash
# Set environment variables first
export TWILIO_ACCOUNT_SID=...
export TWILIO_AUTH_TOKEN=...
export SUPABASE_URL=...
export SUPABASE_SERVICE_KEY=...

# Sync last 100 calls
npm run sync-history -- --limit 100
```

## Troubleshooting

### Webhooks Not Working
1. Check Railway logs: `railway logs`
2. Verify RAILWAY_PUBLIC_DOMAIN is set
3. Test webhooks: `WEBHOOK_BASE_URL=https://your-app.up.railway.app npm run test-webhooks`

### Calls Not Logging
1. Check Supabase connection in logs
2. Verify service key has write permissions
3. Check webhook responses in Twilio debugger

### Recording URLs Not Updating
1. Recordings take 1-2 minutes to process
2. Check if webhook URL is accessible
3. Verify recording is enabled in voice settings

## Production Considerations

1. **Security**: Use environment variables, never commit secrets
2. **Scaling**: Railway auto-scales based on usage
3. **Monitoring**: Set up error tracking (e.g., Sentry)
4. **Backups**: Enable Supabase point-in-time recovery
5. **Costs**: Monitor Twilio usage and Railway resource consumption

## Updating the Application

```bash
# Push changes to main branch
git add .
git commit -m "Update feature"
git push origin main

# Railway auto-deploys on push
```

## Useful Commands

```bash
# View logs
railway logs

# Run commands in production
railway run npm run sync-history -- --limit 50

# Open Railway dashboard
railway open
``` 