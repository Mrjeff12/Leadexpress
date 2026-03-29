// Production origins from env, fallback to defaults
const EXTRA_ORIGINS = Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") ?? [];

const ALLOWED_ORIGINS = [
  ...EXTRA_ORIGINS,
  "https://app.masterleadflow.com",
  "https://masterleadflow.com",
  "https://app.masterleadflow.co.il",
  "https://masterleadflow.co.il",
  "http://localhost:5173",
  "http://localhost:5174",
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : "https://app.masterleadflow.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}
