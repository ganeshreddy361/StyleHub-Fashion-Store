from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product
from app.auth import get_current_user


router = APIRouter(
    prefix="/products",
    tags=["Products"]
)


# CREATE PRODUCT
@router.post("/")
def create_product(
    name: str,
    description: str,
    price: int,
    stock: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if price < 0:
        raise HTTPException(
            status_code=400,
            detail="Price cannot be negative"
        )

    if stock < 0:
        raise HTTPException(
            status_code=400,
            detail="Stock cannot be negative"
        )

    product = Product(
        name=name,
        description=description,
        price=price,
        stock=stock
    )

    db.add(product)
    db.commit()
    db.refresh(product)

    return product


# GET ALL PRODUCTS
@router.get("/")
def get_products(
    db: Session = Depends(get_db)
):
    return db.query(Product).all()


# GET SINGLE PRODUCT
@router.get("/{product_id}")
def get_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    return product
