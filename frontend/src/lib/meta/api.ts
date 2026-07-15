// ─────────────────────────────────────────────────────────────
// Meta Marketing API client
// Docs: https://developers.facebook.com/docs/marketing-apis
// ─────────────────────────────────────────────────────────────

const META_API_VERSION = 'v19.0'
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`

export interface MetaCampaign {
  id: string
  name: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  objective: string
  daily_budget?: string
  lifetime_budget?: string
  created_time: string
}

export interface MetaAdSet {
  id: string
  name: string
  campaign_id: string
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
  daily_budget: string
  targeting: Record<string, unknown>
  created_time: string
}

export interface MetaInsights {
  impressions: string
  clicks: string
  spend: string
  reach: string
  ctr: string
  cpc: string
  cpp: string
  date_start: string
  date_stop: string
  actions?: Array<{ action_type: string; value: string }>
}

export interface MetaLead {
  id: string
  created_time: string
  field_data: Array<{ name: string; values: string[] }>
}

class MetaApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public type?: string
  ) {
    super(message)
    this.name = 'MetaApiError'
  }
}

// ─── Core fetch wrapper ─────────────────────────────────────
async function metaFetch<T>(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {},
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: Record<string, unknown>
): Promise<T> {
  const url = new URL(`${META_BASE}/${endpoint}`)
  url.searchParams.set('access_token', accessToken)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()

  if (data.error) {
    throw new MetaApiError(
      data.error.message,
      data.error.code,
      data.error.type
    )
  }

  return data as T
}

// ─── Ad Account ─────────────────────────────────────────────
export async function getAdAccount(accountId: string, accessToken: string) {
  return metaFetch<{ id: string; name: string; currency: string; account_status: number }>(
    `act_${accountId}`,
    accessToken,
    { fields: 'id,name,currency,account_status,amount_spent,balance' }
  )
}

// ─── Campaigns ──────────────────────────────────────────────
export async function getCampaigns(
  accountId: string,
  accessToken: string
): Promise<MetaCampaign[]> {
  const data = await metaFetch<{ data: MetaCampaign[] }>(
    `act_${accountId}/campaigns`,
    accessToken,
    { fields: 'id,name,status,objective,daily_budget,lifetime_budget,created_time', limit: '100' }
  )
  return data.data
}

export async function createCampaign(
  accountId: string,
  accessToken: string,
  params: {
    name: string
    objective: string
    status?: 'ACTIVE' | 'PAUSED'
    special_ad_categories?: string[]
  }
): Promise<{ id: string }> {
  return metaFetch(
    `act_${accountId}/campaigns`,
    accessToken,
    {},
    'POST',
    {
      name: params.name,
      objective: params.objective,
      status: params.status ?? 'PAUSED',
      special_ad_categories: params.special_ad_categories ?? [],
    }
  )
}

export async function updateCampaignStatus(
  campaignId: string,
  accessToken: string,
  status: 'ACTIVE' | 'PAUSED'
): Promise<{ success: boolean }> {
  return metaFetch(`${campaignId}`, accessToken, {}, 'POST', { status })
}

// ─── Ad Sets ────────────────────────────────────────────────
export async function getAdSets(
  accountId: string,
  accessToken: string,
  campaignId?: string
): Promise<MetaAdSet[]> {
  const params: Record<string, string> = {
    fields: 'id,name,campaign_id,status,daily_budget,targeting,created_time',
    limit: '100',
  }
  if (campaignId) params.campaign_id = campaignId

  const data = await metaFetch<{ data: MetaAdSet[] }>(
    `act_${accountId}/adsets`,
    accessToken,
    params
  )
  return data.data
}

// ─── Insights ───────────────────────────────────────────────
export async function getCampaignInsights(
  campaignId: string,
  accessToken: string,
  datePreset: 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'this_month' = 'last_30d'
): Promise<MetaInsights | null> {
  const data = await metaFetch<{ data: MetaInsights[] }>(
    `${campaignId}/insights`,
    accessToken,
    {
      fields: 'impressions,clicks,spend,reach,ctr,cpc,cpp,actions',
      date_preset: datePreset,
    }
  )
  return data.data[0] ?? null
}

export async function getAccountInsights(
  accountId: string,
  accessToken: string,
  datePreset: 'last_7d' | 'last_30d' | 'this_month' = 'last_30d'
): Promise<MetaInsights | null> {
  const data = await metaFetch<{ data: MetaInsights[] }>(
    `act_${accountId}/insights`,
    accessToken,
    {
      fields: 'impressions,clicks,spend,reach,ctr,cpc,actions',
      date_preset: datePreset,
    }
  )
  return data.data[0] ?? null
}

// ─── Lead Forms ─────────────────────────────────────────────
export async function getLeadForms(
  pageId: string,
  accessToken: string
): Promise<Array<{ id: string; name: string; status: string }>> {
  const data = await metaFetch<{ data: Array<{ id: string; name: string; status: string }> }>(
    `${pageId}/leadgen_forms`,
    accessToken,
    { fields: 'id,name,status', limit: '50' }
  )
  return data.data
}

export async function getLeadsFromForm(
  formId: string,
  accessToken: string,
  after?: string
): Promise<{ leads: MetaLead[]; nextCursor?: string }> {
  const params: Record<string, string> = {
    fields: 'id,created_time,field_data',
    limit: '100',
  }
  if (after) params.after = after

  const data = await metaFetch<{
    data: MetaLead[]
    paging?: { cursors?: { after?: string }; next?: string }
  }>(`${formId}/leads`, accessToken, params)

  return {
    leads: data.data,
    nextCursor: data.paging?.next ? data.paging.cursors?.after : undefined,
  }
}

// ─── Helper: parse lead fields ───────────────────────────────
export function parseLeadFields(fieldData: MetaLead['field_data']): Record<string, string> {
  const result: Record<string, string> = {}
  fieldData.forEach(field => {
    result[field.name] = field.values[0] ?? ''
  })
  return result
}

// ─── Helper: map Meta objective to our system ────────────────
export function mapObjective(metaObjective: string): string {
  const map: Record<string, string> = {
    LEAD_GENERATION: 'Lead generation',
    TRAFFIC: 'Traffic',
    CONVERSIONS: 'Conversions',
    BRAND_AWARENESS: 'Brand awareness',
    APP_INSTALLS: 'App installs',
    STORE_VISITS: 'Store visits',
    REACH: 'Brand awareness',
    ENGAGEMENT: 'Brand awareness',
    VIDEO_VIEWS: 'Traffic',
    MESSAGES: 'Lead generation',
    OUTCOME_LEADS: 'Lead generation',
    OUTCOME_TRAFFIC: 'Traffic',
    OUTCOME_AWARENESS: 'Brand awareness',
    OUTCOME_SALES: 'Conversions',
    OUTCOME_APP_PROMOTION: 'App installs',
  }
  return map[metaObjective] ?? metaObjective
}

export { MetaApiError }
