from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app import models

from app.routers import auth
from app.routers import products
from app.routers import cart
from app.routers import orders
from app.routers import payments

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="StyleHub – Fashion Mini Store"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5173",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(payments.router)


@app.get("/")
def home():
    return {
        "message": "Welcome to StyleHub API"
    }
