
import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import "./index.css";

const API_URL = "http://127.0.0.1:8000";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

function PaymentForm({ orderId, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handlePayment(event) {
    event.preventDefault();

    if (!stripe || !elements || processing) return;

    setProcessing(true);
    setErrorMessage("");

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setErrorMessage(result.error.message);
        return;
      }

      if (
        result.paymentIntent &&
        result.paymentIntent.status === "succeeded"
      ) {
        await onSuccess(result.paymentIntent.id);
      } else {
        setErrorMessage(
          "Payment was not completed. Please try again."
        );
      }
    } catch (error) {
      console.error("Payment error:", error);
      setErrorMessage("Unable to process payment. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handlePayment} className="payment-form">
      <h2>Secure Checkout</h2>
      <p>Order #{orderId}</p>
      <PaymentElement />

      {errorMessage && (
        <div className="payment-error">{errorMessage}</div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || processing}
      >
        {processing ? "Processing..." : "Pay Now"}
      </button>
    </form>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(null);
  const [orders, setOrders] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(
    localStorage.getItem("token")
  );
  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  async function loadProducts() {
    try {
      const response = await fetch(`${API_URL}/products/`);
      const data = await response.json();

      if (response.ok) {
        setProducts(data);
      }
    } catch (error) {
      console.error("Products error:", error);
      setMessage("Unable to load products.");
    }
  }

  async function loadCart(currentToken = token) {
    if (!currentToken) {
      setCart(null);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/cart/`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setCart(data);
      } else {
        setCart(null);
      }
    } catch (error) {
      console.error("Cart error:", error);
    }
  }

  async function loadOrders(currentToken = token) {
    if (!currentToken) {
      setOrders([]);
      return;
    }

    setOrdersLoading(true);

    try {
      const response = await fetch(`${API_URL}/orders/`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setOrders(data.orders || []);
      } else {
        setMessage(data.detail || "Unable to load orders.");
      }
    } catch (error) {
      console.error("Orders error:", error);
      setMessage("Unable to load order history.");
    } finally {
      setOrdersLoading(false);
    }
  }

  async function login(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const formData = new URLSearchParams();
    formData.append("grant_type", "password");
    formData.append("username", email);
    formData.append("password", password);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Login failed.");
        return;
      }

      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      setPassword("");
      setMessage("Login successful!");

      await Promise.all([
        loadCart(data.access_token),
        loadOrders(data.access_token),
      ]);
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Unable to connect to backend.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setToken(null);
    setCart(null);
    setOrders([]);
    setCheckoutOpen(false);
    setClientSecret("");
    setPaymentSuccess(false);
    setMessage("Logged out successfully.");
  }

  async function addToCart(productId) {
    if (!token) {
      setMessage("Please login first.");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/cart/?product_id=${productId}&quantity=1`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Unable to add product.");
        return;
      }

      setMessage("Product added to cart.");
      await loadCart();
    } catch (error) {
      console.error("Add cart error:", error);
      setMessage("Unable to connect to backend.");
    }
  }

  async function removeFromCart(cartId) {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/cart/${cartId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Unable to remove item.");
        return;
      }

      setMessage("Product removed from cart.");
      await loadCart();
    } catch (error) {
      console.error("Remove cart error:", error);
      setMessage("Unable to connect to backend.");
    }
  }

  async function cancelOrder(targetOrderId) {
    if (!token || cancellingOrderId !== null) return;

    const order = orders.find(
      (item) => item.order_id === targetOrderId
    );

    if (!order || String(order.status).toLowerCase() !== "pending") {
      setMessage("Only pending orders can be cancelled.");
      return;
    }

    const confirmed = window.confirm(
      `Cancel Order #${targetOrderId}? This cannot be undone.`
    );

    if (!confirmed) return;

    setCancellingOrderId(targetOrderId);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/orders/${targetOrderId}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Unable to cancel order.");
        return;
      }

      setMessage(`Order #${targetOrderId} has been cancelled.`);
      await loadOrders(token);
    } catch (error) {
      console.error("Cancel order error:", error);
      setMessage("Unable to cancel order. Please try again.");
    } finally {
      setCancellingOrderId(null);
    }
  }

  async function startCheckout() {
    if (!token) {
      setMessage("Please login first.");
      return;
    }

    if (!cart?.items?.length) {
      setMessage("Your cart is empty.");
      return;
    }

    setLoading(true);
    setMessage("");
    setPaymentSuccess(false);

    try {
      const orderResponse = await fetch(`${API_URL}/orders/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        setMessage(orderData.detail || "Unable to create order.");
        return;
      }

      const newOrderId = orderData.order_id;
      setOrderId(newOrderId);
      await loadOrders(token);

      const paymentResponse = await fetch(
        `${API_URL}/payments/create-payment-intent/${newOrderId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok) {
        setMessage(
          paymentData.detail || "Unable to start payment."
        );
        await loadOrders(token);
        return;
      }

      setClientSecret(paymentData.client_secret);
      setCheckoutOpen(true);
    } catch (error) {
      console.error("Checkout error:", error);
      setMessage("Unable to connect to payment service.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePaymentSuccess(paymentIntentId) {
    try {
      const response = await fetch(
        `${API_URL}/payments/confirm-payment/${orderId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            payment_intent_id: paymentIntentId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          "Payment may have succeeded, but order confirmation failed. " +
            (data.detail ||
              "Please contact support before trying to pay again.")
        );
        setCheckoutOpen(false);
        setClientSecret("");
        await loadOrders(token);
        return;
      }

      setPaymentSuccess(true);
      setCheckoutOpen(false);
      setClientSecret("");
      setMessage("Payment successful! Your order has been placed.");

      await Promise.all([
        loadCart(token),
        loadOrders(token),
        loadProducts(),
      ]);
    } catch (error) {
      console.error("Payment verification error:", error);
      setMessage(
        "Payment may have succeeded, but we could not verify the order. " +
          "Please contact support before trying to pay again."
      );
      setCheckoutOpen(false);
      setClientSecret("");
      await loadOrders(token);
    }
  }

  useEffect(() => {
    loadProducts();

    if (token) {
      loadCart(token);
      loadOrders(token);
    }
    // Load initial data on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const imageByProductName = {
    "Oversized Black T-Shirt":
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=85",
    "Classic White T-Shirt":
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=700&q=85",
    "Casual Denim Jacket":
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=700&q=85",
    "Slim Fit Jeans":
      "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=700&q=85",
    "White Everyday Sneakers":
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85",
    "Urban Backpack":
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=85",
    "Minimal Black Hoodie":
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=700&q=85",
    "Classic Baseball Cap":
      "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=700&q=85",
  };

  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">StyleHub</div>
        <nav>
          <a href="#home">Home</a>
          <a href="#products">Products</a>
          <a href="#cart">Cart</a>
          {token && <a href="#orders">My Orders</a>}
          {token ? (
            <button className="nav-button" onClick={logout}>
              Logout
            </button>
          ) : (
            <a href="#login">Login</a>
          )}
        </nav>
      </header>

      {message && (
        <div className="message" role="status">
          {message}
        </div>
      )}

      <section id="home" className="hero">
        <div className="hero-content">
          <p className="hero-small">STYLEHUB</p>
          <h1>Discover Your Style</h1>
          <p>
            Trendy fashion. Premium quality.
            Everything you need in one place.
          </p>
          <a href="#products" className="shop-button">
            Shop Now
          </a>
        </div>
      </section>

      {!token && (
        <section id="login" className="login-section">
          <div className="login-card">
            <h2>Welcome Back</h2>
            <p>Login to access your StyleHub cart and orders.</p>
            <form onSubmit={login}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
          </div>
        </section>
      )}

      <section id="products" className="products-section">
        <div className="section-heading">
          <p>OUR COLLECTION</p>
          <h2>Featured Products</h2>
        </div>

        <div className="product-grid">
          {products.length === 0 ? (
            <p>No products available right now.</p>
          ) : (
            products.map((product) => (
              <div className="product-card" key={product.id}>
                <div className="product-image">
                  <img
                    src={
                      product.image_url ||
                      imageByProductName[product.name] ||
                      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=700&q=85"
                    }
                    alt={product.name}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src =
                        "https://placehold.co/600x750/f3eee7/302820?text=StyleHub";
                    }}
                  />
                  <span>StyleHub</span>
                </div>

                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="product-bottom">
                    <strong>₹{product.price}</strong>
                    <span>Stock: {product.stock}</span>
                  </div>
                  <button
                    onClick={() => addToCart(product.id)}
                    disabled={product.stock <= 0}
                  >
                    {product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section id="cart" className="cart-section">
        <div className="section-heading">
          <p>YOUR SHOPPING BAG</p>
          <h2>Your Cart</h2>
        </div>

        {!token ? (
          <div className="empty-cart">
            <p>Please login to view your cart.</p>
            <a href="#login">Login</a>
          </div>
        ) : !cart?.items?.length ? (
          <div className="empty-cart">
            <p>Your cart is empty.</p>
          </div>
        ) : (
          <div className="cart-container">
            <div className="cart-items">
              {cart.items.map((item) => (
                <div className="cart-item" key={item.cart_id}>
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      ₹{item.price} × {item.quantity}
                    </p>
                    <strong>₹{item.item_total}</strong>
                  </div>
                  <button onClick={() => removeFromCart(item.cart_id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <h3>Cart Total</h3>
              <div className="total">₹{cart.total_price}</div>
              <button onClick={startCheckout} disabled={loading}>
                {loading ? "Preparing Checkout..." : "Proceed to Checkout"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section id="orders" className="orders-section">
        <div className="section-heading">
          <p>YOUR PURCHASES</p>
          <h2>Order History</h2>
        </div>

        {!token ? (
          <div className="empty-cart">
            <p>Please login to view your orders.</p>
          </div>
        ) : ordersLoading ? (
          <p className="orders-status">Loading your orders...</p>
        ) : orders.length === 0 ? (
          <div className="empty-cart">
            <p>You haven't placed any orders yet.</p>
            <a href="#products">Explore Products</a>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.order_id}>
                <div className="order-header">
                  <div>
                    <h3>Order #{order.order_id}</h3>
                    <p>
                      {order.created_at
                        ? new Date(order.created_at).toLocaleString()
                        : "Date unavailable"}
                    </p>
                  </div>

                  <span
                    className={`order-status ${String(
                      order.status
                    ).toLowerCase()}`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="order-items">
                  {(order.items || []).map((item, index) => (
                    <div
                      className="order-item"
                      key={`${order.order_id}-${item.product_id}-${index}`}
                    >
                      <div>
                        <strong>{item.product_name}</strong>
                        <p>
                          ₹{item.price} × {item.quantity}
                        </p>
                      </div>
                      <strong>₹{item.item_total}</strong>
                    </div>
                  ))}
                </div>

                <div className="order-total">
                  <span>Total</span>
                  <strong>₹{order.total_price}</strong>
                </div>

                {String(order.status).toLowerCase() === "pending" && (
                  <button
                    type="button"
                    onClick={() => cancelOrder(order.order_id)}
                    disabled={cancellingOrderId !== null}
                  >
                    {cancellingOrderId === order.order_id
                      ? "Cancelling..."
                      : "Cancel Order"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}

        {token && !ordersLoading && orders.length > 0 && (
          <button
            className="refresh-orders"
            onClick={() => loadOrders(token)}
          >
            Refresh Orders
          </button>
        )}
      </section>

      {checkoutOpen && clientSecret && (
        <section className="checkout-section">
          <div className="checkout-card">
            <button
              className="close-checkout"
              onClick={() => {
                setCheckoutOpen(false);
                setClientSecret("");
              }}
              aria-label="Close checkout"
            >
              ✕
            </button>

            <Elements
              stripe={stripePromise}
              options={{ clientSecret }}
            >
              <PaymentForm
                orderId={orderId}
                onSuccess={handlePaymentSuccess}
              />
            </Elements>
          </div>
        </section>
      )}

      {paymentSuccess && (
        <section className="success-section">
          <div className="success-card">
            <h2>Payment Successful 🎉</h2>
            <p>Thank you for shopping with StyleHub.</p>
            <p>Order #{orderId}</p>
            <a href="#orders">View Order History</a>
          </div>
        </section>
      )}

      <footer>
        <h2>StyleHub</h2>
        <p>Fashion made simple.</p>
        <p>© 2026 StyleHub - Fashion Mini Store</p>
      </footer>
    </div>
  );
}

export default App;

