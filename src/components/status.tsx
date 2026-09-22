export function StatusPill({ status }: { status: string }) {
  const label = status === "CHECKED_IN" ? "Checked in" : status === "PICKUP_REQUESTED" ? "Pickup requested" : "Picked up";
  return <span className={`status ${status.toLowerCase()}`}>{label}</span>;
}
