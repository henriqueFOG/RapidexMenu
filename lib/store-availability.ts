const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export type TimeWindow = { open: string; close: string };
export type WeeklyHours = Partial<Record<DayKey, TimeWindow[]>>;

type AvailabilityInput = {
  isOpen: number | boolean;
  timezone?: string | null;
  settingsJson?: unknown;
  now?: number;
};

export function isRestaurantAcceptingOrders(input: AvailabilityInput) {
  if (!Boolean(input.isOpen)) return false;
  const settings = readSettings(input.settingsJson);
  if (settings.weeklyHours === undefined || settings.weeklyHours === null) return true;
  let weeklyHours: WeeklyHours;
  try { weeklyHours = validateWeeklyHours(settings.weeklyHours) || {}; } catch { return false; }

  const local = localParts(input.now ?? Date.now(), input.timezone || "America/Sao_Paulo");
  const todayIndex = local.weekday;
  const previousIndex = (todayIndex + 6) % 7;
  const minute = local.hour * 60 + local.minute;
  const today = weeklyHours[DAY_KEYS[todayIndex]] || [];
  const previous = weeklyHours[DAY_KEYS[previousIndex]] || [];

  for (const window of today) {
    const open = timeToMinute(window.open);
    const close = timeToMinute(window.close);
    if (open < close && minute >= open && minute < close) return true;
    if (open > close && minute >= open) return true;
    if (open === close) return true;
  }
  for (const window of previous) {
    const open = timeToMinute(window.open);
    const close = timeToMinute(window.close);
    if (open > close && minute < close) return true;
  }
  return false;
}

export function validateWeeklyHours(value: unknown): WeeklyHours | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Horários inválidos.");
  const source = value as Record<string, unknown>;
  const normalized: WeeklyHours = {};
  for (const day of DAY_KEYS) {
    const windows = source[day];
    if (windows === undefined) continue;
    if (!Array.isArray(windows) || windows.length > 3) throw new Error(`Horários de ${day} inválidos.`);
    normalized[day] = windows.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Horário de ${day} inválido.`);
      const item = entry as Record<string, unknown>;
      const open = String(item.open || "");
      const close = String(item.close || "");
      if (!isTime(open) || !isTime(close)) throw new Error(`Use horários HH:mm em ${day}.`);
      return { open, close };
    });
  }
  return normalized;
}

function readSettings(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function localParts(timestamp: number, timezone: string) {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: weekdayMap[parts.weekday] ?? 0, hour: Number(parts.hour || 0), minute: Number(parts.minute || 0) };
}

function timeToMinute(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
function isTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}
