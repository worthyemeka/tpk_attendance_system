import { ClassroomDetail } from "@/components/classrooms-workspace";

export default function ClassroomPage({
  params,
}: {
  params: { classId: string };
}) {
  return <ClassroomDetail classId={Number(params.classId)} />;
}
