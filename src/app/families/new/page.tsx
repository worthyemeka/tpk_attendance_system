import { redirect } from "next/navigation";

// Old shared registration links use the same persisted parent registration flow.
export default function NewFamilyPage() {
  redirect("/check-in/parent?flow=new");
}
