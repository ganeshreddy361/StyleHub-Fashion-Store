# StyleHub – Fashion Mini Store

A full-stack fashion e-commerce application built with React, FastAPI, and SQLite. Users can register, log in, browse products, manage their cart, place orders, and test payments through Stripe.

## Features

- User registration and login with JWT authentication
- Product browsing
- Add products to cart and manage quantities
- User-specific shopping carts
- Order creation and order history
- Order cancellation for pending orders
- Stripe test-mode payment integration
- Stock updates after successful payment

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite |
| Backend | Python, FastAPI |
| Database | SQLite |
| Authentication | JWT |
| Payments | Stripe (Test Mode) |

## Project Structure

```text
StyleHub/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── routers/
│   ├── requirements.txt
│   └── .env.example
├── frontend-react/
│   ├── src/
│   └── package.json
├── frontend/
├── .gitignore
└── README.md
```

## Prerequisites

- Python 3
- Node.js and npm
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ganeshreddy361/StyleHub-Fashion-Store.git
cd StyleHub-Fashion-Store
```

### 2. Configure the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Update `backend/.env` with your own development secret key and Stripe **test-mode** secret key. Never commit real keys to GitHub.

Start the backend:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API documentation: http://127.0.0.1:8000/docs

### 3. Start the frontend

Open a second terminal:

```bash
cd StyleHub-Fashion-Store/frontend-react
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173/.

## Payments

StyleHub uses Stripe in test mode. Use Stripe's official test card details when testing payments. Do not use real card details or real payment credentials in development.

## Security

- Keep `.env` files and secret keys private.
- Use your own secure development secrets.
- Use Stripe test-mode credentials for local testing.

## Future Improvements

- Admin dashboard for product management
- Product search and filtering
- Responsive UI improvements
- Automated testing and deployment

## Author

**Ganesh Reddy**

GitHub: https://github.com/ganeshreddy361
