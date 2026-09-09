const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5001;
const CLOUD_URL = process.env.CLOUD_URL || 'http://localhost:5000';
const CACHE_DIR = path.join(__dirname, 'cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Edge Telemetry State
const edgeStats = {
  cacheHits: 0,
  cacheMisses: 0,
  bandwidthServedFromEdge: 0,
  bandwidthFetchedFromCloud: 0,
  totalRequestsHandled: 0,
  latencyRecords: [], // { timestamp, fileId, route: 'EDGE_CACHE' | 'CLOUD_FETCH', latencyMs, sizeBytes }
  startTime: new Date().toISOString()
};

// Helper: Make HTTP request to Cloud Server
function forwardToCloud(req, res, targetPath, options = {}) {
  const parsedUrl = new URL(CLOUD_URL + (targetPath || req.url));
  
  const headers = { ...req.headers };
  delete headers.host;
  headers['x-forwarded-for'] = req.ip || '127.0.0.1';
  headers['x-edge-node'] = `edge-node-local-port-${PORT}`;

  const cloudReq = http.request(parsedUrl, {
    method: req.method,
    headers: headers,
    ...options
  }, (cloudRes) => {
    // Copy headers from cloud to client
    res.status(cloudRes.statusCode);
    Object.keys(cloudRes.headers).forEach(header => {
      res.setHeader(header, cloudRes.headers[header]);
    });
    res.setHeader('X-Edge-Served-By', `Edge-Gateway-${PORT}`);
    cloudRes.pipe(res);
  });

  cloudReq.on('error', (err) => {
    console.error('[Edge Gateway] Error connecting to Cloud Server:', err.message);
    res.status(502).json({
      error: 'Edge Gateway cannot reach Cloud Server at ' + CLOUD_URL,
      details: err.message
    });
  });

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    req.pipe(cloudReq);
  } else {
    cloudReq.end();
  }
}

// ----------------------------------------------------
// EDGE TELEMETRY & CACHE MANAGEMENT
// ----------------------------------------------------

