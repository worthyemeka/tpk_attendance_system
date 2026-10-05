export const minimumRegistrationAge = 3;
export const underThreeMessage = "Your child cannot register with TPK yet because they are not three years old. Children can join from their third birthday.";

export function campusToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function registrationEligibility(dateOfBirth: string, today = campusToday()): "ELIGIBLE" | "UNDER_THREE" | "INVALID_DATE" {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return "INVALID_DATE";
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== dateOfBirth || dateOfBirth > today) return "INVALID_DATE";
  const age = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4)) - (today.slice(5) < dateOfBirth.slice(5) ? 1 : 0);
  return age < minimumRegistrationAge ? "UNDER_THREE" : "ELIGIBLE";
}
