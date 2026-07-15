import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Search, Download, Phone, Mail, Globe } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'

interface AdminLead {
  id: string
  name: string
  phone: string
  email: string | null
  status: LeadStatus
  campaign_name: string
  client_name: string
  created_at: string
}

type LeadRow = Omit<AdminLead, 'campaign_name' | 'client_name'> & {
  campaigns?: {
    name: string | null
    profiles?: {
      full_name: string | null
    } | null
  } | null
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  contacted: { label: 'Contacted', color: 'text-brand-400 border-brand-500/30 bg-brand-500/10' },
  qualified: { label: 'Qualified', color: 'text-violet-400 border-violet-500/30 bg-violet-500/10' },
  converted: { label: 'Converted', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  lost: { label: 'Lost', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
}

export default function AdminLeads() {
  const [leads, setLeads] = useState<AdminLead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('leads')
        .select('*, campaigns!inner(name, profiles!inner(full_name))')
        .order('created_at', { ascending: false })
        .limit(500)

      setLeads(((data ?? []) as LeadRow[]).map(l => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        status: l.status,
        created_at: l.created_at,
        campaign_name: l.campaigns?.name ?? '—',
        client_name: l.campaigns?.profiles?.full_name ?? '—',
      })))
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = leads.filter(l => {
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    const matchSearch = !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search) ||
      l.client_name.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const exportCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Status', 'Campaign', 'Client', 'Date']
    const rows = filtered.map(l => [
      l.name, l.phone, l.email ?? '', l.status,
      l.campaign_name, l.client_name,
      new Date(l.created_at).toLocaleDateString('en-IN'),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `all-leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Helmet><title>Leads — Admin LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">All Leads</h1>
            <p className="text-slate-400 text-sm mt-1">{leads.length} total leads across all clients</p>
          </div>
          {leads.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white text-sm px-4 py-2.5 rounded-xl transition-all"
            >
              <Download size={15} /> Export CSV
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search leads or clients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-dark-800 border border-white/10 hover:border-white/20 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'new', 'contacted', 'qualified', 'converted', 'lost'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-2 text-xs rounded-xl transition-all capitalize',
                  statusFilter === s ? 'bg-brand-600 text-white' : 'glass text-slate-400 hover:text-white'
                )}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <div key={i} className="h-14 glass rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Globe size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-white font-semibold">No leads found</p>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-white/5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Lead</div>
              <div className="col-span-3 hidden sm:block">Contact</div>
              <div className="col-span-3">Campaign / Client</div>
              <div className="col-span-3">Status / Date</div>
            </div>
            <div className="divide-y divide-white/5">
              {filtered.map(lead => (
                <div key={lead.id} className="grid grid-cols-12 gap-4 px-5 py-4 hover:bg-white/3 transition-all items-center">
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-brand-700/30 flex items-center justify-center text-brand-300 text-xs font-bold flex-shrink-0">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-white text-sm font-medium truncate">{lead.name}</p>
                  </div>
                  <div className="col-span-3 hidden sm:block">
                    <p className="text-slate-300 text-sm flex items-center gap-1.5">
                      <Phone size={11} className="text-slate-500" /> {lead.phone}
                    </p>
                    {lead.email && (
                      <p className="text-slate-500 text-xs flex items-center gap-1.5 mt-0.5">
                        <Mail size={10} /> {lead.email}
                      </p>
                    )}
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-slate-300 text-sm truncate">{lead.campaign_name}</p>
                    <p className="text-slate-600 text-xs truncate">{lead.client_name}</p>
                  </div>
                  <div className="col-span-3">
                    <span className={cn('text-xs px-2.5 py-1 rounded-full border block w-fit mb-1', STATUS_CONFIG[lead.status]?.color)}>
                      {STATUS_CONFIG[lead.status]?.label}
                    </span>
                    <p className="text-slate-600 text-xs">
                      {new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
