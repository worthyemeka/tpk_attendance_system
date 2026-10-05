type AttendanceChild = { id: number | string; todayStatus: string; joinedAt?: string };
type AttendanceSession = { id: number | string; serviceDate: string };
type AttendanceData = {
  serviceSession?: AttendanceSession | null;
  monthly: {
    presentByDate: Record<string, (number | string)[]>;
    presentBySession?: Record<string, (number | string)[]>;
  };
};

/** The selected-service roster and attendance matrix must agree, including after pickup. */
export function classroomAttendanceStatus(
  data: AttendanceData,
  child: AttendanceChild,
  session: AttendanceSession,
): "PRESENT" | "ABSENT" | "NOT_REGISTERED" {
  if (Number(session.id) === Number(data.serviceSession?.id)) {
    return child.todayStatus === "PRESENT" ? "PRESENT" : "ABSENT";
  }
  const presentIds = data.monthly.presentBySession?.[String(session.id)]
    ?? data.monthly.presentByDate[session.serviceDate]
    ?? [];
  // A real attendance record takes precedence over a subsequently corrected joining date.
  if (presentIds.some((id) => Number(id) === Number(child.id))) return "PRESENT";
  if (child.joinedAt && child.joinedAt.slice(0, 10) > session.serviceDate.slice(0, 10)) {
    return "NOT_REGISTERED";
  }
  return "ABSENT";
}
