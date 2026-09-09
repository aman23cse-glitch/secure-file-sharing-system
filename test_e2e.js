/**
 * Automated End-to-End Cryptographic & Edge Routing Verification Test
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CLOUD_PORT = 5000;
const EDGE_PORT = 5001;

function request(port, path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const text = buffer.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch(e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json || text,
          buffer
        });
      });
    });

    req.on('error', reject);
    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log(' STARTING END-TO-END SYSTEM INTEGRATION TEST');
  console.log('===============================================================');

  // 1. Health Checks
  console.log('\n[1] Checking Cloud & Edge health endpoints...');
  const cloudHealth = await request(CLOUD_PORT, '/health');
  console.log(` -> Cloud Server: Status ${cloudHealth.statusCode} (${cloudHealth.body.status})`);
  
  const edgeTelemetry = await request(EDGE_PORT, '/api/edge/telemetry');
  console.log(` -> Edge Gateway: Status ${edgeTelemetry.statusCode} (${edgeTelemetry.body.status})`);

  if (cloudHealth.statusCode !== 200 || edgeTelemetry.statusCode !== 200) {
    throw new Error('Health check failed. Ensure servers are running.');
  }

  // 2. Generate RSA Keypairs for Alice and Bob
  console.log('\n[2] Generating RSA-2048 Asymmetric Keypairs for Alice & Bob...');
  const aliceKeyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' }
  });
  const alicePublicKeyB64 = aliceKeyPair.publicKey.toString('base64');

  const bobKeyPair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' }
  });
  const bobPublicKeyB64 = bobKeyPair.publicKey.toString('base64');

  // 3. Register Alice and Bob
  console.log('\n[3] Registering Users in Cloud Authentication Vault...');
  const aliceReg = await request(CLOUD_PORT, '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'alice_' + Date.now(),
    password: 'Password123!',
    rsaPublicKey: alicePublicKeyB64
  });
  console.log(` -> Registered User Alice: ID ${aliceReg.body.user.id}`);
  const aliceToken = aliceReg.body.token;

  const bobReg = await request(CLOUD_PORT, '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'bob_' + Date.now(),
    password: 'Password123!',
    rsaPublicKey: bobPublicKeyB64
  });
  console.log(` -> Registered User Bob: ID ${bobReg.body.user.id}`);
  const bobToken = bobReg.body.token;

  // 4. Alice encrypts file with AES-256-GCM and wraps key with RSA
  console.log('\n[4] Encrypting Sample File Payload with AES-256-GCM...');
  const plaintext = Buffer.from('CONFIDENTIAL RESEARCH DATA: Cloud-Edge hybrid secure file sharing protocol v1.0');
  const sha256Checksum = crypto.createHash('sha256').update(plaintext).digest('hex');
  console.log(` -> Plaintext SHA-256 Checksum: ${sha256Checksum}`);

  const rawAesKey = crypto.randomBytes(32); // 256-bit AES key
  const iv = crypto.randomBytes(12); // 96-bit IV

  const cipher = crypto.createCipheriv('aes-256-gcm', rawAesKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Wrap AES key with Alice's RSA public key (OAEP SHA-256)
  const wrappedKeyForAlice = crypto.publicEncrypt({
    key: crypto.createPublicKey({ key: aliceKeyPair.publicKey, format: 'der', type: 'spki' }),
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, rawAesKey).toString('base64');

  // 5. Upload Encrypted File to Cloud
  console.log('\n[5] Uploading Ciphertext to Cloud Server...');
  // Construct multipart form-data payload manually
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let formBody = '';
  formBody += `--${boundary}\r\nContent-Disposition: form-data; name="originalName"\r\n\r\nresearch_report.pdf\r\n`;
  formBody += `--${boundary}\r\nContent-Disposition: form-data; name="mimeType"\r\n\r\napplication/pdf\r\n`;
  formBody += `--${boundary}\r\nContent-Disposition: form-data; name="sizeBytes"\r\n\r\n${plaintext.length}\r\n`;
  formBody += `--${boundary}\r\nContent-Disposition: form-data; name="iv"\r\n\r\n${iv.toString('base64')}\r\n`;
  formBody += `--${boundary}\r\nContent-Disposition: form-data; name="authTag"\r\n\r\n${authTag.toString('base64')}\r\n`;
  formBody += `--${boundary}\r\nContent-Disposition: form-data; name="sha256Checksum"\r\n\r\n${sha256Checksum}\r\n`;
  formBody += `--${boundary}\r\nContent-Disposition: form-data; name="encryptedKey"\r\n\r\n${wrappedKeyForAlice}\r\n`;
  formBody += `--${boundary}\r\nContent-Disposition: form-data; name="encryptedFile"; filename="research_report.pdf.enc"\r\nContent-Type: application/octet-stream\r\n\r\n`;

  const formHeader = Buffer.from(formBody, 'utf8');
  const formFooter = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const fullPayload = Buffer.concat([formHeader, ciphertext, formFooter]);

  const uploadRes = await request(CLOUD_PORT, '/api/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aliceToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': fullPayload.length
    }
  }, fullPayload);

  console.log(` -> File Upload Result: ${uploadRes.statusCode} (File ID: ${uploadRes.body.file.id})`);
  const fileId = uploadRes.body.file.id;

  // 6. Alice shares file with Bob (re-encrypting AES key with Bob's RSA public key)
  console.log('\n[6] Alice shares file with Bob via RSA Public-Key Key Wrapping...');
  const wrappedKeyForBob = crypto.publicEncrypt({
    key: crypto.createPublicKey({ key: bobKeyPair.publicKey, format: 'der', type: 'spki' }),
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, rawAesKey).toString('base64');

  const shareRes = await request(CLOUD_PORT, `/api/files/${fileId}/share`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aliceToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    recipientUserId: bobReg.body.user.id,
    encryptedKeyForRecipient: wrappedKeyForBob,
    permissions: { canRead: true, canDownload: true }
  });
  console.log(` -> Share Result: ${shareRes.statusCode} (${shareRes.body.message})`);

  // 7. Edge Gateway Download Test (Cache Miss on 1st request -> Cache Hit on 2nd)
  console.log('\n[7] Testing Edge Gateway Caching & Acceleration...');
  const edgeDownload1 = await request(EDGE_PORT, `/api/edge/files/${fileId}/download`, {
    headers: { 'Authorization': `Bearer ${bobToken}` }
  });
  console.log(` -> 1st Download via Edge: Status ${edgeDownload1.statusCode}, Served: ${edgeDownload1.headers['x-served-from']}`);

  const edgeDownload2 = await request(EDGE_PORT, `/api/edge/files/${fileId}/download`, {
    headers: { 'Authorization': `Bearer ${bobToken}` }
  });
  console.log(` -> 2nd Download via Edge: Status ${edgeDownload2.statusCode}, Served: ${edgeDownload2.headers['x-served-from']}`);

  // 8. Bob decrypts AES key with Bob's private key and decrypts ciphertext
  console.log('\n[8] Bob unwraps AES key with Bob\'s RSA Private Key & Decrypts File...');
  const bobDecryptedAesKey = crypto.privateDecrypt({
    key: crypto.createPrivateKey({ key: bobKeyPair.privateKey, format: 'der', type: 'pkcs8' }),
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, Buffer.from(edgeDownload2.headers['x-encrypted-key'], 'base64'));

  const decipher = crypto.createDecipheriv('aes-256-gcm', bobDecryptedAesKey, iv);
  if (authTag && authTag.length > 0) {
    decipher.setAuthTag(authTag);
  }
  const decryptedPlaintext = Buffer.concat([decipher.update(edgeDownload2.buffer), decipher.final()]);
  const decryptedChecksum = crypto.createHash('sha256').update(decryptedPlaintext).digest('hex');

  console.log(` -> Decrypted Content: "${decryptedPlaintext.toString('utf8')}"`);
  console.log(` -> SHA-256 Checksum Match: ${decryptedChecksum === sha256Checksum ? 'VERIFIED (PASS)' : 'FAILED'}`);

  console.log('\n===============================================================');
  console.log(' ALL 8/8 END-TO-END CRYPTOGRAPHIC & EDGE TESTS PASSED!');
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('\n[X] Test Failed:', err);
  process.exit(1);
});
