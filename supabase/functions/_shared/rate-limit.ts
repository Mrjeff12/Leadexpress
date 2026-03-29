// Simple in-memory rate limiter for edge functions.
// Resets when the function cold-starts, which is acceptable for Supabase Edge Functions.

const requests = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if a request should be rate-limited.
 * @param key - Unique identifier (e.g., IP address or phone number)
 * @param maxRequests - Maximum requests per window (default: 10)
 * @param windowMs - Window duration in milliseconds (default: 60_000 = 1 minute)
 * @returns true if the request is allowed, false if rate-limited
 */
export function checkRateLimit(
  key: string,
  maxRequests = 10,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const entry = requests.get(key);

  if (!entry || now >= entry.resetAt) {
    requests.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Returns a 429 Too Many Requests response.
 */
export function rateLimitResponse(headers: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: { ...headers, "Content-Type": "application/json" },
    },
  );
}
