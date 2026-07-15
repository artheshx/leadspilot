import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, Shield, Trash2, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminGet, adminSend, AdminApiError } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'

interface AdminRole {
  id: string
  name: string
  email: string
  admin_role: 'super_admin' | 'support' | 'billing'
}

interface AdminProfile { id: string; full_name: string; email: string }

export default function AdminAdmins() {
  const [admins, setAdmins] = useState<AdminRole[]>([])
  const [eligibleProfiles, setEligibleProfiles] = useState<AdminProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [form, setForm] = useState<{ profileId: string; role: AdminRole['admin_role'] }>({ profileId: '', role: 'support' })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [roleRows, profileRows] = await Promise.all([
        adminGet<AdminRole[]>('/admins'),
        supabase.from('profiles').select('id, full_name, email').eq('role', 'admin').order('full_name'),
      ])
      setAdmins(roleRows)
      setEligibleProfiles((profileRows.data ?? []) as AdminProfile[])
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to load administrators.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const unassignedProfiles = eligibleProfiles.filter(p => !admins.some(a => a.id === p.id))

  const handleCreate = async () => {
    const profile = eligibleProfiles.find(p => p.id === form.profileId)
    if (!profile) return
    try {
      const saved = await adminSend<AdminRole>(`/admins/${profile.id}`, 'PUT', {
        id: profile.id, name: profile.full_name, email: profile.email, admin_role: form.role,
      })
      setAdmins(prev => [...prev.filter(a => a.id !== saved.id), saved])
      setShowAddModal(false)
      setForm({ profileId: '', role: 'support' })
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to assign admin role.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('De-authorize this admin account?')) return
    try {
      await adminSend(`/admins/${id}`, 'DELETE')
      setAdmins(prev => prev.filter(a => a.id !== id))
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Failed to remove admin role.')
    }
  }

  return (
    <>
      <Helmet><title>Administrative Accounts — Admin LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Administrators</h1>
            <p className="text-slate-400 text-sm mt-1">Manage and delegate support or operations roles for operators.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={unassignedProfiles.length === 0}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg"
          >
            <Plus size={15} /> Assign Admin Role
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 flex items-start gap-2.5">
          <Info size={14} className="text-violet-400 flex-shrink-0 mt-0.5" />
          <p className="text-slate-300 text-[11px] leading-relaxed">
            This assigns a CRM sub-role (Super Admin / Support / Billing) to an existing account that already
            has <code>profiles.role = 'admin'</code> — it does not create new login credentials. Promoting a
            user to <code>admin</code> in the first place is still done directly in Supabase (Table Editor or
            SQL), since that's an auth-level change outside the Admin CRM's scope.
          </p>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400">Loading administrators…</div>
        ) : (
          <div className="glass rounded-2xl border border-white/5 overflow-hidden shadow-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-slate-400 text-xs font-semibold uppercase">
                  <th className="p-4">Administrator details</th>
                  <th className="p-4">Operational Role</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {admins.length === 0 ? (
                  <tr><td colSpan={3} className="p-8 text-center text-slate-400 text-xs">No CRM sub-roles assigned yet.</td></tr>
                ) : admins.map(adm => (
                  <tr key={adm.id} className="hover:bg-white/[0.01] transition-all">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-600/10 flex items-center justify-center text-violet-400 text-xs font-bold uppercase">
                          {adm.name.charAt(0) || '?'}
                        </div>
                        <div>
                          <span className="text-white font-semibold block text-sm">{adm.name}</span>
                          <span className="text-xs text-slate-500">{adm.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                        adm.admin_role === 'super_admin' ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' :
                        adm.admin_role === 'support' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      )}>
                        <Shield size={10} />
                        {adm.admin_role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(adm.id)}
                        className="p-1.5 border border-red-500/10 hover:bg-red-500/10 text-red-400 rounded-lg transition-all"
                        title="Revoke CRM role"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative glass rounded-3xl p-6 w-full max-w-md border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
              <h2 className="text-base font-bold text-white">Assign Admin Role</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white border border-white/10 hover:border-white/20 p-1 rounded-xl"><X size={16} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Admin Account *</label>
                <select
                  value={form.profileId}
                  onChange={e => setForm(f => ({ ...f, profileId: e.target.value }))}
                  className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none cursor-pointer"
                >
                  <option value="">Select an existing admin account…</option>
                  {unassignedProfiles.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Role Permission *</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as AdminRole['admin_role'] }))}
                  className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none cursor-pointer"
                >
                  <option value="super_admin">Super Administrator (All permissions)</option>
                  <option value="support">Customer Support Agent</option>
                  <option value="billing">Billing & Finance Officer</option>
                </select>
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
                  disabled={!form.profileId}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
