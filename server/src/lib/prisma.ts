import { PrismaClient } from "@prisma/client";
import { recordDbQuery } from "./request-timing";

export const prisma = new PrismaClient();

// Feeds the Server-Timing header (lib/request-timing.ts). $use is deprecated
// in favour of client extensions, but an extension returns a differently
// typed client and every `tx` parameter in the codebase is typed against
// PrismaClient, so the middleware keeps this change contained.
prisma.$use(async (params, next) => {
  const start = performance.now();
  try {
    return await next(params);
  } finally {
    recordDbQuery(performance.now() - start);
  }
});
