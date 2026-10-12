from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Cart, Product, User
from app.auth import get_current_user

router = APIRouter(
    prefix="/cart",
    tags=["Cart"]
)


# ADD PRODUCT TO CART
@router.post("/")
def add_to_cart(
    product_id: int,
    quantity: int = 1,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0"
        )

    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    if product.stock < quantity:
        raise HTTPException(
            status_code=400,
            detail="Not enough stock available"
        )

    existing_item = db.query(Cart).filter(
        Cart.user_id == current_user.id,
        Cart.product_id == product_id
    ).first()

    if existing_item:
        new_quantity = existing_item.quantity + quantity

        if new_quantity > product.stock:
            raise HTTPException(
                status_code=400,
                detail="Not enough stock available"
            )

        existing_item.quantity = new_quantity
        cart_item = existing_item

    else:
        cart_item = Cart(
            user_id=current_user.id,
            product_id=product_id,
            quantity=quantity
        )

        db.add(cart_item)

    db.commit()
    db.refresh(cart_item)

    return {
        "message": "Product added to cart",
        "cart_id": cart_item.id,
        "product_id": cart_item.product_id,
        "quantity": cart_item.quantity
    }


# VIEW MY CART
@router.get("/")
def get_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cart_items = db.query(Cart).filter(
        Cart.user_id == current_user.id
    ).all()

    items = []
    total_price = 0

    for item in cart_items:
        product = db.query(Product).filter(
            Product.id == item.product_id
        ).first()

        if product:
            item_total = product.price * item.quantity
            total_price += item_total

            items.append({
                "cart_id": item.id,
                "product_id": product.id,
                "name": product.name,
                "price": product.price,
                "quantity": item.quantity,
                "item_total": item_total
            })

    return {
        "user_id": current_user.id,
        "items": items,
        "total_price": total_price
    }


# UPDATE CART QUANTITY
@router.put("/{cart_id}")
def update_cart(
    cart_id: int,
    quantity: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0"
        )

    cart_item = db.query(Cart).filter(
        Cart.id == cart_id,
        Cart.user_id == current_user.id
    ).first()

    if not cart_item:
        raise HTTPException(
            status_code=404,
            detail="Cart item not found"
        )

    product = db.query(Product).filter(
        Product.id == cart_item.product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    if quantity > product.stock:
        raise HTTPException(
            status_code=400,
            detail="Not enough stock available"
        )

    cart_item.quantity = quantity

    db.commit()
    db.refresh(cart_item)

    return {
        "message": "Cart updated successfully",
        "cart_id": cart_item.id,
        "quantity": cart_item.quantity
    }


# REMOVE PRODUCT FROM CART
@router.delete("/{cart_id}")
def remove_from_cart(
    cart_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cart_item = db.query(Cart).filter(
        Cart.id == cart_id,
        Cart.user_id == current_user.id
    ).first()

    if not cart_item:
        raise HTTPException(
            status_code=404,
            detail="Cart item not found"
        )

    db.delete(cart_item)
    db.commit()

    return {
        "message": "Product removed from cart"
    }
