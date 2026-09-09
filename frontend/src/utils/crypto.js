/**
 * Cryptographic Engine for Secure File Sharing Between Cloud and Edge
 * Implements:
 *  - AES-256-GCM (Symmetric Payload Encryption & Authentication)
 *  - RSA-OAEP 2048-bit (Asymmetric Key Management & Key Wrapping)
 *  - SHA-256 (Integrity Checksum & Tamper Detection)
 */

// Utility: ArrayBuffer to Base64
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Utility: Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Utility: ArrayBuffer to Hex String
export function bufferToHex(buffer) {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Utility: Hex string to ArrayBuffer
export function hexToBuffer(hexString) {
  const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes.buffer;
}

/**
 * 1. Compute SHA-256 Checksum of an ArrayBuffer
 */
export async function computeSHA256(arrayBuffer) {
  const digest = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
  return bufferToHex(digest);
}

/**
 * 2. Generate RSA-2048 Keypair for User
 */
export async function generateRSAKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256'
    },
    true, // extractable
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );

  const exportedPublic = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const exportedPrivate = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicKeyB64 = arrayBufferToBase64(exportedPublic);
  const privateKeyB64 = arrayBufferToBase64(exportedPrivate);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyB64,
    privateKeyB64
  };
}

/**
 * 3. Import Public Key from SPKI Base64
 */
export async function importRSAPublicKey(spkiBase64) {
  const keyBuffer = base64ToArrayBuffer(spkiBase64);
  return await window.crypto.subtle.importKey(
    'spki',
    keyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'wrapKey']
  );
}

/**
 * 4. Import Private Key from PKCS8 Base64
 */
export async function importRSAPrivateKey(pkcs8Base64) {
  const keyBuffer = base64ToArrayBuffer(pkcs8Base64);
  return await window.crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    true,
    ['decrypt', 'unwrapKey']
  );
}

/**
 * 5. Encrypt AES Session Key using RSA-OAEP Public Key
 */
export async function encryptAESKeyWithRSA(rawAesKeyBuffer, recipientPublicKey) {
  const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    recipientPublicKey,
    rawAesKeyBuffer
  );
  return arrayBufferToBase64(encryptedKeyBuffer);
}

/**
 * 6. Decrypt AES Session Key using RSA-OAEP Private Key
 */
export async function decryptAESKeyWithRSA(encryptedKeyBase64, userPrivateKey) {
  const encryptedBuffer = base64ToArrayBuffer(encryptedKeyBase64);
  const rawAesKeyBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP'
    },
    userPrivateKey,
    encryptedBuffer
  );
  return rawAesKeyBuffer;
}

/**
 * 7. Encrypt File with AES-256-GCM and Wrap AES Key with User's RSA Public Key
 */
export async function encryptFilePayload(fileArrayBuffer, userPublicKey) {
  // Step A: Calculate Plaintext SHA-256 Checksum for integrity verification
  const sha256Checksum = await computeSHA256(fileArrayBuffer);

  // Step B: Generate fresh random 256-bit AES-GCM Key
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Step C: Generate 96-bit (12-byte) random IV
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Step D: Encrypt payload with AES-256-GCM
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    aesKey,
    fileArrayBuffer
  );

  // Step E: Export raw AES key and wrap it with the user's RSA Public Key
  const rawAesKeyBuffer = await window.crypto.subtle.exportKey('raw', aesKey);
  const encryptedKeyForOwner = await encryptAESKeyWithRSA(rawAesKeyBuffer, userPublicKey);

  return {
    ciphertextBlob: new Blob([ciphertextBuffer], { type: 'application/octet-stream' }),
    ivBase64: arrayBufferToBase64(iv),
    sha256Checksum,
    encryptedKeyForOwner,
    rawAesKeyBuffer // Keep in memory temporarily if immediate re-encryption is needed
  };
}

/**
 * 8. Decrypt File with AES-256-GCM after unwrapping AES Key
 */
export async function decryptFilePayload(
  ciphertextArrayBuffer,
  ivBase64,
  encryptedKeyBase64,
  userPrivateKey,
  expectedChecksum
) {
  // Step A: Decrypt the AES Key with User's RSA Private Key
  let rawAesKeyBuffer;
  try {
    rawAesKeyBuffer = await decryptAESKeyWithRSA(encryptedKeyBase64, userPrivateKey);
  } catch (err) {
    throw new Error('RSA Key Unwrapping Failed: Private key does not match or key is corrupt.');
  }

  // Step B: Import raw AES key
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    rawAesKeyBuffer,
    {
      name: 'AES-GCM'
    },
    false,
    ['decrypt']
  );

  // Step C: Decrypt ciphertext using AES-256-GCM and IV
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  let plaintextBuffer;
  try {
    plaintextBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      aesKey,
      ciphertextArrayBuffer
    );
  } catch (err) {
    throw new Error('AES-GCM Decryption & Authentication Tag Verification Failed! Data is corrupted or tampered.');
  }

  // Step D: Verify SHA-256 Checksum against expected hash
  const computedChecksum = await computeSHA256(plaintextBuffer);
  if (computedChecksum.toLowerCase() !== expectedChecksum.toLowerCase()) {
    throw new Error(
      `SHA-256 Integrity Verification Failed!\nExpected: ${expectedChecksum}\nCalculated: ${computedChecksum}\nTampering detected in transit or storage!`
    );
  }

  return {
    plaintextBuffer,
    checksumVerified: true,
    computedChecksum
  };
}

/**
 * Local Key Storage Helpers (Stores User's Private RSA Key in Browser)
 */
export function savePrivateKeyLocally(username, privateKeyB64) {
  localStorage.setItem(`sec_edge_privkey_${username}`, privateKeyB64);
}

export function getLocalPrivateKey(username) {
  return localStorage.getItem(`sec_edge_privkey_${username}`);
}

export function removeLocalPrivateKey(username) {
  localStorage.removeItem(`sec_edge_privkey_${username}`);
}
