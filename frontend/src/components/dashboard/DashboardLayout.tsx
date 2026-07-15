import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FileText, Image,
  CreditCard, Settings, LogOut, Zap, Menu, X,
  ChevronRight, Shield, MessageSquare, Facebook
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'

const navItems = [
  { section: 'Workspace', items: [
    { href: '/dashboard', label: 'AI Chat', icon: MessageSquare, exact: true },
    { href: '/dashboard/monitor', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/landing-pages', label: 'Landing Pages', icon: FileText },
    { href: '/dashboard/creatives', label: 'Creatives', icon: Image },
  ]},
  { section: 'Account', items: [
    { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
    { href: '/dashboard/meta-account', label: 'Meta Account', icon: Facebook },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ]},
]

export default function DashboardLayout() {
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
        <span className="font-semibold text-slate-800 text-sm">LeadPilot</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navItems.map(({ section, items }) => (
          <div key={section}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">{section}</p>
            <ul className="space-y-0.5">
              {items.map(({ href, label, icon: Icon, exact }) => (
                <li key={href}>
                  <NavLink
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
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Admin link */}
        {profile?.role === 'admin' && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">Admin</p>
            <NavLink
              to="/admin"
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all border border-transparent',
                isActive
                  ? 'bg-blue-50/50 text-blue-600 font-medium border-blue-100/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              )}
            >
              <Shield size={15} />
              Admin Panel
            </NavLink>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all group">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-800 font-semibold truncate">{profile?.full_name ?? 'User'}</p>
            <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
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

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-72 bg-white border-r border-slate-200 z-50">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center gap-4 px-4 sm:px-6 h-14 border-b border-slate-200 bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-slate-400 hover:text-slate-800"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-slate-400 flex-1">
            <span>LeadPilot</span>
            <ChevronRight size={14} />
            <span className="text-slate-800 font-semibold capitalize">
              Dashboard
            </span>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              All systems normal
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
