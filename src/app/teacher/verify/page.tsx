import { redirect } from "next/navigation";

/** WhatsApp verification was retired. Preserve old links without preserving
 * a second account-activation workflow. */
export default function TeacherVerifyPage() {
  redirect("/teacher/login");
}
