const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { initDb, readDb, writeDb, addAuditLog } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'secure_cloud_edge_super_secret_jwt_key_2026';
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

initDb();

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Multer storage for encrypted file chunks
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    cb(null, `${fileId}.enc`);
  }
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB limit

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// ----------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, rsaPublicKey } = req.body;
    if (!username || !password || !rsaPublicKey) {
      return res.status(400).json({ error: 'Username, password, and RSA public key are required' });
    }

    const db = readDb();
    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      id: uuidv4(),
      username,
      passwordHash,
      rsaPublicKey,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDb(db);

    addAuditLog('USER_REGISTER', {
      userId: newUser.id,
      username: newUser.username,
      details: 'New user registered with RSA public key generated at client',
      ip: req.ip
    });

    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        rsaPublicKey: newUser.rsaPublicKey
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const db = readDb();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      addAuditLog('LOGIN_FAILED', {
        username,
        details: 'Failed login attempt - user not found',
        status: 'FAILED',
        ip: req.ip
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      addAuditLog('LOGIN_FAILED', {
        userId: user.id,
        username: user.username,
        details: 'Failed login attempt - invalid password',
        status: 'FAILED',
        ip: req.ip
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    addAuditLog('USER_LOGIN', {
      userId: user.id,
      username: user.username,
      details: 'User authenticated successfully via JWT',
      ip: req.ip
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        rsaPublicKey: user.rsaPublicKey
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Get user profile / current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    id: user.id,
    username: user.username,
    rsaPublicKey: user.rsaPublicKey,
    createdAt: user.createdAt
  });
});

// List all registered users (for sharing dialog)
app.get('/api/users', authenticateToken, (req, res) => {
  const db = readDb();
  const users = db.users.map(u => ({
    id: u.id,
    username: u.username,
    rsaPublicKey: u.rsaPublicKey
  }));
  res.json({ users });
});

// ----------------------------------------------------
// FILE MANAGEMENT ROUTES
// ----------------------------------------------------

// Upload Encrypted File
app.post('/api/files/upload', authenticateToken, upload.single('encryptedFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const {
      originalName,
      mimeType,
      sizeBytes,
      iv,
      authTag,
      sha256Checksum,
      encryptedKey,
      clientRoute = 'CLOUD_DIRECT'
    } = req.body;

    if (!originalName || !iv || !sha256Checksum || !encryptedKey) {
      // Clean up uploaded file if metadata missing
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Missing required cryptographic metadata' });
    }

    const fileId = path.parse(req.file.filename).name;
    const db = readDb();

    const fileRecord = {
      id: fileId,
      storageFileName: req.file.filename,
      originalName,
      mimeType: mimeType || 'application/octet-stream',
      sizeBytes: parseInt(sizeBytes, 10) || req.file.size,
      encryptedSizeBytes: req.file.size,
      ownerId: req.user.id,
      ownerUsername: req.user.username,
      iv,
      authTag: authTag || '',
      sha256Checksum,
      // Map of userId -> encrypted AES session key (base64)
      encryptedKeys: {
        [req.user.id]: encryptedKey
      },
      // Permissions structure
      permissions: {
        [req.user.id]: {
          canRead: true,
          canDownload: true,
          isOwner: true,
          grantedAt: new Date().toISOString()
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.files.push(fileRecord);
    db.metrics.totalUploads = (db.metrics.totalUploads || 0) + 1;
    db.metrics.bytesTransferred = (db.metrics.bytesTransferred || 0) + req.file.size;
    writeDb(db);

    addAuditLog('FILE_UPLOAD', {
      userId: req.user.id,
      username: req.user.username,
      fileId: fileRecord.id,
      fileName: fileRecord.originalName,
      details: `File encrypted with AES-256-GCM & RSA key wrapping. SHA-256: ${sha256Checksum.substring(0, 12)}... Size: ${fileRecord.sizeBytes} bytes`,
      route: clientRoute,
      ip: req.ip
    });

    res.status(201).json({
      message: 'Encrypted file uploaded successfully to Cloud Vault',
      file: {
        id: fileRecord.id,
        originalName: fileRecord.originalName,
        sizeBytes: fileRecord.sizeBytes,
        encryptedSizeBytes: fileRecord.encryptedSizeBytes,
        sha256Checksum: fileRecord.sha256Checksum,
        createdAt: fileRecord.createdAt
      }
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Internal server error during file upload' });
  }
});

// List Files for Current User
app.get('/api/files', authenticateToken, (req, res) => {
  const db = readDb();
  const userId = req.user.id;

  const accessibleFiles = db.files.filter(f => {
    return f.ownerId === userId || (f.permissions && f.permissions[userId]);
  }).map(f => {
    const isOwner = f.ownerId === userId;
    const userPerms = f.permissions ? f.permissions[userId] : null;
    const userEncryptedKey = f.encryptedKeys ? f.encryptedKeys[userId] : null;
    
    // Count shared users
    const sharedWithCount = f.permissions ? Object.keys(f.permissions).filter(uid => uid !== f.ownerId).length : 0;

    return {
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      encryptedSizeBytes: f.encryptedSizeBytes,
      ownerId: f.ownerId,
      ownerUsername: f.ownerUsername,
      isOwner,
      hasKeyAccess: !!userEncryptedKey,
      permissions: userPerms,
      sharedWithCount,
      iv: f.iv,
      authTag: f.authTag,
      sha256Checksum: f.sha256Checksum,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt
    };
  });

  res.json({ files: accessibleFiles });
});

// Get File Metadata & User's Encrypted Key
app.get('/api/files/:fileId', authenticateToken, (req, res) => {
  const db = readDb();
  const file = db.files.find(f => f.id === req.params.fileId);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const userId = req.user.id;
  const isOwner = file.ownerId === userId;
  const userPerms = file.permissions ? file.permissions[userId] : null;

  if (!isOwner && !userPerms) {
    addAuditLog('UNAUTHORIZED_ACCESS', {
      userId: req.user.id,
      username: req.user.username,
      fileId: file.id,
      fileName: file.originalName,
      details: 'Attempted unauthorized access to file metadata',
      status: 'BLOCKED',
      ip: req.ip
    });
    return res.status(403).json({ error: 'Permission denied for this file' });
  }

  const userEncryptedKey = file.encryptedKeys ? file.encryptedKeys[userId] : null;

  // Build shared users list for owner view
  const sharedList = [];
  if (file.permissions) {
    Object.keys(file.permissions).forEach(uId => {
      const u = db.users.find(usr => usr.id === uId);
      if (u) {
        sharedList.push({
          userId: u.id,
          username: u.username,
          isOwner: uId === file.ownerId,
          permissions: file.permissions[uId]
        });
      }
    });
  }

  res.json({
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    encryptedSizeBytes: file.encryptedSizeBytes,
    ownerId: file.ownerId,
    ownerUsername: file.ownerUsername,
    isOwner,
    userEncryptedKey,
    iv: file.iv,
    authTag: file.authTag,
    sha256Checksum: file.sha256Checksum,
    createdAt: file.createdAt,
    permissions: userPerms,
    sharedUsers: sharedList
  });
});

// Download Encrypted File Payload
app.get('/api/files/:fileId/download', authenticateToken, (req, res) => {
  const db = readDb();
  const file = db.files.find(f => f.id === req.params.fileId);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const userId = req.user.id;
  const isOwner = file.ownerId === userId;
  const userPerms = file.permissions ? file.permissions[userId] : null;

  if (!isOwner && (!userPerms || !userPerms.canDownload)) {
    addAuditLog('UNAUTHORIZED_DOWNLOAD', {
      userId: req.user.id,
      username: req.user.username,
      fileId: file.id,
      fileName: file.originalName,
      details: 'Attempted unauthorized file download',
      status: 'BLOCKED',
      ip: req.ip
    });
    return res.status(403).json({ error: 'Download permission denied' });
  }

  const filePath = path.join(UPLOADS_DIR, file.storageFileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Storage file payload missing on server' });
  }

  db.metrics.totalDownloads = (db.metrics.totalDownloads || 0) + 1;
  db.metrics.bytesTransferred = (db.metrics.bytesTransferred || 0) + file.encryptedSizeBytes;
  writeDb(db);

  addAuditLog('FILE_DOWNLOAD', {
    userId: req.user.id,
    username: req.user.username,
    fileId: file.id,
    fileName: file.originalName,
    details: `Encrypted file chunk dispatched to client. Size: ${file.encryptedSizeBytes} bytes.`,
    route: req.query.route || 'CLOUD_DIRECT',
    ip: req.ip
  });

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}.enc"`);
  res.setHeader('X-File-IV', file.iv);
  res.setHeader('X-File-AuthTag', file.authTag || '');
  res.setHeader('X-File-Checksum', file.sha256Checksum);
  res.setHeader('X-Encrypted-Key', file.encryptedKeys[userId] || '');

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Share File with another user
app.post('/api/files/:fileId/share', authenticateToken, (req, res) => {
  try {
    const { recipientUserId, encryptedKeyForRecipient, permissions = { canRead: true, canDownload: true } } = req.body;

    if (!recipientUserId || !encryptedKeyForRecipient) {
      return res.status(400).json({ error: 'Recipient user ID and encrypted key required' });
    }

    const db = readDb();
    const file = db.files.find(f => f.id === req.params.fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Only the file owner can grant sharing access' });
    }

    const recipient = db.users.find(u => u.id === recipientUserId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    file.encryptedKeys[recipientUserId] = encryptedKeyForRecipient;
    file.permissions[recipientUserId] = {
      canRead: !!permissions.canRead,
      canDownload: !!permissions.canDownload,
      isOwner: false,
      grantedBy: req.user.username,
      grantedAt: new Date().toISOString()
    };
    file.updatedAt = new Date().toISOString();

    writeDb(db);

    addAuditLog('FILE_SHARE', {
      userId: req.user.id,
      username: req.user.username,
      fileId: file.id,
      fileName: file.originalName,
      details: `Shared with user '${recipient.username}' via recipient RSA public key wrapping`,
      ip: req.ip
    });

    res.json({
      message: `File shared securely with ${recipient.username}`,
      fileId: file.id
    });
  } catch (err) {
    console.error('Share file error:', err);
    res.status(500).json({ error: 'Internal server error during sharing' });
  }
});

// Revoke access
app.post('/api/files/:fileId/revoke', authenticateToken, (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ error: 'Target user ID required' });
  }

  const db = readDb();
  const file = db.files.find(f => f.id === req.params.fileId);

  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (file.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Only the file owner can revoke permissions' });
  }

  if (targetUserId === file.ownerId) {
    return res.status(400).json({ error: 'Cannot revoke owner access' });
  }

  const targetUser = db.users.find(u => u.id === targetUserId);
  const targetUsername = targetUser ? targetUser.username : targetUserId;

  delete file.encryptedKeys[targetUserId];
  delete file.permissions[targetUserId];
  file.updatedAt = new Date().toISOString();

  writeDb(db);

  addAuditLog('ACCESS_REVOKED', {
    userId: req.user.id,
    username: req.user.username,
    fileId: file.id,
    fileName: file.originalName,
    details: `Revoked access for user '${targetUsername}'. Cryptographic key access removed.`,
    ip: req.ip
  });

  res.json({ message: `Access revoked for ${targetUsername}` });
});

// Delete file
app.delete('/api/files/:fileId', authenticateToken, (req, res) => {
  const db = readDb();
  const fileIndex = db.files.findIndex(f => f.id === req.params.fileId);

  if (fileIndex === -1) {
    return res.status(404).json({ error: 'File not found' });
  }

  const file = db.files[fileIndex];
  if (file.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Only the file owner can delete the file' });
  }

  const filePath = path.join(UPLOADS_DIR, file.storageFileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  db.files.splice(fileIndex, 1);
  writeDb(db);

  addAuditLog('FILE_DELETE', {
    userId: req.user.id,
    username: req.user.username,
    fileId: file.id,
    fileName: file.originalName,
    details: `Encrypted file payload and metadata permanently purged from Cloud storage.`,
    ip: req.ip
  });

  res.json({ message: 'File deleted successfully' });
});

// ----------------------------------------------------
// AUDIT & TELEMETRY ROUTES
// ----------------------------------------------------

// Get Audit Logs
app.get('/api/audit-logs', authenticateToken, (req, res) => {
  const db = readDb();
  res.json({ logs: db.auditLogs || [] });
});

// Get Cloud Metrics
app.get('/api/metrics', authenticateToken, (req, res) => {
  const db = readDb();
  res.json({
    totalUsers: db.users.length,
    totalFiles: db.files.length,
    totalUploads: db.metrics.totalUploads || 0,
    totalDownloads: db.metrics.totalDownloads || 0,
    bytesTransferred: db.metrics.bytesTransferred || 0,
    tamperAttemptsDetected: db.metrics.tamperAttemptsDetected || 0,
    uptimeSeconds: Math.floor(process.uptime()),
    serverType: 'CENTRAL_CLOUD_HUB',
    port: PORT
  });
});

// Demo Route: Simulate Bit-flip Tampering for Integrity Demonstration
app.post('/api/tamper-test/:fileId', authenticateToken, (req, res) => {
  const db = readDb();
  const file = db.files.find(f => f.id === req.params.fileId);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const filePath = path.join(UPLOADS_DIR, file.storageFileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Storage file payload missing' });
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    if (fileBuffer.length > 0) {
      // Flip the first byte
      fileBuffer[0] = fileBuffer[0] ^ 0xFF;
      fs.writeFileSync(filePath, fileBuffer);

      db.metrics.tamperAttemptsDetected = (db.metrics.tamperAttemptsDetected || 0) + 1;
      writeDb(db);

      addAuditLog('FILE_TAMPER_SIMULATED', {
        userId: req.user.id,
        username: req.user.username,
        fileId: file.id,
        fileName: file.originalName,
        details: 'Simulated unauthorized bit-flip tampering on raw ciphertext chunk to test SHA-256 / AES-GCM integrity defense.',
        status: 'WARNING',
        ip: req.ip
      });

      return res.json({
        message: 'Simulated tampering applied: Modified 1 byte in stored ciphertext payload.',
        tamperedFileId: file.id,
        sha256Expected: file.sha256Checksum
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to tamper file' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'HEALTHY', role: 'CLOUD_SERVER', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` [CLOUD SERVER] Central Node listening on port ${PORT}`);
  console.log(` Mode: Authoritative Metadata, Storage & Cryptographic Hub`);
  console.log(` Storage Path: ${UPLOADS_DIR}`);
  console.log(`=======================================================`);
});
