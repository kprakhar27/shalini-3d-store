"""
Cloudflare R2 storage helpers (S3-compatible).

R2 has a 10 GB free tier with no billing setup required and is wire-compatible
with the AWS S3 API, so we drive it through boto3.

Public access pattern: enable the bucket's `*.r2.dev` URL in the Cloudflare
dashboard and put it in R2_PUBLIC_URL — files written by `upload_bytes` will
then be reachable at `{R2_PUBLIC_URL}/{key}` without any auth.
"""

import os
from functools import lru_cache

import boto3
from botocore.client import Config


@lru_cache(maxsize=1)
def _client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def _bucket() -> str:
    return os.environ["R2_BUCKET_NAME"]


def public_url(key: str) -> str:
    return f"{os.environ['R2_PUBLIC_URL'].rstrip('/')}/{key}"


def upload_bytes(key: str, data: bytes, content_type: str) -> str:
    """Upload bytes to R2 and return the public URL."""
    _client().put_object(
        Bucket=_bucket(),
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return public_url(key)


def presigned_put_url(key: str, content_type: str, expires_in: int = 600) -> str:
    """Generate a presigned PUT URL for direct browser upload."""
    return _client().generate_presigned_url(
        "put_object",
        Params={"Bucket": _bucket(), "Key": key, "ContentType": content_type},
        ExpiresIn=expires_in,
    )
