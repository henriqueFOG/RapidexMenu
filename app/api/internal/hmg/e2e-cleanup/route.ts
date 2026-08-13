import { apiError, HttpError, json } from "@/lib/http";
import { getDatabase, getRapidexEnvironment } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    if (getRapidexEnvironment() !== "hmg") {
      throw new HttpError(404, "Recurso indisponível.", "not_found");
    }

    const runId = new URL(request.url).searchParams.get("runId") || "";
    const digits = runId.replace(/\D/g, "");
    const suffix = digits.slice(-8);
    if (suffix.length < 6) {
      throw new HttpError(400, "Identificador E2E inválido.", "validation_error");
    }

    const name = `Rapidex E2E ${suffix}`;
    const slug = `rapidex-e2e-${suffix}`;
    const email = `e2e.${suffix}@rapidex-hmg.test`;
    const result = await getDatabase()
      .prepare(
        "DELETE FROM restaurants WHERE name = ? AND slug = ? AND lower(owner_email) = ?",
      )
      .bind(name, slug, email)
      .run();

    return json({ ok: true, deleted: Number(result.meta.changes ?? 0) === 1 });
  } catch (error) {
    return apiError(error, request);
  }
}
