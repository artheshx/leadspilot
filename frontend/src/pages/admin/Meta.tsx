import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Shield, Plus, X, Link2, Users, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { triggerSync } from '@/lib/meta/sync'
import { cn } from '@/lib/utils'

interface MetaAccount {
  id: string
  account_id: string
  account_name: string
  assigned_user_id: string | null
  assigned_user_name: string | null
  status: 'active' | 'paused' | 'disconnected'
  created_at: string
}

interface Profile {
  id: string
  full_name: string
  email: string
}

interface Campaign {
  id: string
  name: string
  status: string
  meta_campaign_id: string | null
  user_name: string
}

type MetaAccountRow = Omit<MetaAccount, 'assigned_user_name'> & {
  profiles?: {
    full_name: string | null
  } | null
}

type CampaignRow = Omit<Campaign, 'user_name'> & {
  profiles?: {
    full_name: string | null
  } | { full_name: string | null }[] | null
}

export default function AdminMeta() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ account_id: '', account_name: '', assigned_user_id: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncResults, setSyncResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [linkingCampaign, setLinkingCampaign] = useState<string | null>(null)
  const [metaIdInput, setMetaIdInput] = useState('')
  const [savingLink, setSavingLink] = useState(false)

  const fetchData = async () => {
    const [{ data: accts }, { data: profiles }, { data: camps }] = await Promise.all([
      supabase.from('meta_accounts').select('*, profiles(full_name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'client').order('full_name'),
      supabase.from('campaigns').select('id, name, status, meta_campaign_id, profiles!inner(full_name)').eq('status', 'active'),
    ])
    setAccounts(((accts ?? []) as MetaAccountRow[]).map(a => ({ ...a, assigned_user_name: a.profiles?.full_name ?? null })))
    setUsers(profiles ?? [])
    setCampaigns(((camps ?? []) as CampaignRow[]).map(c => {
      const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
      return { ...c, user_name: profile?.full_name ?? 'Unknown' }
    }))
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.account_id.trim()) e.account_id = 'Meta account ID is required'
    if (!form.account_name.trim()) e.account_name = 'Account name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAdd = async () => {
    if (!validate()) return
    setSaving(true)
    await supabase.from('meta_accounts').insert({
      account_id: form.account_id.trim(),
      account_name: form.account_name.trim(),
      assigned_user_id: form.assigned_user_id || null,
      status: 'active',
    })
    setSaving(false)
    setShowAdd(false)
    setForm({ account_id: '', account_name: '', assigned_user_id: '' })
    fetchData()
  }

  const handleAssign = async (accountId: string, userId: string) => {
    setAssigning(accountId)
    await supabase.from('meta_accounts').update({ assigned_user_id: userId || null }).eq('id', accountId)
    await fetchData()
    setAssigning(null)
  }

  const handleSync = async (campaignId: string) => {
    setSyncing(campaignId)
    const result = await triggerSync(campaignId)
    setSyncResults(prev => ({ ...prev, [campaignId]: result }))
    setSyncing(null)
    setTimeout(() => setSyncResults(prev => { const n = { ...prev }; delete n[campaignId]; return n }), 5000)
  }

  const handleLinkCampaign = async (campaignId: string) => {
    if (!metaIdInput.trim()) return
    setSavingLink(true)
    await supabase.from('campaigns').update({ meta_campaign_id: metaIdInput.trim() }).eq('id', campaignId)
    setLinkingCampaign(null)
    setMetaIdInput('')
    setSavingLink(false)
    fetchData()
  }

  const inputCls = (err?: string) => cn(
    'w-full bg-dark-800 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all',
    err ? 'border-red-500/50' : 'border-white/10 hover:border-white/20'
  )

  const STATUS_COLOR: Record<string, string> = {
    active: 'text-green-400 border-green-500/30 bg-green-500/10',
    paused: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    disconnected: 'text-red-400 border-red-500/30 bg-red-500/10',
  }

  return (
    <>
      <Helmet><title>Meta Accounts — Admin LeadPilot</title></Helmet>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Meta Accounts</h1>
            <p className="text-slate-400 text-sm mt-1">Connect ad accounts and sync leads from Meta</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
            <Plus size={15} /> Add account
          </button>
        </div>

        <div className="glass-blue rounded-2xl p-4 flex gap-3">
          <Shield size={18} className="text-brand-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-medium text-sm mb-1">How it works</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              1. Add Meta ad account ID &nbsp;2. Assign to client &nbsp;3. Link active campaigns to Meta campaign IDs &nbsp;4. Click "Sync now" to pull leads and metrics
            </p>
          </div>
        </div>

        {/* Ad Accounts */}
        <div>
          <h2 className="text-base font-semibold text-white mb-4">Ad accounts</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-20 glass rounded-xl animate-pulse" />)}</div>
          ) : accounts.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <Link2 size={28} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No Meta accounts yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(account => (
                <div key={account.id} className="glass rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-10 h-10 bg-brand-600/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield size={18} className="text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-semibold">{account.account_name}</p>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border', STATUS_COLOR[account.status])}>{account.status}</span>
                    </div>
                    <p className="text-slate-500 text-xs font-mono">act_{account.account_id}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:max-w-xs w-full sm:w-auto">
                    <Users size={14} className="text-slate-500 flex-shrink-0" />
                    <select
                      value={account.assigned_user_id ?? ''}
                      onChange={e => handleAssign(account.id, e.target.value)}
                      disabled={assigning === account.id}
                      className="flex-1 bg-dark-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campaign linking */}
        <div>
          <h2 className="text-base font-semibold text-white mb-4">Campaign linking & sync</h2>
          {campaigns.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-slate-500 text-sm">No active campaigns to link</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(camp => {
                const result = syncResults[camp.id]
                const isSyncing = syncing === camp.id
                const isLinking = linkingCampaign === camp.id
                return (
                  <div key={camp.id} className="glass rounded-xl p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{camp.name}</p>
                        <p className="text-slate-500 text-xs">{camp.user_name}</p>
                        {camp.meta_campaign_id
                          ? <p className="text-brand-400 text-xs font-mono mt-1">Meta ID: {camp.meta_campaign_id}</p>
                          : <p className="text-slate-600 text-xs mt-1">Not linked to Meta</p>
                        }
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => { setLinkingCampaign(isLinking ? null : camp.id); setMetaIdInput(camp.meta_campaign_id ?? '') }}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Link2 size={12} />{camp.meta_campaign_id ? 'Relink' : 'Link'}
                        </button>
                        {camp.meta_campaign_id && (
                          <button
                            onClick={() => handleSync(camp.id)}
                            disabled={isSyncing}
                            className="flex items-center gap-1.5 text-xs text-brand-400 border border-brand-500/30 hover:bg-brand-500/10 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                          >
                            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                            {isSyncing ? 'Syncing…' : 'Sync now'}
                          </button>
                        )}
                      </div>
                    </div>
                    {result && (
                      <div className={cn('mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg', result.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>
                        {result.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {result.message}
                      </div>
                    )}
                    {isLinking && (
                      <div className="mt-4 flex gap-2">
                        <input
                          type="text"
                          placeholder="Meta Campaign ID (e.g. 120200123456789)"
                          value={metaIdInput}
                          onChange={e => setMetaIdInput(e.target.value)}
                          className="flex-1 bg-dark-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                        />
                        <button onClick={() => handleLinkCampaign(camp.id)} disabled={savingLink || !metaIdInput.trim()} className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-xl transition-all">
                          {savingLink ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setLinkingCampaign(null)} className="text-slate-400 hover:text-white px-2"><X size={16} /></button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
          <div className="relative glass rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Add Meta account</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Meta Ad Account ID *</label>
                <input type="text" placeholder="123456789 (without act_)" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} className={inputCls(errors.account_id)} />
                {errors.account_id && <p className="mt-1 text-xs text-red-400">{errors.account_id}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Account name *</label>
                <input type="text" placeholder="e.g. Sharma Electronics - Main" value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} className={inputCls(errors.account_name)} />
                {errors.account_name && <p className="mt-1 text-xs text-red-400">{errors.account_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Assign to client (optional)</label>
                <select value={form.assigned_user_id} onChange={e => setForm(f => ({ ...f, assigned_user_id: e.target.value }))} className={cn(inputCls(), 'cursor-pointer')}>
                  <option value="">Select client</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="flex-1 border border-white/10 hover:border-white/20 text-slate-300 text-sm py-3 rounded-xl transition-all">Cancel</button>
                <button onClick={handleAdd} disabled={saving} className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium py-3 rounded-xl transition-all">
                  {saving ? 'Adding…' : 'Add account →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
