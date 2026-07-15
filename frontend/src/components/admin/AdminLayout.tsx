import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Megaphone, CreditCard,
  LogOut, Zap, Menu, X, ChevronRight,
  Shield, FileText, CheckCircle2, Layers, Settings,
  Cpu, BookOpen, Code, ShieldCheck, Activity, RefreshCw,
  ArrowLeftRight, ToggleRight, MessageCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/admin/landing-templates', label: 'Landing Templates', icon: FileText },
  { href: '/admin/meta', label: 'Meta Accounts', icon: Shield },
  { href: '/admin/fund-requests', label: 'Fund Requests', icon: CheckCircle2 },
  { href: '/admin/billing', label: 'Billing', icon: CreditCard },
  { href: '/admin/plans', label: 'Plans', icon: Layers },
  { href: '/admin/admins', label: 'Admins', icon: Users },
  { href: '/admin/ai-providers', label: 'AI Providers', icon: Cpu },
  { href: '/admin/model-routing', label: 'Model Routing', icon: ArrowLeftRight },
  { href: '/admin/meta-config', label: 'Meta Config', icon: Settings },
  { href: '/admin/whatsapp-config', label: 'WhatsApp Config', icon: MessageCircle },
  { href: '/admin/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { href: '/admin/prompts', label: 'AI Prompts', icon: Code },
  { href: '/admin/feature-flags', label: 'Feature Flags', icon: ToggleRight },
  { href: '/admin/health', label: 'System Health', icon: Activity },
  { href: '/admin/queue', label: 'Queue Monitor', icon: RefreshCw },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: ShieldCheck },
  { href: '/admin/settings', label: 'System Settings', icon: Settings },
]

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-white" fill="white" />
        </div>
        <div>
          <span className="font-semibold text-slate-800 text-sm">LeadPilot</span>
          <span className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Admin Panel</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => (
          <NavLink
            key={href}
            to={href}
            end={exact}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all border border-transparent',
              isActive
                ? 'bg-blue-50/50 text-blue-600 font-medium border-blue-100/50'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            )}
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Back to dashboard */}
      <div className="px-3 pb-2">
        <NavLink
          to="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all"
        >
          <ChevronRight size={15} className="rotate-180" />
          Back to dashboard
        </NavLink>
      </div>

      {/* User footer */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all group">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 font-semibold truncate">{profile?.full_name ?? 'Admin'}</p>
            <p className="text-xs text-slate-400">Administrator</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-slate-400 hover:text-red-500 transition-colors"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-slate-200 bg-white fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-72 bg-white border-r border-slate-200 z-50">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 flex items-center gap-4 px-4 sm:px-6 h-14 border-b border-slate-200 bg-white">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-slate-400 hover:text-slate-800">
            <Menu size={20} />
          </button>
          <div className="flex-1 flex items-center gap-2 text-sm">
            <Shield size={14} className="text-blue-600" />
            <span className="text-slate-800 font-semibold">Admin Panel</span>
          </div>
          <div className="text-xs text-slate-400 hidden sm:block">
            Logged in as <span className="text-slate-700 font-medium">{profile?.email}</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
