# test_backend.py
import urllib.request
import json
import subprocess
import time
import sys

def run_tests():
    print("Starting FastAPI backend process for local verification...")
    # Start uvicorn as a subprocess on port 8001 to avoid conflicts
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001"],
        cwd=".",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Wait for server to start (up to 10 seconds, polling every 0.5s)
    print("Waiting for uvicorn server to start...")
    started = False
    for i in range(20):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8001/api/assets", timeout=1) as response:
                if response.status == 200:
                    started = True
                    break
        except Exception:
            time.sleep(0.5)
            
    if not started:
        print("Server failed to start in time.")
        proc.terminate()
        sys.exit(1)
    
    try:
        # Test 1: Get Assets list
        print("Test 1: Fetching verified mining assets...")
        with urllib.request.urlopen("http://127.0.0.1:8001/api/assets") as response:
            data = json.loads(response.read().decode())
            print(f"  Received {len(data)} operations (Expected >= 200).")
            assert len(data) >= 200, "Assets database has fewer than 200 operations"
            print("  Test 1: PASSED")
            
        # Test 2: Get Spectral Data for Escondida
        print("Test 2: Fetching spectral data for Escondida Mine (-24.2694, -69.0736)...")
        url = "http://127.0.0.1:8001/api/spectral-data?lat=-24.2694&lng=-69.0736"
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            print(f"  Grid size: {data['width']}x{data['height']}")
            print(f"  Pixel count: {len(data['pixels'])}")
            print(f"  Telemetry: {data['telemetry']}")
            assert data['width'] == 100 and data['height'] == 100, "Incorrect grid dimensions"
            assert len(data['pixels']) == 10000, "Incorrect pixel count"
            assert data['telemetry']['nearest_asset_mineral'] == "Cu", "Failed to detect copper mine proximity"
            print("  Test 2: PASSED")
            
        print("\nAll backend integration tests completed successfully!")
    except Exception as e:
        print(f"\nVerification FAILED: {e}")
        # Print output of process
        out, err = proc.communicate(timeout=1)
        print("Stdout:\n", out.decode())
        print("Stderr:\n", err.decode())
        sys.exit(1)
    finally:
        print("Terminating test backend server...")
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    run_tests()
