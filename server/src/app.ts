import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes";
import workerRoutes from "./routes/worker.routes";
import { requestId } from "./middleware/request-id";
import { requestLogger } from "./middleware/request-logger";
import { errorHandler, notFoundHandler } from "./utils/app-error";

const app = express();

// Section 8.3 — first in the chain, so every response (including ones
// rejected by later middleware) carries X-Request-Id and every log line
// can be correlated to it.
app.use(requestId);
app.use(requestLogger);

// Section 8.3 — HSTS, X-Content-Type-Options, X-Frame-Options DENY, a
// restrictive default-src CSP (appropriate for a JSON API), and removes
// X-Powered-By — all helmet defaults, matching the requirement as-is.
app.use(helmet());

// Section 8.2 — explicit origin allowlist, never a wildcard; credentials
// enabled only because the refresh-token cookie (Section 6.1) needs it.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json({ limit: "1mb" })); // Section 8.4
app.use(cookieParser());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/workers", workerRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Worksetu API listening on port ${PORT}`);
  });
}

export default app;
