export type StaffRole = "ADMIN" | "CHECK_IN" | "CLASS_LEADER" | "PICKUP" | "VIEWER";
export function hasPermission(role: StaffRole, action: "checkin" | "pickup" | "manage" | "view") {
  return role === "ADMIN" || action === "view" || (action === "checkin" && role === "CHECK_IN") || (action === "pickup" && ["PICKUP", "CLASS_LEADER"].includes(role));
}
