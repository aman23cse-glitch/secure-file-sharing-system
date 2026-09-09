import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  KeyRound, 
  Share2, 
  Upload, 
  Download, 
  Trash2, 
  Filter, 
  RefreshCw,
  Zap,
  Cloud
} from 'lucide-react';
import { apiRequest } from '../utils/api';

export default function SecurityAuditLog() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/audit-logs');
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type) => {
    switch (type) {
      case 'FILE_UPLOAD': return <Upload className="h-4 w-4 text-cyan-400" />;
      case 'FILE_DOWNLOAD': return <Download className="h-4 w-4 text-emerald-400" />;
      case 'FILE_SHARE': return <Share2 className="h-4 w-4 text-indigo-400" />;
      case 'ACCESS_REVOKED': return <Trash2 className="h-4 w-4 text-amber-400" />;
      case 'FILE_DELETE': return <Trash2 className="h-4 w-4 text-red-400" />;
      case 'USER_REGISTER': 
      case 'USER_LOGIN': return <KeyRound className="h-4 w-4 text-purple-400" />;
      case 'UNAUTHORIZED_ACCESS':
      case 'UNAUTHORIZED_DOWNLOAD':
      case 'FILE_TAMPER_SIMULATED': return <ShieldAlert className="h-4 w-4 text-red-400" />;
      default: return <FileText className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-bold">SUCCESS</span>;
      case 'WARNING':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/50 font-bold">WARNING</span>;
      case 'BLOCKED':
      case 'FAILED':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800/50 font-bold">BLOCKED</span>;
      default:
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">{status}</span>;
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    if (filter === 'SECURITY') return ['UNAUTHORIZED_ACCESS', 'UNAUTHORIZED_DOWNLOAD', 'FILE_TAMPER_SIMULATED', 'LOGIN_FAILED'].includes(log.eventType);
    if (filter === 'FILES') return ['FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE'].includes(log.eventType);
    if (filter === 'SHARING') return ['FILE_SHARE', 'ACCESS_REVOKED'].includes(log.eventType);
    if (filter === 'AUTH') return ['USER_REGISTER', 'USER_LOGIN', 'LOGIN_FAILED'].includes(log.eventType);
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0d131f] border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-400" />
            Security & Cryptographic Audit Logs
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable tamper-evident audit record tracking all authentication, file encryptions, shares, and edge transfers.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filters */}
          <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            {['ALL', 'SECURITY', 'FILES', 'SHARING', 'AUTH'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filter === f
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title="Refresh Logs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Stream */}
      <div className="bg-[#0d131f] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Loading security audit entries...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No audit logs found for the selected filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredLogs.map(log => (
              <div key={log.id} className="p-4 hover:bg-slate-900/40 transition-colors space-y-2">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                      {getEventIcon(log.eventType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{log.eventType}</span>
                        {getStatusBadge(log.status)}
                        {log.route && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono flex items-center gap-1">
                            {log.route.includes('EDGE') ? <Zap className="h-2.5 w-2.5 text-emerald-400" /> : <Cloud className="h-2.5 w-2.5 text-indigo-400" />}
                            {log.route}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Actor: <strong className="text-slate-200">@{log.username}</strong> ({log.userId}) • IP: <span className="font-mono">{log.ip}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Details snippet */}
                {log.details && (
                  <div className="pl-11">
                    <p className="text-xs text-slate-300 bg-slate-900/80 border border-slate-800/80 rounded-xl p-2.5 font-mono text-[11px] leading-relaxed">
                      {log.details}
                    </p>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
