export type TeacherRosterStatus = "Served" | "Absent" | "Completed" | "Scheduled" | "Upcoming";

export function campusRosterDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Completion describes a past assignment, not proof that the teacher attended. */
export function teacherRosterStatus(
  assignment: { assignmentDate: string; status: string },
  today = campusRosterDate(),
): TeacherRosterStatus {
  if (assignment.status === "PRESENT") return "Served";
  if (assignment.status === "ABSENT") return "Absent";
  const date = assignment.assignmentDate.slice(0, 10);
  if (date < today) return "Completed";
  if (date === today) return "Scheduled";
  return "Upcoming";
}
