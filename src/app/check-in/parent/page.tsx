"use client";

import { NewChildRegistration } from "@/components/new-child-registration";
import { ParentReturningCheckIn } from "@/components/parent-returning-check-in";
import { useSearchParams } from "next/navigation";

export default function ParentCheckInPage() {
  const searchParams = useSearchParams();
  return searchParams.get("flow") === "new" ? <NewChildRegistration /> : <ParentReturningCheckIn />;
}
