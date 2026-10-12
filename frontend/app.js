const API_URL = "http://127.0.0.1:8000";

let token = localStorage.getItem("token");


async function login() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        alert("Please enter email and password.");
        return;
    }

    const formData = new URLSearchParams();

    formData.append("username", email);
    formData.append("password", password);

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.detail || "Login failed.");
            return;
        }

        token = data.access_token;

        localStorage.setItem("token", token);

        alert("Login successful!");

        document.getElementById("login-section").style.display = "none";
        document.getElementById("logout-button").style.display = "block";

        await loadCart();

    } catch (error) {
        console.error("Login error:", error);
        alert("Unable to connect to backend.");
    }
}


function logout() {
    localStorage.removeItem("token");

    token = null;

    document.getElementById("login-section").style.display = "block";
    document.getElementById("logout-button").style.display = "none";

    document.getElementById("cart-list").innerHTML =
        "<p>Please login to view your cart.</p>";
}


async function loadProducts() {
    console.log("Loading products...");

    const productList = document.getElementById("product-list");

    try {
        const response = await fetch(`${API_URL}/products/`);

        console.log("Products response status:", response.status);

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const products = await response.json();

        console.log("Products received:", products);

        productList.innerHTML = "";

        if (!products || products.length === 0) {
            productList.innerHTML = "<p>No products available.</p>";
            return;
        }

        products.forEach(product => {
            const card = document.createElement("div");

            card.className = "product-card";

            card.innerHTML = `
                <h3>${product.name}</h3>

                <p>${product.description}</p>

                <div class="product-price">
                    ₹${product.price}
                </div>

                <p>
                    Stock: ${product.stock}
                </p>

                <button onclick="addToCart(${product.id})">
                    Add to Cart
                </button>
            `;

            productList.appendChild(card);
        });

    } catch (error) {

        console.error("Product loading error:", error);

        productList.innerHTML =
            "<p>Unable to load products.</p>";
    }
}


async function addToCart(productId) {

    if (!token) {
        alert("Please login first.");
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/cart/?product_id=${productId}&quantity=1`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.detail || "Unable to add product.");
            return;
        }

        alert("Product added to cart!");

        await loadCart();

    } catch (error) {

        console.error("Add to cart error:", error);

        alert("Unable to connect to backend.");
    }
}


async function loadCart() {

    const cartList = document.getElementById("cart-list");

    if (!token) {

        cartList.innerHTML =
            "<p>Please login to view your cart.</p>";

        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/cart/`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {

            cartList.innerHTML =
                "<p>Unable to load cart.</p>";

            return;
        }

        cartList.innerHTML = "";

        if (!data.items || data.items.length === 0) {

            cartList.innerHTML =
                "<p>Your cart is empty.</p>";

            return;
        }

        data.items.forEach(item => {

            const cartItem = document.createElement("div");

            cartItem.className = "cart-item";

            cartItem.innerHTML = `
                <div>
                    <strong>${item.name}</strong>
                    <br>
                    Price: ₹${item.price}
                    <br>
                    Quantity: ${item.quantity}
                    <br>
                    Total: ₹${item.item_total}
                </div>

                <button onclick="removeFromCart(${item.cart_id})">
                    Remove
                </button>
            `;

            cartList.appendChild(cartItem);
        });

        const total = document.createElement("div");

        total.className = "cart-total";

        total.innerHTML = `
            <h3>Total: ₹${data.total_price}</h3>
        `;

        cartList.appendChild(total);

    } catch (error) {

        console.error("Cart loading error:", error);

        cartList.innerHTML =
            "<p>Unable to connect to backend.</p>";
    }
}


async function removeFromCart(cartId) {

    if (!token) {
        alert("Please login first.");
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/cart/${cartId}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {

            alert(data.detail || "Unable to remove item.");

            return;
        }

        alert("Product removed from cart.");

        await loadCart();

    } catch (error) {

        console.error("Remove cart error:", error);

        alert("Unable to connect to backend.");
    }
}


function scrollToProducts() {

    document.getElementById("products").scrollIntoView({
        behavior: "smooth"
    });
}


document.addEventListener("DOMContentLoaded", async () => {

    console.log("StyleHub frontend started.");

    await loadProducts();

    if (token) {

        document.getElementById("login-section").style.display = "none";

        document.getElementById("logout-button").style.display = "block";

        await loadCart();

    } else {

        document.getElementById("logout-button").style.display = "none";
    }
});
