# Smart Shopping Platform - Phase 1 Structure

```text
shopping-cart/
├─ frontend/                  # React/Vite/TypeScript frontend app
│  └─ src/
├─ backend/                   # Node.js/Express/TypeScript API service
│  ├─ src/
│  │  ├─ config/
│  │  ├─ data/
│  │  │  └─ mockDb.ts
│  │  ├─ routes/
│  │  └─ server.ts
│  ├─ .env.example
│  ├─ package.json
│  └─ tsconfig.json
└─ shared/
   └─ types/
      ├─ domain.ts
      └─ index.ts
```

## Security Notes

- Sensitive values must come from environment variables (`dotenv`), never hardcoded.
- Checkout price calculation is backend-authoritative; frontend should only send item IDs/quantity and promo code.
- Frontend rendering must avoid `dangerouslySetInnerHTML` for product or AI recommendation text.
