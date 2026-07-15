import { supabase } from '@/lib/supabase'
import {
  getCampaignInsights,
  getLeadsFromForm,
  parseLeadFields,
  MetaApiError,
} from './api'

// ─────────────────────────────────────────────────────────────
// Sync leads from a Meta lead form into our DB
// Called manually or on a schedule via Supabase Edge Function
// ─────────────────────────────────────────────────────────────
export async function syncLeadsFromForm(
  formId: string,
  campaignId: string, // Our internal campaign ID
  accessToken: string
): Promise<{ synced: number; errors: string[] }> {
  let synced = 0
  const errors: string[] = []
  let cursor: string | undefined

  try {
    do {
      const { leads, nextCursor } = await getLeadsFromForm(formId, accessToken, cursor)
      cursor = nextCursor

      for (const metaLead of leads) {
        try {
          const fields = parseLeadFields(metaLead.field_data)

          // Check if already synced
          const { data: existing } = await supabase
            .from('leads')
            .select('id')
            .eq('meta_lead_id', metaLead.id)
            .single()

          if (existing) continue

          // Insert new lead
          const { error } = await supabase.from('leads').insert({
            campaign_id: campaignId,
            meta_lead_id: metaLead.id,
            name: fields['full_name'] ?? fields['first_name']
              ? `${fields['first_name'] ?? ''} ${fields['last_name'] ?? ''}`.trim()
              : 'Unknown',
            phone: fields['phone_number'] ?? fields['phone'] ?? '',
            email: fields['email'] ?? null,
            status: 'new',
            raw_data: fields,
            created_at: metaLead.created_time,
          })

          if (error) errors.push(`Lead ${metaLead.id}: ${error.message}`)
          else synced++
        } catch (err) {
          errors.push(`Lead ${metaLead.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
    } while (cursor)
  } catch (err) {
    if (err instanceof MetaApiError) {
      errors.push(`Meta API error: ${err.message}`)
    } else {
      errors.push(`Sync error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return { synced, errors }
}

// ─────────────────────────────────────────────────────────────
// Sync campaign insights (spend, impressions, clicks, etc.)
// ─────────────────────────────────────────────────────────────
export async function syncCampaignInsights(
  metaCampaignId: string,
  ourCampaignId: string,
  accessToken: string,
  datePreset: 'last_7d' | 'last_30d' | 'this_month' = 'last_30d'
): Promise<{ success: boolean; error?: string }> {
  try {
    const insights = await getCampaignInsights(metaCampaignId, accessToken, datePreset)
    if (!insights) return { success: true }

    const leads = insights.actions?.find(a => a.action_type === 'lead')?.value ?? '0'
    const purchases = insights.actions?.find(a => a.action_type === 'purchase')?.value ?? '0'

    const { error } = await supabase.from('campaign_insights').upsert({
      campaign_id: ourCampaignId,
      date_preset: datePreset,
      impressions: Number(insights.impressions),
      clicks: Number(insights.clicks),
      spend: parseFloat(insights.spend),
      reach: Number(insights.reach),
      ctr: parseFloat(insights.ctr),
      cpc: parseFloat(insights.cpc),
      leads: Number(leads),
      purchases: Number(purchases),
      date_start: insights.date_start,
      date_stop: insights.date_stop,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'campaign_id,date_preset' })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Get cached insights from DB (for client dashboard)
// ─────────────────────────────────────────────────────────────
export async function getCachedInsights(campaignId: string, datePreset = 'last_30d') {
  const { data } = await supabase
    .from('campaign_insights')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('date_preset', datePreset)
    .single()
  return data
}

// ─────────────────────────────────────────────────────────────
// Trigger manual sync from admin panel
// ─────────────────────────────────────────────────────────────
export async function triggerSync(campaignId: string): Promise<{ success: boolean; message: string }> {
  try {
    // Get campaign info (meta_campaign_id is the Meta-side ID, stored directly on campaigns)
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (!campaign) return { success: false, message: 'Campaign not found' }
    if (!campaign.meta_campaign_id) return { success: false, message: 'No Meta campaign linked' }

    // Call Supabase Edge Function (which has the system access token)
    const { error } = await supabase.functions.invoke('sync-meta-leads', {
      body: {
        campaign_id: campaignId,
        meta_campaign_id: campaign.meta_campaign_id,
      },
    })

    if (error) return { success: false, message: error.message }
    return { success: true, message: 'Sync triggered successfully' }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Unknown error' }
  }
}
