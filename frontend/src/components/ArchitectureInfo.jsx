import React from 'react';
import { 
  ShieldCheck, 
  Cloud, 
  Cpu, 
  KeyRound, 
  Lock, 
  Hash, 
  Zap, 
  Users, 
  CheckCircle2, 
  Layers, 
  Server,
  ArrowRight
} from 'lucide-react';

export default function ArchitectureInfo() {
  const pillars = [
    {
      title: '1. Hybrid Cryptography (AES-256 + RSA-2048)',
      icon: Lock,
      color: 'cyan',
      description: 'Combines the blazing throughput of symmetric AES-256-GCM for bulk file payload encryption with the asymmetric public-key security of RSA-2048 OAEP for secure session key exchange.'
    },
    {
      title: '2. Cloud & Edge Role Synergy',
      icon: Zap,
      color: 'emerald',
      description: 'Cloud Server acts as the centralized persistent metadata & storage hub. Edge Nodes act as proximity caches and cryptographic gateways, reducing WAN latency and optimizing bandwidth.'
    },
    {
      title: '3. Cryptographic Access Control (ACL)',
      icon: KeyRound,
      color: 'indigo',
      description: 'Zero-knowledge key encapsulation: To share a file, the owner re-encrypts the AES session key with the recipient user’s RSA public key. The server never sees plaintext keys.'
    },
    {
      title: '4. SHA-256 Integrity Verification',
      icon: Hash,
      color: 'purple',
      description: 'Cryptographic SHA-256 digests and AES-GCM authentication tags guarantee that unauthorized bit modifications or tampering in storage/transit are immediately detected and rejected.'
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="p-5 rounded-2xl bg-[#0d131f] border border-slate-800 space-y-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-cyan-400" />
          System Architecture & Cryptographic Workflow
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          Comprehensive overview of the Cloud-Edge hybrid secure file sharing framework implemented in this platform based on the research abstract.
        </p>
      </div>

      {/* 4 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pillars.map((pillar, idx) => {
          const Icon = pillar.icon;
          return (
            <div key={idx} className="p-5 rounded-2xl bg-[#0d131f] border border-slate-800 space-y-2.5 hover:border-cyan-500/30 transition-all">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-white">{pillar.title}</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {pillar.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Step-by-Step Flow Diagrams */}
      <div className="p-6 rounded-2xl bg-[#0d131f] border border-slate-800 space-y-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="h-5 w-5 text-indigo-400" />
          End-to-End Cryptographic & Data Pipeline
        </h3>

        {/* Step 1: Upload */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">A. Secure Upload Pipeline</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">Client-Side Zero Knowledge</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">1. Hash Compute</p>
              <p className="text-[10px] text-slate-400 mt-1">SHA-256 digest of original plaintext</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">2. AES Encrypt</p>
              <p className="text-[10px] text-slate-400 mt-1">Generate 256-bit key & 96-bit IV</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">3. RSA Key Wrap</p>
              <p className="text-[10px] text-slate-400 mt-1">Encrypt AES key with user's RSA Public Key</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">4. Vault Storage</p>
              <p className="text-[10px] text-slate-400 mt-1">Store ciphertext & wrapped keys in Cloud</p>
            </div>
          </div>
        </div>

        {/* Step 2: Sharing */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">B. Granular Multi-User Sharing</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono">Asymmetric Key Wrapping</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">1. Key Retrieval</p>
              <p className="text-[10px] text-slate-400 mt-1">Owner unwraps AES key with owner RSA private key</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">2. Recipient Key</p>
              <p className="text-[10px] text-slate-400 mt-1">Fetch recipient's registered RSA Public Key</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">3. Re-Encryption</p>
              <p className="text-[10px] text-slate-400 mt-1">Encrypt AES key with recipient's Public Key</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">4. ACL Grant</p>
              <p className="text-[10px] text-slate-400 mt-1">Store recipient's wrapped key & permissions</p>
            </div>
          </div>
        </div>

        {/* Step 3: Edge Download */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">C. Edge-Accelerated Download & Verification</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">Low-Latency + Integrity Check</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">1. Edge Proximity</p>
              <p className="text-[10px] text-slate-400 mt-1">Check local Edge Cache (Hit in &lt;10ms)</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">2. Key Unwrap</p>
              <p className="text-[10px] text-slate-400 mt-1">Decrypt AES key with user's RSA Private Key</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">3. AES Decrypt</p>
              <p className="text-[10px] text-slate-400 mt-1">Decrypt ciphertext using AES-256-GCM</p>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/80">
              <p className="font-semibold text-white">4. Hash Match</p>
              <p className="text-[10px] text-slate-400 mt-1">Verify SHA-256 checksum before file save</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
