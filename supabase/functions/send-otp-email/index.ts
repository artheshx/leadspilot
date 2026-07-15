// supabase/functions/send-otp-email/index.ts
// Deploy: supabase functions deploy send-otp-email
// Requires: RESEND_API_KEY in Supabase secrets

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
    const { email, code } = await req.json()

   const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
   const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@marketingwithjayesh.in'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `LeadPilot <${FROM_EMAIL}>`,
        to: [email],
        subject: `${code} — Your LeadPilot verification code`,
        html: `
          <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#020409;color:#f1f5f9;border-radius:16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
              <div style="width:36px;height:36px;background:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;">
                <span style="color:white;font-size:18px;font-weight:bold;">⚡</span>
              </div>
              <span style="font-size:20px;font-weight:600;color:white;">Lead<span style="color:#60a5fa;">Pilot</span></span>
            </div>
            <h1 style="font-size:24px;font-weight:700;color:white;margin:0 0 8px;">Verify your email</h1>
            <p style="color:#94a3b8;margin:0 0 32px;line-height:1.6;">
              Enter this code to verify your email address. The code expires in 10 minutes.
            </p>
            <div style="background:#0a1628;border:1px solid #1e40af;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
              <span style="font-size:40px;font-weight:800;color:#60a5fa;letter-spacing:12px;">${code}</span>
            </div>
            <p style="color:#64748b;font-size:13px;margin:0;">
              If you didn't create a LeadPilot account, you can safely ignore this email.
            </p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message ?? 'Failed to send email')
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