app.get('/api/edge/telemetry', (req, res) => {
  const cachedFiles = fs.readdirSync(CACHE_DIR).map(filename => {
    const filePath = path.join(CACHE_DIR, filename);
    const stat = fs.statSync(filePath);
    return {
      filename,
      sizeBytes: stat.size,
      cachedAt: stat.mtime
    };
  });

  const totalHitMiss = edgeStats.cacheHits + edgeStats.cacheMisses;
  const hitRatio = totalHitMiss > 0 ? ((edgeStats.cacheHits / totalHitMiss) * 100).toFixed(1) : 0;

  res.json({
    nodeId: `edge-node-gateway-${PORT}`,
    status: 'ACTIVE',
    port: PORT,
    cloudUrl: CLOUD_URL,
    totalRequestsHandled: edgeStats.totalRequestsHandled,
    cacheHits: edgeStats.cacheHits,
    cacheMisses: edgeStats.cacheMisses,
    hitRatioPercentage: parseFloat(hitRatio),
    bandwidthServedFromEdgeBytes: edgeStats.bandwidthServedFromEdge,
    bandwidthFetchedFromCloudBytes: edgeStats.bandwidthFetchedFromCloud,
    cachedFilesCount: cachedFiles.length,
    cachedFiles,
    recentLatencyLogs: edgeStats.latencyRecords.slice(-20).reverse(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Clear Edge Cache
app.post('/api/edge/cache/clear', (req, res) => {
  const files = fs.readdirSync(CACHE_DIR);
  let count = 0;
  files.forEach(f => {
    try {
      fs.unlinkSync(path.join(CACHE_DIR, f));
      count++;
    } catch (e) {}
  });

  res.json({
    message: `Edge cache cleared successfully. Removed ${count} cached files.`,
    clearedCount: count
  });
});

// ----------------------------------------------------
// EDGE ACCELERATED FILE DOWNLOAD & CACHING PROXY
// ----------------------------------------------------

app.get('/api/edge/files/:fileId/download', (req, res) => {
  const startTime = Date.now();
  const fileId = req.params.fileId;
  const authHeader = req.headers['authorization'];
  edgeStats.totalRequestsHandled++;

  if (!authHeader) {
    return res.status(401).json({ error: 'Access token required for edge download' });
  }

  const cachedFilePath = path.join(CACHE_DIR, `${fileId}.enc`);
  const metaPath = path.join(CACHE_DIR, `${fileId}.meta.json`);

  // Check if file is available in Edge Cache
  if (fs.existsSync(cachedFilePath) && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const stat = fs.statSync(cachedFilePath);

      // Verify token/permissions against cloud or decode to ensure user matches
      const token = authHeader.split(' ')[1];
      const parsedCloudUrl = new URL(`${CLOUD_URL}/api/files/${fileId}`);
      
      // Quick permission check with cloud metadata
      const checkReq = http.request(parsedCloudUrl, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      }, (checkRes) => {
        let metaBody = '';
        checkRes.on('data', chunk => metaBody += chunk);
        checkRes.on('end', () => {
          if (checkRes.statusCode !== 200) {
            return res.status(checkRes.statusCode).json({ error: 'Permission check failed at Edge' });
          }

          const fileMeta = JSON.parse(metaBody);
          const latency = Date.now() - startTime;

          // Record Edge Cache Hit!
          edgeStats.cacheHits++;
          edgeStats.bandwidthServedFromEdge += stat.size;
          edgeStats.latencyRecords.push({
            timestamp: new Date().toISOString(),
            fileId,
            fileName: meta.originalName || fileId,
            route: 'EDGE_CACHE_HIT',
            latencyMs: latency,
            sizeBytes: stat.size
          });

          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${meta.originalName || fileId}.enc"`);
          res.setHeader('X-File-IV', meta.iv || fileMeta.iv);
          res.setHeader('X-File-AuthTag', meta.authTag || fileMeta.authTag || '');
          res.setHeader('X-File-Checksum', meta.sha256Checksum || fileMeta.sha256Checksum);
          res.setHeader('X-Encrypted-Key', fileMeta.userEncryptedKey || '');
          res.setHeader('X-Served-From', 'EDGE_CACHE');
          res.setHeader('X-Edge-Latency-Ms', latency);

          const stream = fs.createReadStream(cachedFilePath);
          stream.pipe(res);
        });
      });

      checkReq.on('error', () => {
        // If cloud offline, fallback to cached meta if secure
        res.status(503).json({ error: 'Cloud unreachable for permission validation' });
      });
      checkReq.end();
      return;

    } catch (e) {
      console.error('[Edge Cache Read Error]:', e);
      // Fall through to cloud fetch
    }
  }

  // Cache Miss: Fetch from Cloud Server and Cache at Edge
  edgeStats.cacheMisses++;
  const cloudDownloadUrl = new URL(`${CLOUD_URL}/api/files/${fileId}/download?route=EDGE_GATEWAY`);

  const cloudReq = http.request(cloudDownloadUrl, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'x-edge-gateway': 'active'
    }
  }, (cloudRes) => {
    if (cloudRes.statusCode !== 200) {
      res.status(cloudRes.statusCode);
      return cloudRes.pipe(res);
    }

    const iv = cloudRes.headers['x-file-iv'];
    const authTag = cloudRes.headers['x-file-authtag'] || '';
    const sha256Checksum = cloudRes.headers['x-file-checksum'];
    const encryptedKey = cloudRes.headers['x-encrypted-key'];
    const disposition = cloudRes.headers['content-disposition'] || '';

    // Extract filename from disposition
    const filenameMatch = disposition.match(/filename="(.+)"/);
    const originalEncName = filenameMatch ? filenameMatch[1] : `${fileId}.enc`;

    // Pipe response directly to client AND write to Edge cache simultaneously
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('X-File-IV', iv || '');
    res.setHeader('X-File-AuthTag', authTag || '');
    res.setHeader('X-File-Checksum', sha256Checksum || '');
    res.setHeader('X-Encrypted-Key', encryptedKey || '');
    res.setHeader('X-Served-From', 'CLOUD_VIA_EDGE_PROXY');

    const cacheWriteStream = fs.createWriteStream(cachedFilePath);
    let bytesDownloaded = 0;

    cloudRes.on('data', chunk => {
      bytesDownloaded += chunk.length;
      res.write(chunk);
      cacheWriteStream.write(chunk);
    });

    cloudRes.on('end', () => {
      res.end();
      cacheWriteStream.end();

      const latency = Date.now() - startTime;
      edgeStats.bandwidthFetchedFromCloud += bytesDownloaded;
      edgeStats.latencyRecords.push({
        timestamp: new Date().toISOString(),
        fileId,
        fileName: originalEncName,
        route: 'EDGE_CACHE_MISS_CLOUD_FETCH',
        latencyMs: latency,
        sizeBytes: bytesDownloaded
      });

      // Save metadata for future Edge Cache hits
      fs.writeFileSync(metaPath, JSON.stringify({
        fileId,
        originalName: originalEncName.replace(/\.enc$/, ''),
        iv,
        authTag,
        sha256Checksum,
        cachedAt: new Date().toISOString()
      }, null, 2));
    });
  });

  cloudReq.on('error', (err) => {
    console.error('[Edge Gateway] Error downloading from Cloud:', err.message);
    res.status(502).json({ error: 'Failed to stream from Cloud server', details: err.message });
  });

  cloudReq.end();
});

// ----------------------------------------------------
// PROXY ALL OTHER REQUESTS TRANSPARENTLY TO CLOUD
// ----------------------------------------------------

app.all('*', (req, res) => {
  forwardToCloud(req, res, req.url);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` [EDGE SERVER] Edge Gateway listening on port ${PORT}`);
  console.log(` Mode: Edge Caching, Cryptographic Gateway & Proxy`);
  console.log(` Target Cloud URL: ${CLOUD_URL}`);
  console.log(` Cache Path: ${CACHE_DIR}`);
  console.log(`=======================================================`);
});
