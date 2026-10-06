export type RosterClass = {
  id: number;
  name: string;
  ageLabel?: string | null;
};

export type SundayRosterColumn = {
  label: string;
  code: string;
  sub?: string;
  classId?: number;
};

// Use the same configured classes as registration and classrooms. A fixed
// Tribe A/B/C list silently dropped Teens (and any newly configured class).
export function sundayRosterColumns(classes: readonly RosterClass[]): SundayRosterColumn[] {
  return [
    { label: "First Service", sub: "Team", code: "FIRST_SERVICE_TEAM" },
    ...classes.map((classroom) => ({
      label: classroom.name,
      sub: classroom.ageLabel || undefined,
      code: "CLASS_TEACHER",
      classId: Number(classroom.id),
    })),
    { label: "Teacher at Door", code: "TEACHER_AT_DOOR" },
    { label: "Assembly", code: "ASSEMBLY" },
    { label: "Attendance", code: "ATTENDANCE" },
    { label: "Head of Service", code: "HEAD_OF_SERVICE" },
    { label: "Assistant Head 1", sub: "Service leadership", code: "ASSISTANT_HEAD_OF_SERVICE_1" },
    { label: "Assistant Head 2", sub: "Service leadership", code: "ASSISTANT_HEAD_OF_SERVICE_2" },
  ];
}

export function matchesSundayRosterColumn(
  assignment: { dutyCode: string; classId?: number | null },
  column: SundayRosterColumn,
): boolean {
  return assignment.dutyCode === column.code &&
    (column.classId === undefined || Number(assignment.classId) === column.classId);
}
