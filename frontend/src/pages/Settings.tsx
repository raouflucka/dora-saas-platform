import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Settings as SettingsIcon, User, Lock, Bell, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  
  // Dummy states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-400" />
          Settings & Preferences
        </h1>
        <p className="text-sm text-zinc-400 mt-1">Manage your identity securely across DORA compliance streams.</p>
      </div>

      <div className="flex gap-6">
        {/* Navigation */}
        <div className="w-56 shrink-0 flex flex-col gap-1">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
          >
            <User className="w-4 h-4" /> Profile Info
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
          >
            <Lock className="w-4 h-4" /> Change Password
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
          >
            <Bell className="w-4 h-4" /> Notifications
          </button>
        </div>

        {/* Content Panels */}
        <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          
          {activeTab === 'profile' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-semibold text-white mb-4">Personal Information</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
                  <input type="text" readOnly value={user?.fullName || 'Identity Masked'} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 cursor-not-allowed opacity-70" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Email Address</label>
                  <input type="email" readOnly value={user?.email || 'N/A'} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 cursor-not-allowed opacity-70" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Assigned Role</label>
                  <input type="text" readOnly value={user?.role || 'None'} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-indigo-400 cursor-not-allowed opacity-70 font-semibold uppercase tracking-wider" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-semibold text-white mb-4">Change Password</h2>
              <form onSubmit={handleSave} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Current Password</label>
                  <input type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Enter current password" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">New Password</label>
                  <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Minimum 8 characters" />
                </div>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-md transition-colors mt-2">
                  Update Password
                </button>
                {saved && <p className="text-xs text-emerald-400 flex items-center gap-1 mt-2"><CheckCircle2 className="w-3 h-3"/> Password updated securely</p>}
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-semibold text-white mb-4">Notification Preferences</h2>
              <div className="space-y-3">
                
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center pt-0.5">
                    <input type="checkbox" defaultChecked className="peer sr-only" />
                    <div className="w-5 h-5 border-2 border-zinc-700 rounded bg-zinc-900 transition-colors peer-checked:bg-indigo-500 peer-checked:border-indigo-500"></div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">Risk Triggers & Assignments</span>
                    <p className="text-xs text-zinc-500 mt-0.5">Receive pings when Editors clear flags or Analysts assign errors.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center pt-0.5">
                    <input type="checkbox" defaultChecked className="peer sr-only" />
                    <div className="w-5 h-5 border-2 border-zinc-700 rounded bg-zinc-900 transition-colors peer-checked:bg-indigo-500 peer-checked:border-indigo-500"></div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">Daily DORA Digests</span>
                    <p className="text-xs text-zinc-500 mt-0.5">Morning email summaries breaking down top required fixes.</p>
                  </div>
                </label>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
