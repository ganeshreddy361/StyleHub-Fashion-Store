from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Cart, Order, OrderItem, Product, User
from app.auth import get_current_user

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("/")
def create_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cart_items = db.query(Cart).filter(
        Cart.user_id == current_user.id
    ).all()

    if not cart_items:
        raise HTTPException(
            status_code=400,
            detail="Your cart is empty"
        )

    order_items_data = []
    total_price = 0

    for cart_item in cart_items:
        product = db.query(Product).filter(
            Product.id == cart_item.product_id
        ).first()

        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product {cart_item.product_id} not found"
            )

        if cart_item.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Invalid cart quantity"
            )

        if product.stock < cart_item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for {product.name}"
            )

        item_total = product.price * cart_item.quantity
        total_price += item_total

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Cart, Order, OrderItem, Product, User
from app.auth import get_current_user

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("/")
def create_order(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cart_items = db.query(Cart).filter(
        Cart.user_id == current_user.id
    ).all()

    if not cart_items:
        raise HTTPException(
            status_code=400,
            detail="Your cart is empty"
        )

    order_items_data = []
    total_price = 0

    for cart_item in cart_items:
        product = db.query(Product).filter(
            Product.id == cart_item.product_id
        ).first()

        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product {cart_item.product_id} not found"
            )

        if cart_item.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Invalid cart quantity"
            )

        if product.stock < cart_item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for {product.name}"
            )

        item_total = product.price * cart_item.quantity
        total_price += item_total

        order_items_data.append({
            "product_id": product.id,
            "product_name": product.name,
            "price": product.price,
            "quantity": cart_item.quantity,
            "item_total": item_total
        })

    order = Order(
        user_id=current_user.id,
        total_price=total_price,
        status="pending"
    )

    db.add(order)
    db.flush()

    for item_data in order_items_data:
        db.add(OrderItem(
            order_id=order.id,
            product_id=item_data["product_id"],
            product_name=item_data["product_name"],
            price=item_data["price"],
            quantity=item_data["quantity"],
            item_total=item_data["item_total"]
        ))

    # Stock and cart are updated only after payment is verified.
    db.commit()
    db.refresh(order)

    return {
        "message": "Order created successfully",
        "order_id": order.id,
        "total_price": order.total_price,
        "status": order.status
    }


@router.get("/")
def get_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(Order.created_at.desc()).all()

    result = []

    for order in orders:
        items = db.query(OrderItem).filter(
            OrderItem.order_id == order.id
        ).all()

        result.append({
            "order_id": order.id,
            "total_price": order.total_price,
            "status": order.status,
            "created_at": order.created_at,
            "items": [
                {
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "price": item.price,
                    "quantity": item.quantity,
                    "item_total": item.item_total
                }
                for item in items
            ]
        })

    return {
        "user_id": current_user.id,
        "orders": result
    }


@router.get("/{order_id}")
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    items = db.query(OrderItem).filter(
        OrderItem.order_id == order.id
    ).all()

    return {
        "order_id": order.id,
        "total_price": order.total_price,
        "status": order.status,
        "created_at": order.created_at,
        "items": [
            {
                "product_id": item.product_id,
                "product_name": item.product_name,
                "price": item.price,
                "quantity": item.quantity,
                "item_total": item.item_total
            }
            for item in items
        ]
    }


@router.post("/{order_id}/cancel")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    if order.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only pending orders can be cancelled. "
                f"Current status: {order.status}"
            )
        )

    order.status = "cancelled"
    db.commit()
    db.refresh(order)

    return {
        "message": "Order cancelled successfully",
        "order_id": order.id,
        "status": order.status
    }

