import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, CheckCircle2, X } from 'lucide-react'
import { adminGet, adminSend, AdminApiError } from '@/lib/adminApi'

interface Plan {
  id: string
  name: string
  price_monthly: number
  campaign_limit: number
  leads_limit: number
  features: string[]
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState({ name: '', price: '', campaigns: '', leads: '' })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setPlans(await adminGet<Plan[]>('/plans'))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load plans.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.name || !form.price) return
    try {
      const created = await adminSend<Plan>('/plans', 'POST', {
        name: form.name,
        price_monthly: Number(form.price),
        campaign_limit: Number(form.campaigns) || 1,
        leads_limit: Number(form.leads) || 100,
        features: [`${form.campaigns || 1} Active Campaigns`, `${form.leads || 100} Lead exports`, 'AI Manager Engine'],
        active: true,
      })
      setPlans(prev => [...prev, created])
      setShowAddModal(false)
      setForm({ name: '', price: '', campaigns: '', leads: '' })
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to create plan.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this subscription tier?')) return
    try {
      await adminSend(`/plans/${id}`, 'DELETE')
      setPlans(prev => prev.filter(p => p.id !== id))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to delete plan.')
    }
  }

  return (
    <>
      <Helmet><title>Subscription Plans — Admin LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Subscription Plans</h1>
            <p className="text-slate-400 text-sm mt-1">Configure pricing tiers, limits, and product features.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg"
          >
            <Plus size={15} /> Create Plan
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {loading ? (
          <div className="text-sm text-slate-400">Loading plans…</div>
        ) : plans.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-12">No plans yet — create one to get started.</div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {plans.map(p => (
              <div key={p.id} className="glass rounded-2xl p-6 border border-white/5 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{p.id.slice(0, 8)}</p>
                  <h3 className="text-white text-lg font-bold mb-3">{p.name}</h3>
                  <p className="text-3xl font-extrabold text-white mb-6">₹{p.price_monthly.toLocaleString('en-IN')}<span className="text-xs text-slate-500 font-medium">/month</span></p>

                  <ul className="space-y-2 mb-6">
                    {p.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                        <CheckCircle2 size={13} className="text-violet-400" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-white/5 pt-4 flex gap-2">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="flex-1 py-2 border border-red-500/10 hover:bg-red-500/10 text-red-400 text-xs font-semibold rounded-xl transition-all"
                  >
                    Delete Tier
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative glass rounded-3xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
              <h2 className="text-base font-bold text-white">Create Subscription Tier</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white border border-white/10 hover:border-white/20 p-1 rounded-xl"><X size={16} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Plan Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise Tier"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Price (₹) *</label>
                  <input
                    type="number"
                    placeholder="19999"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Campaigns limit</label>
                  <input
                    type="number"
                    placeholder="25"
                    value={form.campaigns}
                    onChange={e => setForm(f => ({ ...f, campaigns: e.target.value }))}
                    className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Leads limit</label>
                  <input
                    type="number"
                    placeholder="10000"
                    value={form.leads}
                    onChange={e => setForm(f => ({ ...f, leads: e.target.value }))}
                    className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 border border-white/10 hover:border-white/20 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name || !form.price}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  Save Tier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
