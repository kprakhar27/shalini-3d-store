import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers import generation, products, categories, storage

load_dotenv()

app = FastAPI(title="Shalini 3D Store API")

origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router,    prefix="/products",    tags=["products"])
app.include_router(categories.router,  prefix="/categories",  tags=["categories"])
app.include_router(storage.router,     prefix="/storage",     tags=["storage"])
app.include_router(generation.router,                         tags=["generation"])


@app.get("/health")
def health():
    return {"status": "ok"}
