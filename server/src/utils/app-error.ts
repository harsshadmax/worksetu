import { Request, Response, NextFunction } from "express";

// Section 4.8 error envelope. `requestId` is threaded in during PHASE 4
// once the request-id middleware exists (Section 8.3) — this is the
// shape PHASE 4 extends, not a different one.
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
  }
  // Section 8.5 — never leak a raw stack trace, DB error, or file path.
  console.error(err);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
}

export function notFoundHandler(_req: Request, res: Response) {
  return res.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: "The requested route does not exist" } });
}
