import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import uploadRouter from "../artifacts/api-server/src/routes/upload";

// Vercel serverless entry. It reuses the EXACT same upload router (validation +
// Supabase logic) as the standalone Replit Express server — no business logic
// is duplicated or changed here. This is a catch-all route ([...path].ts), so
// Vercel's filesystem routing forwards every `/api/*` request to this function
// with the full original path preserved (e.g. `/api/upload`); the built
// frontend is served statically for all other routes.
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// The upload route reports errors via `req.log` (provided by pino-http in the
// standalone server). On Vercel we run without pino-http, so install a minimal
// console-backed shim so the route behaves identically.
app.use((req: Request, _res: Response, next: NextFunction) => {
  const r = req as unknown as { log?: { error: (...a: unknown[]) => void } };
  if (!r.log) {
    r.log = { error: (...args: unknown[]) => console.error(...args) };
  }
  next();
});

app.use("/api", uploadRouter);
app.use("/", uploadRouter);

export default app;
