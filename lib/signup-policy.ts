import type { RapidexEnvironment } from "./environment";

export type SignupMode = "open" | "invite_only" | "closed";

export function resolveSignupMode(input: {
  environment: RapidexEnvironment;
  configuredMode?: string | null;
  legacyEnabled?: string | null;
}): SignupMode {
  const configured = String(input.configuredMode || "").trim().toLowerCase();
  if (configured === "closed" || configured === "disabled") return "closed";
  if (configured === "invite_only" || configured === "invite-only" || configured === "invite") return "invite_only";
  if (configured === "open") return input.environment === "production" ? "invite_only" : "open";
  if (input.legacyEnabled === "false") return "closed";
  return input.environment === "production" ? "invite_only" : "open";
}

export function publicSignupAllowed(mode: SignupMode) {
  return mode === "open";
}
