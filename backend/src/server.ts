import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { products } from "./data/mockDb.js";
import { getRecipeSuggestions } from "./services/aiProvider.js";
import type { Order } from "../../shared/types/domain.js";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12)
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  console.error("Invalid environment variables", envResult.error.flatten());
  process.exit(1);
}

const env = envResult.data;
const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "200kb" }));

const promoCodeSchema = z
  .string()
  .trim()
  .max(20, "Promo code too long")
  .regex(/^[a-zA-Z0-9]+$/, "Promo code must be alphanumeric");

const couponValidateSchema = z.object({
  promoCode: promoCodeSchema
});

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(50),
        quantity: z.number().int().positive().max(99)
      })
    )
    .min(1)
    .max(100),
  promoCode: promoCodeSchema.optional()
});

const VALID_PROMO_CODE = "FREE100";
const DISCOUNT_AMOUNT = 100;
const aiRecipeRequestSchema = z.object({
  itemNames: z.array(z.string().trim().min(1).max(30)).min(1).max(30)
});
const registerSchema = z.object({
  username: z.string().trim().min(2).max(30),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72)
});
const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72)
});
const cartUpsertSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(50),
        quantity: z.number().int().positive().max(99)
      })
    )
    .max(100)
});

const aiRecipeResponseSchema = z.object({
  recommendations: z.array(
    z.object({
      recipeName: z.string(),
      steps: z.array(z.string()),
      missingIngredients: z.array(z.string())
    })
  )
});

const sanitizeText = (value: string) =>
  value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .trim();

type ApiError = {
  statusCode: number;
  code: string;
  message: string;
};

const sendApiError = (res: Response, error: ApiError) =>
  res.status(error.statusCode).json({
    error: {
      code: error.code,
      message: error.message
    }
  });

type UserRecord = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

const usersByEmail = new Map<string, UserRecord>();
const sessions = new Map<string, string>();
const userOrders = new Map<string, Order[]>();
const userCarts = new Map<string, Array<{ id: string; quantity: number }>>();
const runtimeDir = path.join(process.cwd(), ".runtime");
const runtimeStateFile = path.join(runtimeDir, "state.json");
let persistChain: Promise<void> = Promise.resolve();

type RuntimeState = {
  users: UserRecord[];
  sessions: Array<{ token: string; userId: string }>;
  userOrders: Array<{ userId: string; orders: Order[] }>;
  userCarts: Array<{ userId: string; items: Array<{ id: string; quantity: number }> }>;
};

const enqueuePersistState = () => {
  const state: RuntimeState = {
    users: [...usersByEmail.values()],
    sessions: [...sessions.entries()].map(([token, userId]) => ({ token, userId })),
    userOrders: [...userOrders.entries()].map(([userId, orders]) => ({ userId, orders })),
    userCarts: [...userCarts.entries()].map(([userId, items]) => ({ userId, items }))
  };

  persistChain = persistChain
    .then(async () => {
      await mkdir(runtimeDir, { recursive: true });
      await writeFile(runtimeStateFile, JSON.stringify(state, null, 2), "utf-8");
    })
    .catch((error) => {
      console.error("Persist runtime state failed:", error);
    });
};

