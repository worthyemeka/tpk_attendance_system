import { TeacherParentFormParity } from "@/components/teacher-parent-form-parity";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("/teacher/login");

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<TeacherParentFormParity /></>;
}
