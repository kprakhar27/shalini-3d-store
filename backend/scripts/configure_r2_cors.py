"""Set the bucket CORS rules so the browser can PUT to presigned URLs.

R2 (S3-compatible) only allows browser uploads from origins listed here.
Run once after creating the bucket; re-run anytime the dev/prod origins change.
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from app.services import r2

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    # add your production storefront origin(s) here, e.g. "https://your-domain.com"
]

cors = {
    "CORSRules": [
        {
            "AllowedOrigins": ALLOWED_ORIGINS,
            "AllowedMethods": ["GET", "PUT", "HEAD"],
            "AllowedHeaders": ["*"],
            "ExposeHeaders":  ["ETag"],
            "MaxAgeSeconds":  3600,
        }
    ]
}

bucket = r2._bucket()
client = r2._client()

client.put_bucket_cors(Bucket=bucket, CORSConfiguration=cors)
print(f"✓ Updated CORS on bucket '{bucket}'.")
print("  Allowed origins:")
for o in ALLOWED_ORIGINS:
    print(f"    - {o}")

# Read it back to confirm.
got = client.get_bucket_cors(Bucket=bucket)
print(f"\n  → Bucket reports {len(got.get('CORSRules', []))} rule(s).")
