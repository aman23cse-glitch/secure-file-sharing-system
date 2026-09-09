# Secure File Sharing System Between Cloud and Edge

[![Security: AES-256-GCM](https://img.shields.io/badge/Security-AES--256--GCM-blue.svg)](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)
[![Asymmetric: RSA-2048](https://img.shields.io/badge/Key%20Exchange-RSA--2048%20OAEP-indigo.svg)](https://en.wikipedia.org/wiki/RSA_(cryptosystem))
[![Integrity: SHA-256](https://img.shields.io/badge/Integrity-SHA--256-emerald.svg)](https://en.wikipedia.org/wiki/SHA-2)
[![Auth: JWT](https://img.shields.io/badge/Authentication-JWT-cyan.svg)](https://jwt.io/)
[![Architecture: Cloud & Edge](https://img.shields.io/badge/Architecture-Cloud%20%2B%20Edge%20Hybrid-orange.svg)]()

A complete, production-grade, distributed **Secure File Sharing System Between Cloud and Edge**. Designed specifically to solve the security, data privacy, tampering, and high-latency challenges found in centralized cloud storage by integrating **hybrid cryptography (AES-256 + RSA-2048)** with **localized edge computing gateways**.

---

## 1. System Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                                CLIENT APPLICATION                                 |
|  - Web UI Dashboard (React 19 + Tailwind CSS + Lucide Icons)                     |
|  - Web Crypto Engine (AES-256-GCM, RSA-2048/4096 Keypair, SHA-256 Checksum)      |
|  - User Auth (JWT), File Vault, Share Manager, Telemetry & Audit Viewer           |
+----------------------------------------+------------------------------------------+
                                         |
                     +-------------------+-------------------+
                     | (Edge-Optimized Route)                | (Direct Cloud Route)
                     v                                       v
+----------------------------------------+   +--------------------------------------+
|            EDGE GATEWAY NODE           |   |             CLOUD SERVER             |
|  (Port: 5001 - Low Latency Perimeter)  |   |  (Port: 5000 - Central Scalable Hub) |
|  - Local Encrypted File Cache          |   |  - Central Metadata & User DB        |
|  - Cache Hit / Miss Analytics Engine   |   |  - Authoritative Encrypted Storage   |
|  - Latency Optimization & Offloading   |-->|  - RSA Public Key Registry           |
|  - Proxy & Token Verification          |   |  - Granular Access Control (ACL/JWT) |
|  - File Integrity Hash Verification    |   |  - Security & Audit Event Logs       |
+----------------------------------------+   +--------------------------------------+
```

---

## 2. Cryptographic Security Model

### A. Symmetrical Payload Encryption (AES-256-GCM)
- Every file uploaded generates a fresh, ephemeral **256-bit AES key** and a random **96-bit (12-byte) Initialization Vector (IV)**.
- Encrypted using **Galois/Counter Mode (GCM)**, providing both authenticated encryption and high-throughput symmetric processing.

### B. Asymmetric Key Management (RSA-OAEP 2048-bit)
- Each user receives an RSA-2048 public/private keypair upon registration.
- The **Private Key** is stored exclusively on the client device (zero-knowledge).
- The **Public Key** is stored in the Cloud Key Directory.
- When saving or sharing a file, the AES session key is wrapped (encrypted) with the recipient's RSA public key using Optimal Asymmetric Encryption Padding (OAEP).

### C. File Integrity Verification (SHA-256)
- Plaintext files are hashed with **SHA-256** prior to encryption.
- Upon retrieval and decryption, the hash is recomputed and compared with the expected digest.
- Any unauthorized bit modifications or tampering in cloud/edge storage are immediately intercepted and rejected.

### D. Identity & Access Control (JWT & ACL)
- Stateless authentication using **JSON Web Tokens (JWT)**.
- Granular permissions (Owner, Read, Download, Revoke).

---

## 3. Cloud vs. Edge Synergy

| Dimension | Central Cloud Server (Port 5000) | Edge Gateway Node (Port 5001) |
| :--- | :--- | :--- |
| **Role** | Central authoritative data & user registry | Low-latency local proximity cache |
| **Storage** | Permanent encrypted chunk vault | Transient LRU encrypted file cache |
| **Latency** | Typical WAN roundtrip (50ms - 150ms) | Local proximity latency (2ms - 15ms) |
| **Security** | Zero-knowledge (only stores ciphertext) | Zero-knowledge (only caches ciphertext) |
| **Bandwidth** | Scalable long-term capacity | Reduces WAN traffic by serving local hits |

---

## 4. Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.8+)

### Running with 1-Click Orchestrator
To start all services (Cloud Server, Edge Gateway, and Frontend) simultaneously:

```bash
# In Windows Powershell / Command Prompt:
python start.py
```
*(Or double-click `start.bat` on Windows)*

The script will automatically install any missing dependencies and open your browser at `http://localhost:3000`.

---

## 5. Step-by-Step Evaluation & Demo Guide

### Test 1: User Registration & RSA Keypair Generation
1. Open `http://localhost:3000`.
2. Click **"Register New User"** or click one of the quick demo buttons (e.g. `@alice`).
3. Enter credentials and click **"Generate Keypair & Register"**.
4. Observe the client-side generation of the 2048-bit RSA keypair and local storage persistence.

### Test 2: Client-Side Encrypted File Upload
1. In the **File Vault** tab, drag and drop any file (e.g. PDF, image, text document).
2. Observe the real-time cryptographic pipeline:
   - SHA-256 calculation -> AES-256-GCM encryption -> RSA public key wrapping -> Upload to storage.
3. Verify that raw plaintext is never sent over the network.

### Test 3: Edge Caching & Latency Speedup
1. Toggle the route selector in the top bar to **"Edge Node (Port 5001)"**.
2. Download the uploaded file:
   - **First Request (Cache Miss)**: Edge fetches from Cloud and caches locally.
   - **Second Request (Cache Hit)**: Edge serves directly from cache in ~5-10ms!
3. Open the **"Edge Telemetry & Speed"** tab to view live latency comparisons, cache hit ratio, and bandwidth savings.

### Test 4: Zero-Knowledge Multi-User Sharing
1. Log in as `@alice` and upload a file.
2. Click the **Share** button next to the file.
3. Select `@bob` and click **"Encrypt AES Key & Grant Permission"**.
   - Alice's client unwraps the AES session key and re-encrypts it with Bob's RSA public key.
4. Log out and sign in as `@bob`.
5. Bob now sees the shared file, can decrypt it with Bob's private key, and download the exact plaintext file!

### Test 5: Interactive Tamper Defense Lab
1. Go to the **"Integrity Defense Lab"** tab.
2. Select a file and click **"Simulate 1-Byte Storage Bit-Flip"** (corrupts 1 byte of ciphertext on disk).
3. Click **"Download & Run Integrity Defense Verification"**.
4. Observe how the AES-GCM MAC tag and SHA-256 checksum immediately intercept the attack and block corrupted data from reaching the user.

---

## 6. Directory Structure

```
secure-cloud-edge-fileshare/
├── backend/
│   ├── cloud-server/
│   │   ├── package.json
│   │   ├── server.js          # Authoritative Cloud Hub (Port 5000)
│   │   ├── db.js              # Database & Audit Logger
│   │   └── uploads/           # Stored encrypted chunks (.enc)
│   └── edge-server/
│       ├── package.json
│       ├── server.js          # Edge Gateway & Cache (Port 5001)
│       └── cache/             # Cached encrypted files
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx            # Main SPA orchestrator
│       ├── utils/
│       │   ├── crypto.js      # AES-256-GCM, RSA-OAEP, SHA-256 Web Crypto
│       │   └── api.js         # Multi-node API client with latency tracking
│       └── components/
│           ├── Navbar.jsx
│           ├── AuthModal.jsx
│           ├── FileVault.jsx
│           ├── ShareModal.jsx
│           ├── TelemetryDashboard.jsx
│           ├── SecurityAuditLog.jsx
│           ├── TamperDemo.jsx
│           └── ArchitectureInfo.jsx
├── start.py                   # Unified multi-node launcher
├── start.bat                  # Windows 1-click starter
├── package.json
└── README.md
```

---

## 7. License
MIT License. Created for Secure Distributed Cloud-Edge Research & Engineering.
#   s e c u r e - f i l e - s h a r i n g - s y s t e m  
 