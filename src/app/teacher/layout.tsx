import { TeacherParentFormParity } from "@/components/teacher-parent-form-parity";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<TeacherParentFormParity /></>;
}