const restoreRuntimeState = async () => {
  try {
    await mkdir(runtimeDir, { recursive: true });
    const raw = await readFile(runtimeStateFile, "utf-8");
    const parsed = JSON.parse(raw) as RuntimeState;

    usersByEmail.clear();
    sessions.clear();
    userOrders.clear();
    userCarts.clear();

    parsed.users?.forEach((user) => {
      usersByEmail.set(user.email.toLowerCase(), user);
    });
    parsed.sessions?.forEach((session) => {
      sessions.set(session.token, session.userId);
    });
    parsed.userOrders?.forEach((entry) => {
      userOrders.set(entry.userId, entry.orders ?? []);
    });
    parsed.userCarts?.forEach((entry) => {
      userCarts.set(entry.userId, entry.items ?? []);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("ENOENT")) {
      console.error("Restore runtime state failed:", error);
    }
  }
};

type AuthedRequest = Request & { authUserId: string };

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return sendApiError(res, {
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "Authentication required"
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const userId = sessions.get(token);
  if (!userId) {
    return sendApiError(res, {
      statusCode: 401,
      code: "INVALID_SESSION",
      message: "Authentication required"
    });
  }

  (req as AuthedRequest).authUserId = userId;
  return next();
};

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "shopping-cart-backend",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/products", (_req, res) => {
  res.status(200).json({
    items: products
  });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendApiError(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid register payload"
      });
    }

    const { username, email, password } = parseResult.data;
    const emailKey = email.toLowerCase();
    if (usersByEmail.has(emailKey)) {
      return sendApiError(res, {
        statusCode: 409,
        code: "EMAIL_ALREADY_EXISTS",
        message: "Email already registered"
      });
    }

    const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
    const user: UserRecord = {
      id: `USR-${randomUUID()}`,
      username,
      email: emailKey,
      passwordHash,
      createdAt: new Date().toISOString()
    };
    usersByEmail.set(emailKey, user);
    userOrders.set(user.id, []);
    userCarts.set(user.id, []);
    enqueuePersistState();

    return res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email
    });
  } catch (error) {
    console.error("Register failed:", error);
    return sendApiError(res, {
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendApiError(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid login payload"
      });
    }

    const { email, password } = parseResult.data;
    const user = usersByEmail.get(email.toLowerCase());
    if (!user) {
      return sendApiError(res, {
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid credentials"
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return sendApiError(res, {
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid credentials"
      });
    }

    const token = `sess_${randomUUID()}`;
    sessions.set(token, user.id);
    enqueuePersistState();
    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login failed:", error);
    return sendApiError(res, {
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.slice("Bearer ".length).trim();
  sessions.delete(token);
  enqueuePersistState();
  return res.status(200).json({ success: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const authedReq = req as AuthedRequest;
  const user = [...usersByEmail.values()].find((item) => item.id === authedReq.authUserId);
  if (!user) {
    return sendApiError(res, {
      statusCode: 401,
      code: "INVALID_SESSION",
      message: "Authentication required"
    });
  }
  return res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email
  });
});

app.post("/api/coupon/validate", (req, res) => {
  try {
    const parseResult = couponValidateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendApiError(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid promoCode format"
      });
    }

    const { promoCode } = parseResult.data;
    const normalizedCode = promoCode.toUpperCase();
    const isValid = normalizedCode === VALID_PROMO_CODE;

    if (!isValid) {
      return sendApiError(res, {
        statusCode: 404,
        code: "PROMO_CODE_NOT_FOUND",
        message: "Promo code not found or expired"
      });
    }

    return res.status(200).json({
      valid: true,
      promoCode: normalizedCode,
      discountAmount: DISCOUNT_AMOUNT
    });
  } catch (error) {
    console.error("Coupon validation failed:", error);
    return sendApiError(res, {
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

app.get("/api/cart", requireAuth, (req, res) => {
  const authedReq = req as AuthedRequest;
  return res.status(200).json({
    items: userCarts.get(authedReq.authUserId) ?? []
  });
});

app.put("/api/cart", requireAuth, (req, res) => {
  try {
    const authedReq = req as AuthedRequest;
    const parseResult = cartUpsertSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendApiError(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid cart payload"
      });
    }
    userCarts.set(authedReq.authUserId, parseResult.data.items);
    enqueuePersistState();
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Update cart failed:", error);
    return sendApiError(res, {
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

app.post("/api/orders/checkout", requireAuth, (req, res) => {
  try {
    const authedReq = req as AuthedRequest;
    const parseResult = checkoutSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendApiError(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid checkout payload"
      });
    }

    const { items, promoCode } = parseResult.data;
    const productMap = new Map(products.map((product) => [product.id, product]));

    let subtotal = 0;
    for (const item of items) {
      const matchedProduct = productMap.get(item.id);
      if (!matchedProduct) {
        return sendApiError(res, {
          statusCode: 400,
          code: "INVALID_PRODUCT_ID",
          message: `Invalid product id: ${item.id}`
        });
      }
      // Security critical: price is always sourced from backend catalog.
      subtotal += matchedProduct.price * item.quantity;
    }

    const normalizedCode = promoCode?.toUpperCase();
    const discountAmount = normalizedCode === VALID_PROMO_CODE ? DISCOUNT_AMOUNT : 0;
    const totalAmount = Math.max(0, subtotal - discountAmount);

    const orderId = `ORD-${randomUUID()}`;
    const order: Order = {
      id: orderId,
      items,
      promoCode: normalizedCode,
      subtotal,
      discountAmount,
      total: totalAmount,
      currency: "TWD",
      status: "paid",
      createdAt: new Date().toISOString()
    };
    const orders = userOrders.get(authedReq.authUserId) ?? [];
    orders.unshift(order);
    userOrders.set(authedReq.authUserId, orders);
    userCarts.set(authedReq.authUserId, []);
    enqueuePersistState();

    return res.status(200).json({
      subtotal,
      discountAmount,
      totalAmount,
      currency: "TWD",
      orderId
    });
  } catch (error) {
    console.error("Checkout failed:", error);
    return sendApiError(res, {
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

app.get("/api/orders", requireAuth, (_req, res) => {
  try {
    const authedReq = _req as AuthedRequest;
    return res.status(200).json({
      items: userOrders.get(authedReq.authUserId) ?? []
    });
  } catch (error) {
    console.error("List orders failed:", error);
    return sendApiError(res, {
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

app.post("/api/ai/recipe-suggestions", requireAuth, (req, res) => {
  try {
    const parseResult = aiRecipeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendApiError(res, {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid recipe suggestion payload"
      });
    }

    const suggestions = getRecipeSuggestions(parseResult.data.itemNames);
    const sanitizedSuggestions = {
      recommendations: suggestions.map((suggestion) => ({
        recipeName: sanitizeText(suggestion.recipeName),
        steps: suggestion.steps.map((step) => sanitizeText(step)),
        missingIngredients: suggestion.missingIngredients.map((name) => sanitizeText(name))
      }))
    };

    const responseValidation = aiRecipeResponseSchema.safeParse(sanitizedSuggestions);
    if (!responseValidation.success) {
      console.error("AI suggestion response validation failed:", responseValidation.error.flatten());
      return sendApiError(res, {
        statusCode: 500,
        code: "AI_RESPONSE_FORMAT_ERROR",
        message: "Invalid AI response format"
      });
    }

    return res.status(200).json(responseValidation.data);
  } catch (error) {
    console.error("AI recipe suggestion failed:", error);
    return sendApiError(res, {
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error"
    });
  }
});

// Global runtime error middleware.
// Handles malformed JSON and unexpected runtime errors without leaking stack traces.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled request error:", err);

  if (err instanceof SyntaxError && "body" in err) {
    return sendApiError(res, {
      statusCode: 500,
      code: "MALFORMED_JSON",
      message: "Internal server error"
    });
  }

  return sendApiError(res, {
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error"
  });
});

void restoreRuntimeState().finally(() => {
  app.listen(env.PORT, () => {
    console.log(`Backend server listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
});
