#!/usr/bin/env python3
"""
Secure File Sharing System Between Cloud and Edge - Orchestrator & Launcher
Spawns Cloud Server (5000), Edge Gateway Node (5001), and Vite Frontend (3000).
"""

import os
import sys
import subprocess
import time
import webbrowser
import threading

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
CLOUD_DIR = os.path.join(BASE_DIR, "backend", "cloud-server")
EDGE_DIR = os.path.join(BASE_DIR, "backend", "edge-server")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

processes = []

def run_npm_install(directory, name):
    node_modules = os.path.join(directory, "node_modules")
    if not os.path.exists(node_modules):
        print(f"[*] Installing dependencies for {name}...")
        cmd = "npm.cmd install" if sys.platform == "win32" else "npm install"
        subprocess.run(cmd, shell=True, cwd=directory, check=True)
        print(f"[+] Dependencies installed for {name}.")

def stream_logs(process, prefix):
    try:
        for line in iter(process.stdout.readline, ''):
            if line:
                print(f"[{prefix}] {line.strip()}")
    except Exception:
        pass

def main():
    print("=" * 70)
    print(" SECURE FILE SHARING SYSTEM BETWEEN CLOUD AND EDGE")
    print(" Cryptography: AES-256-GCM | RSA-OAEP 2048-bit | SHA-256 | JWT")
    print("=" * 70)

    # 1. Ensure dependencies are installed
    run_npm_install(CLOUD_DIR, "Cloud Server")
    run_npm_install(EDGE_DIR, "Edge Gateway Node")
    run_npm_install(FRONTEND_DIR, "Frontend Application")

    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"

    # 2. Launch Cloud Server (Port 5000)
    print("\n[*] Starting Central Cloud Server on port 5000...")
    cloud_proc = subprocess.Popen(
        f"{npm_cmd} start",
        shell=True,
        cwd=CLOUD_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    processes.append(cloud_proc)
    threading.Thread(target=stream_logs, args=(cloud_proc, "CLOUD-5000"), daemon=True).start()

    # 3. Launch Edge Gateway Node (Port 5001)
    print("[*] Starting Edge Gateway Node on port 5001...")
    edge_proc = subprocess.Popen(
        f"{npm_cmd} start",
        shell=True,
        cwd=EDGE_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    processes.append(edge_proc)
    threading.Thread(target=stream_logs, args=(edge_proc, "EDGE-5001"), daemon=True).start()

    # Wait 2 seconds for backends to boot
    time.sleep(2)

    # 4. Launch Frontend (Port 3000)
    print("[*] Starting Frontend Vite App on port 3000...")
    frontend_proc = subprocess.Popen(
        f"{npm_cmd} run dev",
        shell=True,
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    processes.append(frontend_proc)
    threading.Thread(target=stream_logs, args=(frontend_proc, "FRONTEND-3000"), daemon=True).start()

    print("\n" + "=" * 70)
    print(" SYSTEM IS READY AND RUNNING!")
    print(" - Web UI Dashboard:     http://localhost:3000")
    print(" - Edge Gateway API:     http://localhost:5001")
    print(" - Central Cloud API:    http://localhost:5000")
    print("=" * 70)
    print(" Press Ctrl+C at any time to gracefully stop all nodes.\n")

    time.sleep(2)
    try:
        webbrowser.open("http://localhost:3000")
    except Exception:
        pass

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Stopping all system nodes...")
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        print("[+] All services stopped cleanly.")

if __name__ == "__main__":
    main()
