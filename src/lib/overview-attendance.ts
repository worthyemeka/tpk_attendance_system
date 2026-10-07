import { parseCampusTime } from "./campus-time";

type SundayService = { kind: string; startsAt: string; endsAt: string };

export function sundaySignInAvailable(service: SundayService, serverTime: string): boolean {
  return service.kind === "SUNDAY" &&
    serverTime >= service.startsAt.slice(0, 10) + " 06:00:00" &&
    serverTime < service.endsAt;
}

export function overviewRolesHeading(dates: string[], today: string): string {
  const unique = [...new Set(dates.filter(Boolean))];
  if (unique.length !== 1 || !today) return "Your scheduled roles";
  const date = unique[0];
  if (date === today) return "Your roles today";
  if (parseCampusTime(date + " 12:00:00").getUTCDay() === 0 && date > today) return "Your roles on Sunday";
  const label = new Intl.DateTimeFormat("en-NG", {
    weekday: "long", day: "numeric", month: "short", timeZone: "Africa/Lagos",
  }).format(parseCampusTime(date + " 12:00:00"));
  return "Your roles for " + label;
}
