import React from 'react';
import { 
  ShieldCheck, 
  Cloud, 
  Cpu, 
  FolderLock, 
  Activity, 
  FileText, 
  AlertTriangle, 
  BookOpen, 
  LogOut, 
  User,
  KeyRound,
  Zap
} from 'lucide-react';
import { getActiveRoute, setActiveRoute } from '../utils/api';

export default function Navbar({ 
  user, 
  onLogout, 
  activeTab, 
  setActiveTab,
  currentRoute,
  setCurrentRoute
}) {
  const toggleRoute = () => {
    const nextRoute = currentRoute === 'EDGE' ? 'CLOUD' : 'EDGE';
    setActiveRoute(nextRoute);
    setCurrentRoute(nextRoute);
  };

  const navTabs = [
    { id: 'vault', label: 'File Vault', icon: FolderLock },
    { id: 'telemetry', label: 'Edge Telemetry & Speed', icon: Activity },
    { id: 'audits', label: 'Security Audit Logs', icon: FileText },
    { id: 'tamper-lab', label: 'Integrity Defense Lab', icon: AlertTriangle },
    { id: 'architecture', label: 'System Architecture', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-[#0a0e17]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <div className="h-full w-full bg-[#0a0e17] rounded-[10px] flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-cyan-400 bg-clip-text text-transparent">
                CloudEdge SecureShare
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 font-mono">
                AES-256 + RSA-OAEP
              </span>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            {navTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Route Switcher & User Profile */}
          <div className="flex items-center space-x-3">
            {/* Route Selector (Edge vs Cloud) */}
            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1">
              <button
                onClick={toggleRoute}
                title="Toggle between localized Edge Gateway and direct Cloud routing"
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  currentRoute === 'EDGE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                    : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-sm shadow-indigo-500/20'
                }`}
              >
                {currentRoute === 'EDGE' ? (
                  <>
                    <Zap className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                    <span>Edge Node (Port 5001)</span>
                  </>
                ) : (
                  <>
                    <Cloud className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Cloud Direct (Port 5000)</span>
                  </>
                )}
              </button>
            </div>

            {/* User Badge */}
            {user ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                <div className="flex items-center space-x-2 text-sm text-slate-300">
                  <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-semibold text-slate-200 leading-tight">{user.username}</p>
                    <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <KeyRound className="h-2.5 w-2.5 text-cyan-400" /> RSA-2048 Ready
                    </p>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="flex md:hidden overflow-x-auto space-x-1 py-2 border-t border-slate-800/60">
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium ${
                  isActive 
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

      </div>
    </header>
  );
}
