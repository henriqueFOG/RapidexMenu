import { json } from "@/lib/http";
import { signupMode } from "@/lib/commercial-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const mode = signupMode();
  return json({ ok: true, mode, publicSignup: mode === "open" });
}
