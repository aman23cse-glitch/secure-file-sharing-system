import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import FileVault from './components/FileVault';
import TelemetryDashboard from './components/TelemetryDashboard';
import SecurityAuditLog from './components/SecurityAuditLog';
import TamperDemo from './components/TamperDemo';
import ArchitectureInfo from './components/ArchitectureInfo';
import { 
  getAuthToken, 
  setAuthToken, 
  getAuthUser, 
  setAuthUser, 
  getActiveRoute, 
  setActiveRoute 
} from './utils/api';
import { ShieldCheck, Cpu, HardDrive, Zap, Server } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('vault');
  const [currentRoute, setCurrentRoute] = useState(getActiveRoute());
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const savedUser = getAuthUser();
    const token = getAuthToken();
    if (savedUser && token) {
      setUser(savedUser);
    }
    setInitializing(false);
  }, []);

  const handleAuthSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    setAuthToken(null);
    setAuthUser(null);
    setUser(null);
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center text-cyan-400">
        <div className="flex items-center space-x-3">
          <Cpu className="h-6 w-6 animate-spin" />
          <span className="font-mono text-sm font-semibold">Initializing Cryptographic Vault & Edge Node...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      
      {/* Navigation Header */}
      <Navbar 
        user={user} 
        onLogout={handleLogout} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        currentRoute={currentRoute}
        setCurrentRoute={setCurrentRoute}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {!user ? (
          <AuthModal onAuthSuccess={handleAuthSuccess} />
        ) : (
          <div>
            {activeTab === 'vault' && <FileVault user={user} currentRoute={currentRoute} />}
            {activeTab === 'telemetry' && <TelemetryDashboard />}
            {activeTab === 'audits' && <SecurityAuditLog />}
            {activeTab === 'tamper-lab' && <TamperDemo user={user} />}
            {activeTab === 'architecture' && <ArchitectureInfo />}
          </div>
        )}
      </main>

      {/* Persistent Bottom Status Bar */}
      <footer className="border-t border-slate-800/80 bg-[#0a0e17]/80 backdrop-blur-sm py-3 px-4 sm:px-8 text-[11px] text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          
          <div className="flex items-center space-x-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Cloud Core (Port 5000) Active
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
              Edge Gateway (Port 5001) Active
            </span>
          </div>

          <div className="flex items-center space-x-2 font-mono text-slate-500">
            <span>Security: AES-256-GCM + RSA-2048 OAEP + SHA-256 + JWT</span>
          </div>

        </div>
      </footer>

    </div>
  );
}
