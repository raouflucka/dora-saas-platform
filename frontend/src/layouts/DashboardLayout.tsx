import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { notificationsApi, type Notification } from '../api/notifications';
import {
  Building2,
  Server,
  FileText,
  Activity,
  ShieldAlert,
  Settings,
  LogOut as LogOutIcon,
  Menu,
  X,
  Globe,
  Search,
  Bell,
  BarChart3,
  GitBranch,
  ShieldCheck,
  Cloud,
  DoorOpen,
  FileSpreadsheet,
} from 'lucide-react';

export default function DashboardLayout() {
  const { logout, user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationsApi.getUnread,
    refetchInterval: 30000 // Poll every 30s
  });

  const markReadMut = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
  });

  const markAllReadMut = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] })
  });

  const ALL_ROLES = ['ADMIN', 'ANALYST', 'EDITOR'];

  const allNavigation = [
    // ── Shared ──────────────────────────────────────────────────────
    { name: t('Dashboard'), href: '/', icon: Activity, roles: ALL_ROLES, section: 'workspace' },
    // ── Admin Data ──────────────────────────────────────────────────
    { name: t('Financial Entities'), href: '/entities', icon: Building2, roles: ['ADMIN'], section: 'data' },
    // ── Editor Forms ────────────────────────────────────────────────
    { name: t('ICT Providers'), href: '/providers', icon: Server, roles: ['EDITOR'], section: 'data' },
    { name: t('ICT Services'), href: '/ict-services', icon: Cloud, roles: ['EDITOR'], section: 'data' },
    { name: t('Business Functions'), href: '/functions', icon: BarChart3, roles: ['ANALYST'], section: 'data' },
    // ── Shared Forms (Editor: Entry, Analyst: Read) ─────────────────
    { name: t('Contractual Arrangements'), href: '/contracts', icon: FileText, roles: ['EDITOR', 'ANALYST'], section: 'data' },
    // ── Analyst Compliance & Logic ──────────────────────────────────
    { name: t('Validation Dashboard'), href: '/validation', icon: ShieldCheck, roles: ['ANALYST'], section: 'compliance' },
    { name: t('Risk Assessments'), href: '/assessments', icon: ShieldAlert, roles: ['ANALYST'], section: 'compliance' },
    { name: t('Supply Chain'), href: '/supply-chain', icon: GitBranch, roles: ['ANALYST'], section: 'compliance' },
    // Exit Strategies (Usually tied to assessments/contracts: Editor drives data)
    { name: t('Exit Strategies'), href: '/exit-strategies', icon: DoorOpen, roles: ['EDITOR', 'ANALYST'], section: 'data' },
    // ── Admin only ──────────────────────────────────────────────────
    { name: t('Users Management'), href: '/admin', icon: ShieldCheck, roles: ['ADMIN'], section: 'admin' },
    { name: t('RoI Export'), href: '/roi-export', icon: FileSpreadsheet, roles: ['ADMIN'], section: 'admin' },
    { name: t('Settings'), href: '/settings', icon: Settings, roles: ['ADMIN'], section: 'workspace' },
  ];

  const navigation = allNavigation.filter((item) => user?.role && item.roles.includes(user.role));

  const currentNav = navigation.find((item) => item.href === location.pathname) || navigation[0];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden text-zinc-100 font-sans selection:bg-indigo-500/30">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" />
        </div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-zinc-950 flex flex-col border-r border-zinc-800/60
        transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600/10 border border-indigo-500/20 shadow-inner">
              <ShieldAlert className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white drop-shadow-sm">DORA Hub</span>
          </div>
          <button className="lg:hidden text-zinc-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          {/* Role Badge */}
          <div className={`mb-3 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest w-fit border ${
            user?.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
            user?.role === 'EDITOR' ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20' :
            'bg-zinc-800 text-zinc-400 border-zinc-700'
          }`}>
            {user?.role === 'EDITOR' ? 'Editor' : user?.role === 'ANALYST' ? 'Analyst' : 'Admin'}
          </div>
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={`
                      flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                      ${isActive 
                        ? 'bg-zinc-800/60 text-white shadow-sm ring-1 ring-zinc-700/50' 
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30'
                      }
                    `}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <item.icon className={`h-5 w-5 mr-3 shrink-0 transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User Profile & Footer */}
        <div className="p-4 shrink-0 border-t border-zinc-800/60">

          
          <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 mb-3">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0 ${user?.role === 'ADMIN' ? 'bg-gradient-to-br from-amber-500 to-amber-700' : 'bg-gradient-to-br from-indigo-600 to-indigo-800'}`}>
              {user?.fullName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wide">{user?.role}</p>
              <p className="text-sm font-medium text-white truncate">{user?.fullName || user?.email}</p>
            </div>
            <button onClick={handleLogout} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors border border-transparent hover:border-red-400/20" title="Log out">
              <LogOutIcon className="h-4 w-4" />
            </button>
          </div>
          
          <button 
            onClick={handleLogout}
            className="hidden flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOutIcon className="h-4 w-4 mr-2" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
        
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-8 shrink-0 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60 z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-zinc-400 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="text-lg font-semibold text-zinc-100 hidden sm:block">
              {currentNav.name}
            </h2>
          </div>

          <div className="flex items-center gap-4 flex-1 justify-end lg:gap-6">
            
            {/* Top-Right Highly Visible Admin Badge */}
            {user?.role === 'ADMIN' && (
              <div className="hidden sm:flex items-center gap-1.5 bg-amber-500 text-amber-950 px-3 py-1 rounded-md shadow-sm border border-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Admin View</span>
              </div>
            )}

            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`p-2 transition-colors rounded-full ${isNotifOpen ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500 ring-2 ring-zinc-950"></span>
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <h3 className="text-sm font-semibold text-white">Notifications</h3>
                    {notifications.length > 0 && (
                      <button 
                        onClick={() => markAllReadMut.mutate()}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-zinc-500 text-sm">
                        You're all caught up.
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {notifications.map((n: Notification) => (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              markReadMut.mutate(n.id);
                              if (n.link) {
                                navigate(n.link);
                                setIsNotifOpen(false);
                              }
                            }}
                            className="p-3 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors cursor-pointer last:border-0"
                          >
                            <p className="text-sm font-medium text-zinc-200">{n.title}</p>
                            <p className="text-xs text-zinc-400 mt-1 leading-snug">{n.message}</p>
                            <p className="text-[10px] text-zinc-600 mt-2">
                              {new Date(n.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 relative">
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
               style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '40px 40px' }} 
          />
          <div className="relative z-10 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>

    </div>
  );
}
