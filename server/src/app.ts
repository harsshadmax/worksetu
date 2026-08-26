import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import authRoutes from "./routes/auth.routes";
import workerRoutes from "./routes/worker.routes";
import { errorHandler, notFoundHandler } from "./utils/app-error";

const app = express();

// Baseline security headers now (Section 8.3); CORS allowlist, request-id
// middleware, and rate limiting are formalized in PHASE 4 (Section 8.2,
// 8.3, 4.10).
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
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
