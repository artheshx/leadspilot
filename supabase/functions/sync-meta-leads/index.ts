// supabase/functions/sync-meta-leads/index.ts
// Deploy: supabase functions deploy sync-meta-leads

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { campaign_id, meta_campaign_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const META_ACCESS_TOKEN = Deno.env.get('META_SYSTEM_ACCESS_TOKEN')!
    const META_API_VERSION = 'v19.0'

    // Get campaign's ad sets → get lead forms
    const adSetsRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${meta_campaign_id}/adsets?fields=id,name&access_token=${META_ACCESS_TOKEN}`
    )
    const adSetsData = await adSetsRes.json()

    let totalSynced = 0
    const errors: string[] = []

    for (const adSet of (adSetsData.data ?? [])) {
      // Get lead forms for each ad set
      const formsRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${adSet.id}/leadgen_forms?fields=id,name&access_token=${META_ACCESS_TOKEN}`
      )
      const formsData = await formsRes.json()

      for (const form of (formsData.data ?? [])) {
        // Fetch leads from form
        const leadsRes = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${form.id}/leads?fields=id,created_time,field_data&limit=100&access_token=${META_ACCESS_TOKEN}`
        )
        const leadsData = await leadsRes.json()

        for (const lead of (leadsData.data ?? [])) {
          try {
            // Check if already exists
            const { data: existing } = await supabase
              .from('leads')
              .select('id')
              .eq('meta_lead_id', lead.id)
              .single()

            if (existing) continue

            // Parse fields
            const fields: Record<string, string> = {}
            for (const f of lead.field_data) {
              fields[f.name] = f.values[0] ?? ''
            }

            const name = fields['full_name'] ??
              `${fields['first_name'] ?? ''} ${fields['last_name'] ?? ''}`.trim() ||
              'Unknown'

            await supabase.from('leads').insert({
              campaign_id,
              meta_lead_id: lead.id,
              name,
              phone: fields['phone_number'] ?? fields['phone'] ?? '',
              email: fields['email'] ?? null,
              status: 'new',
              raw_data: fields,
              created_at: lead.created_time,
            })

            totalSynced++
          } catch (e) {
            errors.push(`Lead ${lead.id}: ${e}`)
          }
        }
      }
    }

    // Also sync insights
    const insightsRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${meta_campaign_id}/insights?fields=impressions,clicks,spend,reach,ctr,cpc,actions&date_preset=last_30d&access_token=${META_ACCESS_TOKEN}`
    )
    const insightsData = await insightsRes.json()

    if (insightsData.data?.[0]) {
      const ins = insightsData.data[0]
      const leads_count = ins.actions?.find((a: { action_type: string }) => a.action_type === 'lead')?.value ?? '0'

      await supabase.from('campaign_insights').upsert({
        campaign_id,
        date_preset: 'last_30d',
        impressions: Number(ins.impressions ?? 0),
        clicks: Number(ins.clicks ?? 0),
        spend: parseFloat(ins.spend ?? '0'),
        reach: Number(ins.reach ?? 0),
        ctr: parseFloat(ins.ctr ?? '0'),
        cpc: parseFloat(ins.cpc ?? '0'),
        leads: Number(leads_count),
        purchases: 0,
        date_start: ins.date_start,
        date_stop: ins.date_stop,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'campaign_id,date_preset' })
    }

    return new Response(
      JSON.stringify({ success: true, synced: totalSynced, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
