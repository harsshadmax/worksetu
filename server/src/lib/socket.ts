import { Server as SocketIOServer } from "socket.io";

// Standalone instance, attached to the HTTP server in app.ts. Handshake
// authentication (Section 12.2) and server-decided room membership
// (Section 12.3) are explicitly PHASE 7 work ("Socket.io auth/room logic")
// — this is just a real, working `io` target so the dispatch engine's
// io.to(...).emit(...) calls (Section 4.4.3/4.4.4) have somewhere to send
// to. Emitting to a room with no authenticated subscribers yet is a safe
// no-op, so this doesn't block PHASE 6's dispatch-engine verification.
export const io = new SocketIOServer({
  cors: {
    origin: (process.env.CORS_ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
    credentials: true
  }
});
