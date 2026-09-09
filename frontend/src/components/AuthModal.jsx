import React, { useState } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  User, 
  Cpu, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Info
} from 'lucide-react';
import { 
  generateRSAKeyPair, 
  savePrivateKeyLocally, 
  getLocalPrivateKey 
} from '../utils/crypto';
import { apiRequest, setAuthToken, setAuthUser } from '../utils/api';

export default function AuthModal({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cryptoStatus, setCryptoStatus] = useState('');
  const [error, setError] = useState('');

  // Quick Demo User Preset Selector
  const selectDemoUser = (name) => {
    setUsername(name);
    setPassword('demo12345');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        setCryptoStatus('Authenticating user identity via JWT token...');
        const res = await apiRequest('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        }, 'CLOUD');

        setAuthToken(res.data.token);
        setAuthUser(res.data.user);

        // Check if private key exists in local storage
        let privKey = getLocalPrivateKey(username);
        if (!privKey) {
          // Auto-generate or restore key for seamless experience if switching devices
          setCryptoStatus('Initializing user RSA-2048 Cryptographic Keystore...');
          const keyPair = await generateRSAKeyPair();
          savePrivateKeyLocally(username, keyPair.privateKeyB64);
        }

        onAuthSuccess(res.data.user);
      } else {
        // Registration Flow with Client-Side RSA Keypair Generation
        setCryptoStatus('1. Generating 2048-bit RSA-OAEP Keypair (Web Crypto API)...');
        await new Promise(r => setTimeout(r, 400));
        const keyPair = await generateRSAKeyPair();

        setCryptoStatus('2. Storing RSA Private Key securely in local device storage...');
        savePrivateKeyLocally(username, keyPair.privateKeyB64);
        await new Promise(r => setTimeout(r, 300));

        setCryptoStatus('3. Registering RSA Public Key with Cloud Authentication Vault...');
        const res = await apiRequest('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password,
            rsaPublicKey: keyPair.publicKeyB64
          })
        }, 'CLOUD');

        setAuthToken(res.data.token);
        setAuthUser(res.data.user);
        onAuthSuccess(res.data.user);
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
      setCryptoStatus('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#0d131f] border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden">
        
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-400 mb-3 shadow-lg shadow-cyan-500/10">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isLogin ? 'Welcome Back' : 'Create Secure Identity'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isLogin 
              ? 'Sign in to access your encrypted files and Edge gateway' 
              : 'Generates client-side RSA-2048 keypair & registers public key'}
          </p>
        </div>

        {/* Quick Demo Selector */}
        <div className="mb-5 p-3 rounded-xl bg-slate-900/80 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="flex items-center gap-1 font-semibold text-cyan-400">
              <Sparkles className="h-3.5 w-3.5" /> Quick Demo Accounts:
            </span>
            <span className="text-[10px] text-slate-500">Auto-fills credentials</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['alice', 'bob', 'charlie'].map(demoName => (
              <button
                key={demoName}
                type="button"
                onClick={() => selectDemoUser(demoName)}
                className="py-1.5 px-2 text-xs font-mono font-medium rounded-lg bg-slate-800 hover:bg-cyan-950/60 hover:text-cyan-300 hover:border-cyan-700/50 border border-slate-700 text-slate-300 transition-all text-center"
              >
                @{demoName}
              </button>
            ))}
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/50 border border-red-800/50 flex items-start space-x-2 text-red-300 text-xs">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. alice, bob, or user1"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
              />
            </div>
          </div>

          {/* Cryptography / Key generation live indicator */}
          {loading && cryptoStatus && (
            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs space-y-1">
              <div className="flex items-center space-x-2 font-mono">
                <Cpu className="h-4 w-4 animate-spin text-cyan-400" />
                <span>{cryptoStatus}</span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            <span>{isLogin ? 'Sign In to Platform' : 'Generate Keypair & Register'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
          >
            {isLogin ? (
              <span>Don't have an account? <strong className="text-cyan-400 underline ml-1">Register New User</strong></span>
            ) : (
              <span>Already registered? <strong className="text-cyan-400 underline ml-1">Sign In</strong></span>
            )}
          </button>
        </div>

        {/* Security Note */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <KeyRound className="h-3 w-3 text-cyan-500" />
          <span>Zero-Knowledge End-to-End Cryptography</span>
        </div>

      </div>
    </div>
  );
}
