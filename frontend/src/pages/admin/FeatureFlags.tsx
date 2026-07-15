import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ToggleLeft, ToggleRight, Info } from 'lucide-react'
import { adminGet, adminSend, AdminApiError } from '@/lib/adminApi'

interface FeatureFlag { id: string; name: string; description: string; enabled: boolean }
interface PermissionRule { id: string; action: string; description: string; allowed: boolean }

const DEFAULT_FLAGS: FeatureFlag[] = [
  { id: 'google_ads', name: 'Enable Google Search Campaigns', description: 'Allows drafting and launching target keyword ads via Google Ads SDK.', enabled: false },
  { id: 'seo', name: 'Enable SEO Audit Engine', description: 'Analyzes user business locations and competitor directories for search ranking reports.', enabled: false },
  { id: 'whatsapp', name: 'Enable WhatsApp Cloud Notifications', description: 'Triggers message alerts on lead verification and campaign status changes.', enabled: true },
  { id: 'builder', name: 'Enable Inline Landing Page Builder', description: 'Provides whitelabel WYSIWYG editor configurations inside landing pages templates.', enabled: false },
]

const DEFAULT_PERMISSIONS: PermissionRule[] = [
  { id: 'allow_ai', action: 'Allow Conversational Employee Control', description: 'Enables chat strategy drafting and automated operations.', allowed: true },
  { id: 'create', action: 'Create Draft Campaigns', description: 'Allows users to formulate budget recommendations and strategies.', allowed: true },
  { id: 'publish', action: 'Publish Campaigns to Meta', description: 'Authorizes payment confirmations and publishing to Meta accounts.', allowed: true },
  { id: 'pause', action: 'Pause Live Campaigns', description: 'Allows users to instantly pause target active campaigns.', allowed: true },
  { id: 'delete', action: 'Delete Campaigns from System', description: 'Authorizes hard deleting historical campaigns data.', allowed: false },
  { id: 'budget', action: 'Adjust Daily Budgets Inline', description: 'Allows increasing or decreasing campaign daily budgets.', allowed: true },
  { id: 'transfer', action: 'Fund Requests & Wallet Transfer', description: 'Allows direct fund request actions without administrator verification.', allowed: false },
]

export default function AdminFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [permissions, setPermissions] = useState<PermissionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      let flagRows = await adminGet<FeatureFlag[]>('/feature-flags')
      if (flagRows.length === 0) {
        for (const f of DEFAULT_FLAGS) await adminSend(`/feature-flags/${f.id}`, 'PUT', { name: f.name, description: f.description, enabled: f.enabled })
        flagRows = await adminGet<FeatureFlag[]>('/feature-flags')
      }
      let permRows = await adminGet<PermissionRule[]>('/permission-rules')
      if (permRows.length === 0) {
        for (const p of DEFAULT_PERMISSIONS) await adminSend(`/permission-rules/${p.id}`, 'PUT', { action: p.action, description: p.description, allowed: p.allowed })
        permRows = await adminGet<PermissionRule[]>('/permission-rules')
      }
      setFlags(flagRows)
      setPermissions(permRows)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load feature flags & permissions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleToggleFlag = (id: string) => {
    setFlags(prev => prev.map(f => (f.id === id ? { ...f, enabled: !f.enabled } : f)))
  }

  const handleTogglePermission = (id: string) => {
    setPermissions(prev => prev.map(p => (p.id === id ? { ...p, allowed: !p.allowed } : p)))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const savedFlags = await Promise.all(
        flags.map(f => adminSend<FeatureFlag>(`/feature-flags/${f.id}`, 'PUT', { name: f.name, description: f.description, enabled: f.enabled }))
      )
      const savedPerms = await Promise.all(
        permissions.map(p => adminSend<PermissionRule>(`/permission-rules/${p.id}`, 'PUT', { action: p.action, description: p.description, allowed: p.allowed }))
      )
      setFlags(savedFlags)
      setPermissions(savedPerms)
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to save feature flags & permissions.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Helmet><title>System Flags & Rules — LeadPilot Admin</title></Helmet>

      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Feature Flags & Permissions</h1>
            <p className="text-slate-500 text-sm mt-1">Manage global product toggles for future services and default authorization limits for client roles.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex-shrink-0 self-start sm:self-center"
          >
            {saving ? 'Saving Config...' : 'Save Flags & Rules'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800 text-[11px] leading-relaxed">
            These toggles persist to the database and are readable via the API, but nothing in the existing
            AI Manager or campaign flow reads them yet — enforcing them (e.g. actually blocking a "Delete
            Campaigns" action) requires wiring checks into those existing modules, which is a separate change
            from this config surface.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Loading feature flags & permissions…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature Flags */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm">Product Feature Flags</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {flags.map(flag => (
                  <div key={flag.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-800 block">{flag.name}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 leading-relaxed">{flag.description}</span>
                    </div>
                    <button
                      onClick={() => handleToggleFlag(flag.id)}
                      className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                    >
                      {flag.enabled ? (
                        <ToggleRight className="text-blue-600" size={24} />
                      ) : (
                        <ToggleLeft size={24} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* User Permission Rules */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800 text-sm">Client Default Permissions</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {permissions.map(perm => (
                  <div key={perm.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-800 block">{perm.action}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5 leading-relaxed">{perm.description}</span>
                    </div>
                    <button
                      onClick={() => handleTogglePermission(perm.id)}
                      className="text-slate-400 hover:text-slate-600 flex-shrink-0"
                    >
                      {perm.allowed ? (
                        <ToggleRight className="text-blue-600" size={24} />
                      ) : (
                        <ToggleLeft size={24} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
