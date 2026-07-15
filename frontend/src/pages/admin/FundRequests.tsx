import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { CheckCircle2, ArrowDownCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface FundRequest {
  id: string
  user_id: string
  amount: number
  type: string
  status: 'pending' | 'confirmed' | 'failed'
  note: string | null
  created_at: string
  profiles?: {
    full_name: string
    email: string
  }
}

export default function AdminFundRequests() {
  const [requests, setRequests] = useState<FundRequest[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = async () => {
    // Fetch pending and other topup requests
    const { data } = await supabase
      .from('transactions')
      .select('*, profiles:user_id(full_name, email)')
      .eq('type', 'add_funds')
      .order('created_at', { ascending: false })
    
    setRequests((data as unknown as FundRequest[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleUpdateStatus = async (id: string, newStatus: 'confirmed' | 'failed') => {
    const { error } = await supabase
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
    }
  }

  return (
    <>
      <Helmet><title>Ad Wallet Fund Requests — Admin LeadPilot</title></Helmet>

      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Wallet Fund Requests</h1>
          <p className="text-slate-400 text-sm mt-1">Audit, reject, and approve client top-up queries and payment confirmations.</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 glass rounded-2xl animate-pulse" />)}
          </div>
        ) : requests.length === 0 ? (
          <div className="glass rounded-2xl p-16 text-center border border-white/5">
            <CheckCircle2 size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">No topup requests</p>
            <p className="text-slate-500 text-sm">When clients request campaign funding, details appear here.</p>
          </div>
        ) : (
          <div className="glass rounded-2xl overflow-hidden border border-white/5 divide-y divide-white/5">
            {requests.map(req => {
              const clientName = req.profiles?.full_name ?? 'Client'
              const clientEmail = req.profiles?.email ?? '—'
              const isPending = req.status === 'pending'
              return (
                <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-white/[0.01] transition-all">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ArrowDownCircle size={18} className="text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-white font-semibold text-sm">₹{req.amount.toLocaleString('en-IN')}</span>
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                          req.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                          req.status === 'confirmed' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                          'bg-red-500/10 border-red-500/20 text-red-400'
                        )}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-semibold">{clientName} &middot; <span className="text-slate-500">{clientEmail}</span></p>
                      <p className="text-[11px] text-slate-500 mt-2 italic">{req.note ?? 'No payload receipts uploaded'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 sm:self-center flex-shrink-0">
                    {isPending ? (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'failed')}
                          className="px-3.5 py-2 border border-red-500/20 hover:bg-red-500/10 text-red-400 text-xs font-semibold rounded-xl transition-all"
                        >
                          Decline Request
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'confirmed')}
                          className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md"
                        >
                          Approve & Provision
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Processed</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
