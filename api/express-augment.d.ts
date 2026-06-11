// On the standalone Replit server, `req.log` is typed by pino-http's type
// augmentation. The Vercel function runs without pino-http (it installs a small
// console-backed `req.log` shim instead), so we declare the same property here
// to keep the reused upload route type-correct. This file is scoped to the
// `api/` tsconfig only and does not affect the Replit api-server build.
declare global {
  namespace Express {
    interface Request {
      log: { error: (...args: unknown[]) => void };
    }
  }
}

export {};
