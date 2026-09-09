import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  X, 
  KeyRound, 
  UserCheck, 
  Lock, 
  ShieldCheck, 
  AlertCircle, 
  Check, 
  Trash2, 
  UserPlus, 
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { 
  importRSAPublicKey, 
  importRSAPrivateKey, 
  decryptAESKeyWithRSA, 
  encryptAESKeyWithRSA, 
  getLocalPrivateKey 
} from '../utils/crypto';
import { apiRequest } from '../utils/api';

export default function ShareModal({ file, currentUser, onClose, onShareUpdated }) {
  const [users, setUsers] = useState([]);
  const [fileDetails, setFileDetails] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [canRead, setCanRead] = useState(true);
  const [canDownload, setCanDownload] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, [file.id]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch all registered users
      const usersRes = await apiRequest('/api/users');
      const allUsers = usersRes.data.users || [];
      // Exclude current user
      const otherUsers = allUsers.filter(u => u.id !== currentUser.id);
      setUsers(otherUsers);
      if (otherUsers.length > 0) {
        setSelectedUserId(otherUsers[0].id);
      }

      // Fetch file full metadata including share list
      const fileRes = await apiRequest(`/api/files/${file.id}`);
      setFileDetails(fileRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load user and permission data');
    } finally {
      setLoading(false);
    }
  };

  // Perform Cryptographic Key Wrapping and Grant Share
  const handleShare = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setError('');
    setSuccess('');
    setActionLoading(true);

    try {
      const recipient = users.find(u => u.id === selectedUserId);
      if (!recipient || !recipient.rsaPublicKey) {
        throw new Error('Recipient RSA public key not found');
      }

      setStatusMessage(`1. Retrieving your RSA private key from secure local keystore...`);
      const ownerPrivKeyB64 = getLocalPrivateKey(currentUser.username);
      if (!ownerPrivKeyB64) {
        throw new Error('Your RSA Private Key was not found in browser storage. Please re-login.');
      }
      const ownerPrivateKey = await importRSAPrivateKey(ownerPrivKeyB64);

      setStatusMessage(`2. Decrypting file's master AES-256 session key with your RSA private key...`);
      const ownerEncryptedKey = fileDetails.userEncryptedKey;
      if (!ownerEncryptedKey) {
        throw new Error('You do not possess the cryptographic key for this file.');
      }
      const rawAesKeyBuffer = await decryptAESKeyWithRSA(ownerEncryptedKey, ownerPrivateKey);

      setStatusMessage(`3. Importing recipient @${recipient.username}'s RSA-2048 Public Key...`);
      const recipientPublicKey = await importRSAPublicKey(recipient.rsaPublicKey);

      setStatusMessage(`4. Encrypting AES-256 session key with @${recipient.username}'s RSA Public Key...`);
      const encryptedKeyForRecipient = await encryptAESKeyWithRSA(rawAesKeyBuffer, recipientPublicKey);

      setStatusMessage(`5. Registering cryptographic access grant with Cloud Vault...`);
      await apiRequest(`/api/files/${file.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientUserId: recipient.id,
          encryptedKeyForRecipient,
          permissions: {
            canRead,
            canDownload
          }
        })
      });

      setSuccess(`File successfully and securely shared with @${recipient.username}!`);
      fetchData();
      if (onShareUpdated) onShareUpdated();
    } catch (err) {
      console.error('Share error:', err);
      setError(err.message || 'Failed to share file');
    } finally {
      setActionLoading(false);
      setStatusMessage('');
    }
  };

  // Revoke Access
  const handleRevoke = async (targetUserId, targetUsername) => {
    if (!window.confirm(`Are you sure you want to revoke file access for @${targetUsername}?`)) {
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/api/files/${file.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId })
      });

      setSuccess(`Access revoked for @${targetUsername}. Key access purged.`);
      fetchData();
      if (onShareUpdated) onShareUpdated();
    } catch (err) {
      setError(err.message || 'Failed to revoke access');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-[#0d131f] border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Cryptographic Access Control</h3>
              <p className="text-xs text-slate-400 font-mono truncate max-w-xs">{file.originalName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/50 border border-red-800/50 flex items-start space-x-2 text-red-300 text-xs">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/50 flex items-start space-x-2 text-emerald-300 text-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Share Form */}
        {file.isOwner && (
          <form onSubmit={handleShare} className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <UserPlus className="h-4 w-4 text-cyan-400" />
              Grant Encrypted Access to Recipient
            </h4>

            {users.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No other registered users found to share with.</p>
            ) : (
              <>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Select Target User (Fetches their RSA-2048 Public Key)
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        @{u.username} (RSA: {u.rsaPublicKey.substring(0, 16)}...)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-4 pt-1">
                  <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canRead}
                      onChange={(e) => setCanRead(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                    />
                    <span>Read Metadata</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canDownload}
                      onChange={(e) => setCanDownload(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                    />
                    <span>Download & Decrypt Payload</span>
                  </label>
                </div>

                {statusMessage && (
                  <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs flex items-center space-x-2 font-mono">
                    <Cpu className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                    <span>{statusMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={actionLoading || users.length === 0}
                  className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-cyan-500/20 flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Encrypt AES Key & Grant Permission</span>
                </button>
              </>
            )}
          </form>
        )}

        {/* Existing Permissions List */}
        <div className="mt-5">
          <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Authorized Access Control List (ACL)
          </h4>

          {loading ? (
            <p className="text-xs text-slate-500">Loading access control lists...</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {fileDetails && fileDetails.sharedUsers && fileDetails.sharedUsers.length > 0 ? (
                fileDetails.sharedUsers.map(su => (
                  <div
                    key={su.userId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-cyan-400 text-xs">
                        {su.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">@{su.username}</span>
                          {su.isOwner && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                              Owner
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {su.permissions.canDownload ? 'Full Decrypt & Download' : 'Read Only'}
                        </p>
                      </div>
                    </div>

                    {!su.isOwner && file.isOwner && (
                      <button
                        onClick={() => handleRevoke(su.userId, su.username)}
                        disabled={actionLoading}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Revoke Permission & Purge Encrypted Key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">This file is private to owner only.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
