import os
import stripe

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Cart, Order, OrderItem, Product, User

load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(prefix="/payments", tags=["Payments"])


class PaymentConfirmation(BaseModel):
    payment_intent_id: str


@router.post("/create-payment-intent/{order_id}")
def create_payment_intent(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not stripe.api_key:
        raise HTTPException(
            status_code=500,
            detail="Stripe secret key is not configured"
        )

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == "paid":
        raise HTTPException(
            status_code=400,
            detail="Order is already paid"
        )

    if order.total_price <= 0:
        raise HTTPException(
            status_code=400,
            detail="Order amount must be greater than zero"
        )

    items = db.query(OrderItem).filter(
        OrderItem.order_id == order.id
    ).all()

    if not items:
        raise HTTPException(
            status_code=400,
            detail="Cannot pay for an empty order"
        )

    try:
        payment_intent = stripe.PaymentIntent.create(
            amount=order.total_price * 100,
            currency="inr",
            metadata={
                "order_id": str(order.id),
                "user_id": str(current_user.id)
            }
        )

        return {
            "message": "PaymentIntent created successfully",
            "order_id": order.id,
            "amount": order.total_price,
            "currency": "inr",
            "payment_intent_id": payment_intent.id,
            "client_secret": payment_intent.client_secret
        }

    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Stripe could not create the payment. Please try again."
        ) from exc


@router.post("/confirm-payment/{order_id}")
def confirm_payment(
    order_id: int,
    confirmation: PaymentConfirmation,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not stripe.api_key:
        raise HTTPException(
            status_code=500,
            detail="Stripe secret key is not configured"
        )

    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        payment_intent = stripe.PaymentIntent.retrieve(
            confirmation.payment_intent_id
        )
    except stripe.error.StripeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Unable to verify payment with Stripe"
        ) from exc

    if payment_intent.status != "succeeded":
        raise HTTPException(
            status_code=400,
            detail="Stripe has not confirmed a successful payment"
        )

    if (
        payment_intent["metadata"]["order_id"] != str(order.id)
        or payment_intent["metadata"]["user_id"] != str(current_user.id)
        or payment_intent.amount != order.total_price * 100
        or payment_intent.currency.lower() != "inr"
    ):
        raise HTTPException(
            status_code=400,
            detail="Payment details do not match this order"
        )

    # Repeated confirmation must never reduce stock twice.
    if order.status == "paid":
        return {
            "message": "Payment was already confirmed",
            "order_id": order.id,
            "status": "paid"
        }

    items = db.query(OrderItem).filter(
        OrderItem.order_id == order.id
    ).all()

    if not items:
        raise HTTPException(
            status_code=400,
            detail="Order contains no items"
        )

    # Check all inventory before changing any stock.
    products = {}

    for item in items:
        product = db.query(Product).filter(
            Product.id == item.product_id
        ).first()

        if not product:
            raise HTTPException(
                status_code=409,
                detail=f"Product {item.product_id} no longer exists"
            )

        if product.stock < item.quantity:
            raise HTTPException(
                status_code=409,
                detail=f"Insufficient stock for {item.product_name}. Contact support."
            )

        products[item.product_id] = product

    try:
        # Apply stock changes once, after Stripe verification.
        for item in items:
            products[item.product_id].stock -= item.quantity

            # Remove only the purchased quantity from this user's cart.
            cart_item = db.query(Cart).filter(
                Cart.user_id == current_user.id,
                Cart.product_id == item.product_id
            ).first()

            if cart_item:
                if cart_item.quantity <= item.quantity:
                    db.delete(cart_item)
                else:
                    cart_item.quantity -= item.quantity

        order.status = "paid"
        db.commit()
        db.refresh(order)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not finalize the order. Please contact support."
        )

    return {
        "message": "Payment verified and order updated successfully",
        "order_id": order.id,
        "status": order.status
    }
