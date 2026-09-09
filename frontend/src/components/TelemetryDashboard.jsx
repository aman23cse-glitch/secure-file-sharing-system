import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Zap, 
  Cloud, 
  HardDrive, 
  TrendingUp, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  Gauge, 
  Layers,
  ArrowDownUp,
  Server
} from 'lucide-react';
import { apiRequest, CLOUD_BASE_URL, EDGE_BASE_URL } from '../utils/api';

export default function TelemetryDashboard() {
  const [edgeData, setEdgeData] = useState(null);
  const [cloudData, setCloudData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState(null);
  const [clearMessage, setClearMessage] = useState('');

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000); // Live poll every 3s
    return () => clearInterval(interval);
  }, []);

  const fetchTelemetry = async () => {
    try {
      // Fetch Edge Telemetry
      const edgeRes = await fetch(`${EDGE_BASE_URL}/api/edge/telemetry`);
      if (edgeRes.ok) {
        const data = await edgeRes.json();
        setEdgeData(data);
      }

      // Fetch Cloud Metrics
      const cloudRes = await apiRequest('/api/metrics', { method: 'GET' }, 'CLOUD');
      setCloudData(cloudRes.data);
    } catch (err) {
      console.error('Failed to fetch telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearEdgeCache = async () => {
    try {
      const res = await fetch(`${EDGE_BASE_URL}/api/edge/cache/clear`, { method: 'POST' });
      const data = await res.json();
      setClearMessage(data.message);
      fetchTelemetry();
      setTimeout(() => setClearMessage(''), 4000);
    } catch (err) {
      console.error('Error clearing edge cache:', err);
    }
  };

  const runLiveBenchmark = async () => {
    setBenchmarking(true);
    setBenchmarkResults(null);

    try {
      // Step 1: Benchmark Direct Cloud
      const cloudStart = performance.now();
      await fetch(`${CLOUD_BASE_URL}/health?nocache=${Date.now()}`);
      const cloudLatency = Math.round(performance.now() - cloudStart);

      // Step 2: Benchmark Edge Node
      const edgeStart = performance.now();
      await fetch(`${EDGE_BASE_URL}/api/edge/telemetry?nocache=${Date.now()}`);
      const edgeLatency = Math.round(performance.now() - edgeStart);

      const speedup = cloudLatency > 0 ? (cloudLatency / Math.max(edgeLatency, 1)).toFixed(1) : 1;

      setBenchmarkResults({
        cloudLatency,
        edgeLatency,
        speedup: speedup > 1 ? `${speedup}x Faster` : 'Parity'
      });
    } catch (err) {
      console.error('Benchmark error:', err);
    } finally {
      setBenchmarking(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#0d131f] border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Edge vs. Cloud Telemetry & Latency Engine
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time analytics demonstrating WAN offloading, edge cache hit efficiency, and response acceleration.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={runLiveBenchmark}
            disabled={benchmarking}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            <Gauge className={`h-4 w-4 ${benchmarking ? 'animate-spin' : ''}`} />
            <span>{benchmarking ? 'Benchmarking...' : 'Run Live Latency Test'}</span>
          </button>

          <button
            onClick={handleClearEdgeCache}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            title="Purge Edge Node Local Storage"
          >
            <Trash2 className="h-4 w-4 text-red-400" />
            <span>Purge Edge Cache</span>
          </button>
        </div>
      </div>

      {clearMessage && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{clearMessage}</span>
        </div>
      )}

      {/* Benchmark Banner */}
      {benchmarkResults && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-cyan-950/70 border border-emerald-500/30 shadow-2xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Zap className="h-4 w-4" /> Live Node Latency Benchmark Results
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
              {benchmarkResults.speedup}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Edge Metric */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30">
              <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <Zap className="h-3.5 w-3.5" /> Edge Gateway (Port 5001)
                </span>
                <span className="font-mono text-emerald-300 font-bold text-sm">{benchmarkResults.edgeLatency} ms</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-400 h-2 rounded-full" 
                  style={{ width: `${Math.max(10, 100 - benchmarkResults.edgeLatency)}%` }} 
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Direct local proximity processing & cached chunk dispatch</p>
            </div>

            {/* Cloud Metric */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-indigo-500/30">
              <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                <span className="flex items-center gap-1 text-indigo-400 font-semibold">
                  <Cloud className="h-3.5 w-3.5" /> Central Cloud Hub (Port 5000)
                </span>
                <span className="font-mono text-indigo-300 font-bold text-sm">{benchmarkResults.cloudLatency} ms</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-indigo-400 h-2 rounded-full" 
                  style={{ width: `${Math.max(10, 100 - benchmarkResults.cloudLatency)}%` }} 
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Centralized cloud transit, database queries & authoritative storage</p>
            </div>
          </div>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Hit Ratio */}
        <div className="p-4 rounded-2xl bg-[#0d131f] border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Cache Hit Ratio</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Gauge className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {edgeData ? `${edgeData.hitRatioPercentage}%` : '0.0%'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Hits: <strong className="text-emerald-400">{edgeData?.cacheHits || 0}</strong> | Misses: <strong className="text-amber-400">{edgeData?.cacheMisses || 0}</strong>
          </p>
        </div>

        {/* Bandwidth Served at Edge */}
        <div className="p-4 rounded-2xl bg-[#0d131f] border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Edge Bandwidth Saved</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-mono">
            {formatBytes(edgeData?.bandwidthServedFromEdgeBytes || 0)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Served locally without WAN transit
          </p>
        </div>

        {/* Cached Chunks in Edge Storage */}
        <div className="p-4 rounded-2xl bg-[#0d131f] border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Edge Cache Storage</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <HardDrive className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-300 font-mono">
            {edgeData?.cachedFilesCount || 0} Files
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Encrypted blobs in local perimeter cache
          </p>
        </div>

        {/* Cloud Authoritative Files */}
        <div className="p-4 rounded-2xl bg-[#0d131f] border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Cloud Storage Pool</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Cloud className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-300 font-mono">
            {cloudData?.totalFiles || 0} Files
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Total Vault Chunks ({formatBytes(cloudData?.bytesTransferred || 0)} sent)
          </p>
        </div>

      </div>

      {/* Edge Cache Contents Table & Real-time Request Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Active Edge Cache Table */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              Active Edge Node Cached Blobs
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Port 5001</span>
          </div>

          {edgeData?.cachedFiles && edgeData.cachedFiles.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {edgeData.cachedFiles.map(file => (
                <div
                  key={file.filename}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
                >
                  <div className="truncate max-w-[200px]">
                    <p className="font-mono font-medium text-slate-200 truncate">{file.filename}</p>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5" /> Fast Edge Cache Resident
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-slate-300">{formatBytes(file.sizeBytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">
              <HardDrive className="h-6 w-6 mx-auto text-slate-600 mb-1" />
              <span>Edge cache is currently empty. Download a file to populate cache.</span>
            </div>
          )}
        </div>

        {/* Recent Edge Latency Records */}
        <div className="bg-[#0d131f] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              Edge Transaction Telemetry Log
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Live Stream</span>
          </div>

          {edgeData?.recentLatencyLogs && edgeData.recentLatencyLogs.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {edgeData.recentLatencyLogs.map((log, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                        log.route === 'EDGE_CACHE_HIT'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                      }`}>
                        {log.route === 'EDGE_CACHE_HIT' ? 'CACHE HIT' : 'CACHE MISS (CLOUD FETCH)'}
                      </span>
                      <span className="font-medium text-slate-300 truncate max-w-[140px]">{log.fileName}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()} • {formatBytes(log.sizeBytes)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-cyan-400 font-bold">{log.latencyMs} ms</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">
              <Activity className="h-6 w-6 mx-auto text-slate-600 mb-1" />
              <span>No edge transactions logged yet. Perform a file download to see real-time speed.</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
