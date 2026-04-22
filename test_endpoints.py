import requests
import json

BASE_URL = "https://marketing-automation-xtd2.onrender.com"
LOCAL_URL = "http://localhost:8000"

def test_endpoint(url, endpoint, method="GET", payload=None):
    full_url = f"{url}{endpoint}"
    print(f"\nTesting {method} {full_url}...")
    try:
        if method == "GET":
            resp = requests.get(full_url, timeout=10)
        else:
            resp = requests.post(full_url, json=payload, timeout=10)
        
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            print("Response Sample:")
            print(json.dumps(resp.json(), indent=2)[:500] + "...")
        else:
            print(f"Error: {resp.text}")
    except Exception as e:
        print(f"Connection Failed: {e}")

print("--- TESTING RENDER PRODUCTION ---")
test_endpoint(BASE_URL, "/api/companies/")
test_endpoint(BASE_URL, "/api/emails/generate", method="POST", payload={"recipient_email": "test@example.com"})

print("\n--- TESTING LOCAL BACKEND (If running) ---")
test_endpoint(LOCAL_URL, "/api/companies/")
test_endpoint(LOCAL_URL, "/api/emails/generate", method="POST", payload={"recipient_email": "test@example.com"})
