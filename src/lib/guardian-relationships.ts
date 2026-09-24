/**
 * The single canonical list used anywhere a parent, guardian, or pickup
 * relationship is selected.  Keeping this here prevents directory filters
 * from drifting away from the registration form.
 */
export const GUARDIAN_RELATIONSHIPS = ["Mother", "Father", "Guardian", "Other"] as const;
