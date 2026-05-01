"""Create or reset the demo admin Firebase Auth user shown in the AI panel.

Uses the Identity Toolkit REST API directly (firebase-admin's auth client
hangs on certain networks; the REST endpoints don't have that issue).
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GAR
from dotenv import load_dotenv

load_dotenv()

EMAIL    = "testuser@test.com"
PASSWORD = "test1234"

# Service-account creds → access token for Identity Toolkit
creds = service_account.Credentials.from_service_account_info(
    {
        "type":         "service_account",
        "project_id":   os.environ["FIREBASE_PROJECT_ID"],
        "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
        "private_key":  os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n"),
        "token_uri":    "https://oauth2.googleapis.com/token",
    },
    scopes=[
        "https://www.googleapis.com/auth/cloud-platform",
        "https://www.googleapis.com/auth/firebase",
    ],
)
creds.refresh(GAR())
print(f"✓ Got admin OAuth token")

project = os.environ["FIREBASE_PROJECT_ID"]
base = f"https://identitytoolkit.googleapis.com/v1/projects/{project}"
headers = {
    "Authorization": f"Bearer {creds.token}",
    "Content-Type":  "application/json",
}

with httpx.Client(timeout=30) as client:
    # Look up existing user by email
    lookup = client.post(
        f"{base}/accounts:lookup",
        headers=headers,
        json={"email": [EMAIL]},
    )
    lookup.raise_for_status()
    existing = lookup.json().get("users", [])

    if existing:
        uid = existing[0]["localId"]
        update = client.post(
            f"{base}/accounts:update",
            headers=headers,
            json={"localId": uid, "password": PASSWORD},
        )
        update.raise_for_status()
        print(f"✓ Reset password on existing user  uid={uid}  email={EMAIL}")
    else:
        create = client.post(
            f"{base}/accounts",
            headers=headers,
            json={
                "email":         EMAIL,
                "password":      PASSWORD,
                "emailVerified": True,
            },
        )
        create.raise_for_status()
        body = create.json()
        print(f"✓ Created user  uid={body.get('localId')}  email={EMAIL}")

print(f"  → admin login: http://localhost:5173/admin/login")
