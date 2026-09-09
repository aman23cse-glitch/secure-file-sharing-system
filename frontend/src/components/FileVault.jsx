import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  File, 
  Download, 
  Share2, 
  Trash2, 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  HardDrive, 
  Clock, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Cloud, 
  Cpu, 
  RefreshCw,
  FileCheck,
  Hash,
  Eye
} from 'lucide-react';
import { 
  encryptFilePayload, 
  decryptFilePayload, 
  importRSAPublicKey, 
  importRSAPrivateKey, 
  getLocalPrivateKey,
  computeSHA256
} from '../utils/crypto';
import { 
  apiRequest, 
  getActiveRoute, 
  CLOUD_BASE_URL, 
  EDGE_BASE_URL 
} from '../utils/api';
import ShareModal from './ShareModal';

export default function FileVault({ user, currentRoute }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cryptoProgress, setCryptoProgress] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileForShare, setSelectedFileForShare] = useState(null);
  const [activeDownloadNotification, setActiveDownloadNotification] = useState(null);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/api/files');
      setFiles(res.data.files || []);
    } catch (err) {
      setError(err.message || 'Failed to load file directory');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // CLIENT-SIDE ENCRYPT & UPLOAD PIPELINE
  // ----------------------------------------------------
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setActiveDownloadNotification(null);

    try {
      // Step 1: Read plaintext file buffer
      setCryptoProgress({ step: 1, title: 'Reading local plaintext file buffer into memory...', percent: 15 });
      const arrayBuffer = await file.arrayBuffer();

      // Step 2: Calculate SHA-256 checksum of original file
      setCryptoProgress({ step: 2, title: 'Computing cryptographic SHA-256 integrity checksum...', percent: 35 });
      const sha256Checksum = await computeSHA256(arrayBuffer);

      // Step 3: Import user's RSA Public Key for AES Session Key Wrapping
      setCryptoProgress({ step: 3, title: 'Importing user RSA-2048 Public Key for key encapsulation...', percent: 55 });
      const userPublicKey = await importRSAPublicKey(user.rsaPublicKey);

      // Step 4: Encrypt file buffer with fresh AES-256-GCM key and wrap key
      setCryptoProgress({ step: 4, title: 'Encrypting payload with AES-256-GCM & wrapping session key...', percent: 75 });
      const encryptedData = await encryptFilePayload(arrayBuffer, userPublicKey);

      // Step 5: Package encrypted payload and cryptographic metadata into FormData
      setCryptoProgress({ step: 5, title: `Dispatching encrypted ciphertext to ${currentRoute === 'EDGE' ? 'Edge Gateway' : 'Cloud Hub'}...`, percent: 90 });
      const formData = new FormData();
      formData.append('encryptedFile', encryptedData.ciphertextBlob, `${file.name}.enc`);
      formData.append('originalName', file.name);
      formData.append('mimeType', file.type || 'application/octet-stream');
      formData.append('sizeBytes', file.size.toString());
      formData.append('iv', encryptedData.ivBase64);
      formData.append('sha256Checksum', sha256Checksum);
      formData.append('encryptedKey', encryptedData.encryptedKeyForOwner);
      formData.append('clientRoute', currentRoute === 'EDGE' ? 'EDGE_GATEWAY' : 'CLOUD_DIRECT');

      const uploadEndpoint = currentRoute === 'EDGE' ? '/api/files/upload' : '/api/files/upload';
      await apiRequest(uploadEndpoint, {
        method: 'POST',
        body: formData
      });

      setCryptoProgress({ step: 6, title: 'File encrypted & vaulted successfully!', percent: 100 });
      await new Promise(r => setTimeout(r, 600));

      fetchFiles();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Upload encryption error:', err);
      setError(err.message || 'Encryption and upload failed');
    } finally {
      setUploading(false);
      setCryptoProgress(null);
    }
  };

  // ----------------------------------------------------
  // DOWNLOAD, UNWRAP KEY, DECRYPT & INTEGRITY CHECK PIPELINE
  // ----------------------------------------------------
  const handleDownloadAndDecrypt = async (file) => {
    setError('');
    const startTime = performance.now();

    try {
      // Step A: Determine route (Edge vs Direct Cloud)
      const isEdge = currentRoute === 'EDGE';
      const downloadEndpoint = isEdge 
        ? `/api/edge/files/${file.id}/download` 
        : `/api/files/${file.id}/download`;

      const response = await apiRequest(downloadEndpoint, { method: 'GET' });
      const totalRoundtripMs = Math.round(performance.now() - startTime);

      const ciphertextBlob = response.data;
      const ciphertextBuffer = await ciphertextBlob.arrayBuffer();

      // Retrieve cryptographic headers
      const iv = response.headers.get('x-file-iv') || file.iv;
      const expectedChecksum = response.headers.get('x-file-checksum') || file.sha256Checksum;
      const servedFrom = response.headers.get('x-served-from') || (isEdge ? 'EDGE_GATEWAY' : 'CLOUD_DIRECT');

      // Step B: Get file's wrapped AES key for the current user
      let encryptedKeyForUser = response.headers.get('x-encrypted-key');
      if (!encryptedKeyForUser) {
        // Fetch from file metadata
        const metaRes = await apiRequest(`/api/files/${file.id}`);
        encryptedKeyForUser = metaRes.data.userEncryptedKey;
      }

      if (!encryptedKeyForUser) {
        throw new Error('No cryptographic key found for your identity. Request sharing access from owner.');
      }

      // Step C: Retrieve user's local RSA private key
      const userPrivKeyB64 = getLocalPrivateKey(user.username);
      if (!userPrivKeyB64) {
        throw new Error('Your RSA Private Key was not found in browser storage. Please re-login.');
      }
      const userPrivateKey = await importRSAPrivateKey(userPrivKeyB64);

      // Step D: Decrypt AES Session Key & Decrypt Ciphertext with Integrity Hash Check
      const decryptResult = await decryptFilePayload(
        ciphertextBuffer,
        iv,
        encryptedKeyForUser,
        userPrivateKey,
        expectedChecksum
      );

      // Step E: Trigger download in browser
      const plaintextBlob = new Blob([decryptResult.plaintextBuffer], { type: file.mimeType || 'application/octet-stream' });
      const downloadUrl = URL.createObjectURL(plaintextBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      // Display performance & integrity banner
      setActiveDownloadNotification({
        fileName: file.originalName,
        servedFrom: servedFrom === 'EDGE_CACHE' ? '⚡ Edge Cache (Local Proximity)' : '☁️ Cloud Vault (Direct Fetch)',
        latencyMs: totalRoundtripMs,
        checksum: decryptResult.computedChecksum,
        sizeBytes: file.sizeBytes
      });

    } catch (err) {
      console.error('Download/Decryption Error:', err);
      setError(err.message || 'Decryption failed: Cryptographic integrity violation');
    }
  };

  // Delete File
  const handleDelete = async (fileId, fileName) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${fileName}' from Cloud Storage?`)) {
      return;
    }

    try {
      await apiRequest(`/api/files/${fileId}`, { method: 'DELETE' });
      fetchFiles();
    } catch (err) {
      setError(err.message || 'Failed to delete file');
    }
  };

  // Format Bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter(f => 
    f.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.ownerUsername.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Route Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-[#0c1524] border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-cyan-400" />
            Encrypted File Vault
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Files are client-side encrypted with <strong className="text-slate-200">AES-256-GCM</strong>. Keys are wrapped with <strong className="text-slate-200">RSA-2048</strong>.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-mono text-slate-300">
            <span>Routing via:</span>
            {currentRoute === 'EDGE' ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" /> Edge Gateway (Port 5001)
              </span>
            ) : (
              <span className="text-indigo-400 font-semibold flex items-center gap-1">
                <Cloud className="h-3.5 w-3.5" /> Direct Cloud (Port 5000)
              </span>
            )}
          </div>

          <button
            onClick={fetchFiles}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title="Refresh Files"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800/60 flex items-start space-x-3 text-red-200 text-xs shadow-lg">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-red-300">Security Alert / Error</p>
            <p className="font-mono">{error}</p>
          </div>
        </div>
      )}

      {/* Download & Latency Verification Banner */}
      {activeDownloadNotification && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-200 shadow-xl animate-fadeIn space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-semibold text-emerald-300 text-sm">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <span>Decryption & Download Successful</span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-700/50 font-mono font-bold">
              Roundtrip: {activeDownloadNotification.latencyMs} ms
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] pt-1">
            <div className="bg-emerald-900/30 p-2 rounded-lg border border-emerald-800/40">
              <span className="text-slate-400 block">File & Size:</span>
              <strong className="text-white font-mono">{activeDownloadNotification.fileName} ({formatBytes(activeDownloadNotification.sizeBytes)})</strong>
            </div>
            <div className="bg-emerald-900/30 p-2 rounded-lg border border-emerald-800/40">
              <span className="text-slate-400 block">Dispatch Node:</span>
              <strong className="text-emerald-300 font-mono">{activeDownloadNotification.servedFrom}</strong>
            </div>
            <div className="bg-emerald-900/30 p-2 rounded-lg border border-emerald-800/40">
              <span className="text-slate-400 block">SHA-256 Integrity:</span>
              <strong className="text-cyan-300 font-mono truncate block" title={activeDownloadNotification.checksum}>
                ✓ {activeDownloadNotification.checksum.substring(0, 16)}... (Verified Match)
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="relative p-6 sm:p-8 rounded-2xl border-2 border-dashed border-slate-700/80 hover:border-cyan-500/60 bg-[#0d131f]/70 transition-all text-center">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileUpload}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        {uploading && cryptoProgress ? (
          <div className="space-y-4 max-w-md mx-auto py-2">
            <div className="flex items-center justify-center space-x-3 text-cyan-400">
              <Cpu className="h-6 w-6 animate-spin" />
              <span className="font-semibold text-sm">Client-Side Cryptographic Pipeline Active</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${cryptoProgress.percent}%` }}
              />
            </div>
            <p className="text-xs text-slate-300 font-mono animate-pulse">{cryptoProgress.title}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Upload className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Drop file to encrypt & upload, or click to browse</h3>
              <p className="text-xs text-slate-400 mt-1">
                Your browser encrypts the file with a random 256-bit AES key and wraps it with your RSA public key before sending.
              </p>
            </div>
            <div className="inline-flex items-center space-x-3 text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> AES-256-GCM</span>
              <span>•</span>
              <span className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5 text-cyan-400" /> RSA-2048 OAEP</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5 text-cyan-400" /> SHA-256 Digest</span>
            </div>
          </div>
        )}
      </div>

      {/* Files Search and Table */}
      <div className="bg-[#0d131f] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        
        {/* Table Header / Search */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <HardDrive className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-bold text-white">Encrypted Files ({files.length})</span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files or owners..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            <Cpu className="h-6 w-6 animate-spin mx-auto text-cyan-400 mb-2" />
            Loading encrypted file vault...
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs space-y-2">
            <FileCheck className="h-8 w-8 mx-auto text-slate-600" />
            <p>No encrypted files found.</p>
            <p className="text-[11px] text-slate-600">Upload a file above to test the AES-256 + RSA encryption and Edge caching pipeline!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Owner & Access</th>
                  <th className="py-3 px-4">SHA-256 Checksum</th>
                  <th className="py-3 px-4">Sharing</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFiles.map(file => (
                  <tr key={file.id} className="hover:bg-slate-900/40 transition-colors">
                    
                    {/* File Name & Icon */}
                    <td className="py-3.5 px-4 font-medium text-white flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 flex items-center justify-center shrink-0">
                        <File className="h-4 w-4" />
                      </div>
                      <div className="truncate max-w-xs">
                        <p className="truncate font-semibold text-slate-200">{file.originalName}</p>
                        <span className="text-[10px] text-cyan-400/90 font-mono">
                          AES-256-GCM Encrypted
                        </span>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-3.5 px-4 text-slate-300 font-mono">
                      {formatBytes(file.sizeBytes)}
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-4">
                      {file.isOwner ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                          You (Owner)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                          Shared by @{file.ownerUsername}
                        </span>
                      )}
                    </td>

                    {/* SHA-256 */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                      <span className="truncate block max-w-[130px]" title={file.sha256Checksum}>
                        {file.sha256Checksum ? `${file.sha256Checksum.substring(0, 10)}...` : 'N/A'}
                      </span>
                    </td>

                    {/* Shared With */}
                    <td className="py-3.5 px-4">
                      {file.sharedWithCount > 0 ? (
                        <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                          <Share2 className="h-3 w-3" /> {file.sharedWithCount} user(s)
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">Private</span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {/* Decrypt & Download */}
                      <button
                        onClick={() => handleDownloadAndDecrypt(file)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shadow-sm"
                        title="Download encrypted chunk, unwrap AES key with RSA, and decrypt locally"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Decrypt & Save</span>
                      </button>

                      {/* Share (Owner Only) */}
                      {file.isOwner && (
                        <button
                          onClick={() => setSelectedFileForShare(file)}
                          className="inline-flex items-center p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Share file with other users using their RSA public key"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Delete (Owner Only) */}
                      {file.isOwner && (
                        <button
                          onClick={() => handleDelete(file.id, file.originalName)}
                          className="inline-flex items-center p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete file permanently"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Share Modal Dialog */}
      {selectedFileForShare && (
        <ShareModal
          file={selectedFileForShare}
          currentUser={user}
          onClose={() => setSelectedFileForShare(null)}
          onShareUpdated={fetchFiles}
        />
      )}

    </div>
  );
}
