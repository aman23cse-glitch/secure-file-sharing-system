const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

// Initialize database schema if not present
function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [],
      files: [],
      auditLogs: [],
      metrics: {
        totalUploads: 0,
        totalDownloads: 0,
        bytesTransferred: 0,
        tamperAttemptsDetected: 0
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading database file:', err);
    return { users: [], files: [], auditLogs: [], metrics: {} };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

function addAuditLog(eventType, { userId, username, fileId, fileName, ip, route, details, status = 'SUCCESS' }) {
  const db = readDb();
  const logEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    eventType,
    userId: userId || 'anonymous',
    username: username || 'anonymous',
    fileId: fileId || null,
    fileName: fileName || null,
    ip: ip || '127.0.0.1',
    route: route || 'CLOUD_DIRECT',
    details: details || '',
    status
  };
  db.auditLogs.unshift(logEntry);
  // Keep last 500 logs
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  writeDb(db);
  return logEntry;
}

module.exports = {
  initDb,
  readDb,
  writeDb,
  addAuditLog
};
