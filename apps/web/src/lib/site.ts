function requiredViteEnv(
  name: "VITE_OPERATOR_NAME" | "VITE_CONTACT_EMAIL" | "VITE_SERVICE_URL",
): string {
  const value = import.meta.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}. Set it in apps/web/.env.local (dev) or the web build environment (deploy).`,
    );
  }
  return value.trim();
}

/**
 * Public site / legal identity. Required Vite env, inlined at build time.
 * Used on privacy and terms pages.
 */
export const site = {
  operatorName: requiredViteEnv("VITE_OPERATOR_NAME"),
  contactEmail: requiredViteEnv("VITE_CONTACT_EMAIL"),
  serviceUrl: requiredViteEnv("VITE_SERVICE_URL"),
} as const;
