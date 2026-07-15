// supabase/functions/send-otp-sms/index.ts
// Deploy: supabase functions deploy send-otp-sms
// Requires: FAST2SMS_API_KEY in Supabase secrets (fast2sms.com — Indian SMS provider)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, code } = await req.json()

    // Strip +91 or country code — Fast2SMS needs 10-digit Indian number
    const cleaned = phone.replace(/^\+91/, '').replace(/\D/g, '').slice(-10)

    const FAST2SMS_KEY = Deno.env.get('FAST2SMS_API_KEY')!

    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': FAST2SMS_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',  // Quick/transactional route
        message: `${code} is your LeadPilot verification code. Valid for 10 minutes. Do not share with anyone.`,
        language: 'english',
        flash: 0,
        numbers: cleaned,
      }),
    })

    const data = await res.json()

    if (!data.return) {
      // Try MSG91 as fallback
      const MSG91_KEY = Deno.env.get('MSG91_API_KEY')
      if (MSG91_KEY) {
        await fetch('https://api.msg91.com/api/v5/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'authkey': MSG91_KEY },
          body: JSON.stringify({
            template_id: Deno.env.get('MSG91_OTP_TEMPLATE_ID'),
            mobile: `91${cleaned}`,
            otp: code,
          }),
        })
      } else {
        throw new Error(data.message ?? 'SMS sending failed')
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
