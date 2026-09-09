import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Bug, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  FileCheck, 
  ArrowRight, 
  Cpu, 
  Hash, 
  RefreshCw,
  Zap,
  Play
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import { 
  decryptFilePayload, 
  importRSAPrivateKey, 
  getLocalPrivateKey 
} from '../utils/crypto';

export default function TamperDemo({ user }) {
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [tampering, setTampering] = useState(false);
  const [tamperSuccess, setTamperSuccess] = useState(null);
  const [testingIntegrity, setTestingIntegrity] = useState(false);
  const [integrityResult, setIntegrityResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/files');
      const owned = res.data.files || [];
      setFiles(owned);
      if (owned.length > 0) {
        setSelectedFileId(owned[0].id);
      }
    } catch (err) {
      console.error('Error loading files for tamper demo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTamper = async () => {
    if (!selectedFileId) return;
    setTampering(true);
    setTamperSuccess(null);
    setIntegrityResult(null);

    try {
      const res = await apiRequest(`/api/tamper-test/${selectedFileId}`, {
        method: 'POST'
      }, 'CLOUD');

      setTamperSuccess({
        message: res.data.message,
        fileId: res.data.tamperedFileId
      });
    } catch (err) {
      setTamperSuccess({
        error: err.message || 'Failed to simulate tampering'
      });
    } finally {
      setTampering(false);
    }
  };

  const handleTestIntegrity = async () => {
    if (!selectedFileId) return;
    setTestingIntegrity(true);
    setIntegrityResult(null);

    try {
      const targetFile = files.find(f => f.id === selectedFileId);
      if (!targetFile) throw new Error('File not found in client vault');

      // Fetch the ciphertext from Cloud
      const res = await apiRequest(`/api/files/${selectedFileId}/download`, { method: 'GET' }, 'CLOUD');
      const ciphertextBlob = res.data;
      const ciphertextBuffer = await ciphertextBlob.arrayBuffer();

      const iv = res.headers.get('x-file-iv') || targetFile.iv;
      const expectedChecksum = res.headers.get('x-file-checksum') || targetFile.sha256Checksum;
      const encryptedKey = res.headers.get('x-encrypted-key') || targetFile.userEncryptedKey;

      const userPrivKeyB64 = getLocalPrivateKey(user.username);
      if (!userPrivKeyB64) throw new Error('Local RSA private key not found');
      const userPrivateKey = await importRSAPrivateKey(userPrivKeyB64);

      // Attempt to decrypt with Web Crypto API and verify SHA-256
      const decrypted = await decryptFilePayload(
        ciphertextBuffer,
        iv,
        encryptedKey,
        userPrivateKey,
        expectedChecksum
      );

      // If we reach here, integrity is intact
      setIntegrityResult({
        status: 'INTACT',
        title: 'Integrity Check Passed: File Unmodified',
        details: `SHA-256 hash matched expected signature: ${decrypted.computedChecksum.substring(0, 20)}...`
      });

    } catch (err) {
      // Tampering successfully intercepted!
      setIntegrityResult({
        status: 'TAMPER_DETECTED',
        title: 'Cryptographic Security Alert: Tampering Intercepted!',
        details: err.message || 'AES-GCM Auth Tag or SHA-256 checksum mismatch triggered abort.'
      });
    } finally {
      setTestingIntegrity(false);
    }
  };

  const selectedFile = files.find(f => f.id === selectedFileId);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="p-4 rounded-2xl bg-[#0d131f] border border-slate-800">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          Interactive Cryptographic Integrity & Tamper Defense Lab
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Simulate an adversarial man-in-the-middle or cloud storage bit-flip attack to observe how SHA-256 hashing and AES-256-GCM authentication tags immediately reject corrupted or altered data.
        </p>
      </div>

      {files.length === 0 ? (
        <div className="p-8 text-center bg-[#0d131f] border border-slate-800 rounded-2xl text-slate-400 text-xs space-y-2">
          <Bug className="h-8 w-8 mx-auto text-slate-600" />
          <p>No files currently in your vault.</p>
          <p className="text-[11px] text-slate-500">Upload a file in the File Vault tab first to run this interactive experiment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Step 1: Select Target File & Apply Tamper */}
          <div className="lg:col-span-1 p-5 rounded-2xl bg-[#0d131f] border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
              <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center">
                1
              </div>
              <h3 className="text-sm font-bold text-white">Select File to Attack</h3>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Target Vault File</label>
              <select
                value={selectedFileId}
                onChange={(e) => {
                  setSelectedFileId(e.target.value);
                  setTamperSuccess(null);
                  setIntegrityResult(null);
                }}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {files.map(f => (
                  <option key={f.id} value={f.id}>{f.originalName}</option>
                ))}
              </select>
            </div>

            {selectedFile && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] space-y-1.5 font-mono">
                <div className="text-slate-400">Owner: <strong className="text-white">@{selectedFile.ownerUsername}</strong></div>
                <div className="text-slate-400">Original SHA-256:</div>
                <div className="text-cyan-400 truncate" title={selectedFile.sha256Checksum}>{selectedFile.sha256Checksum}</div>
              </div>
            )}

            <button
              onClick={handleApplyTamper}
              disabled={tampering}
              className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Bug className="h-4 w-4" />
              <span>{tampering ? 'Injecting Corruption...' : 'Simulate 1-Byte Storage Bit-Flip'}</span>
            </button>

            {tamperSuccess && (
              <div className={`p-3 rounded-xl text-xs font-mono ${
                tamperSuccess.error 
                  ? 'bg-red-950/60 border border-red-800/60 text-red-300' 
                  : 'bg-amber-950/60 border border-amber-800/60 text-amber-300'
              }`}>
                {tamperSuccess.error || tamperSuccess.message}
              </div>
            )}
          </div>

          {/* Step 2: Verification Engine & Client Defense */}
          <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0d131f] border border-slate-800 space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
              <div className="h-6 w-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h3 className="text-sm font-bold text-white">Execute Decryption & Integrity Verification</h3>
            </div>

            <p className="text-xs text-slate-300">
              When the client downloads the file chunk, it uses <strong className="text-cyan-400">AES-256-GCM authentication tag verification</strong> and computes a fresh <strong className="text-cyan-400">SHA-256 digest</strong>. If any single bit was modified in transit or cloud storage, the verification instantly triggers a security exception.
            </p>

            <button
              onClick={handleTestIntegrity}
              disabled={testingIntegrity}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Play className={`h-4 w-4 ${testingIntegrity ? 'animate-spin' : ''}`} />
              <span>{testingIntegrity ? 'Testing Cryptographic Integrity...' : 'Download & Run Integrity Defense Verification'}</span>
            </button>

            {/* Results Panel */}
            {integrityResult && (
              <div className={`p-5 rounded-2xl border shadow-xl animate-fadeIn space-y-2 ${
                integrityResult.status === 'TAMPER_DETECTED'
                  ? 'bg-red-950/40 border-red-500/40 text-red-200'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              }`}>
                <div className="flex items-center space-x-2 font-bold text-sm">
                  {integrityResult.status === 'TAMPER_DETECTED' ? (
                    <>
                      <XCircle className="h-5 w-5 text-red-400" />
                      <span className="text-red-300">{integrityResult.title}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <span className="text-emerald-300">{integrityResult.title}</span>
                    </>
                  )}
                </div>

                <p className="text-xs font-mono bg-black/40 p-3 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed">
                  {integrityResult.details}
                </p>

                {integrityResult.status === 'TAMPER_DETECTED' && (
                  <div className="pt-2 flex items-center gap-2 text-[11px] text-red-400 font-semibold">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Malicious payload discarded. Client filesystem protected from corrupted data.</span>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
