import { apiBase } from "@/lib/session";

export type PublicService = { id: number; name: string; serviceType: string };
export async function loadPublicServices(): Promise<PublicService[]> {
  const response = await fetch(`${apiBase}/api/v1/public/service-session/current`, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error("We could not check service availability. Please retry; your details are still on this page.");
  if (result.data === null) return [];
  const rows = result.data?.services;
  if (!Array.isArray(rows) || !rows.length || rows.some(row => !Number.isInteger(Number(row.id)) || Number(row.id) <= 0 || !row.serviceType || !row.name)) {
    throw new Error("We could not confirm the service details. Please retry.");
  }
  return rows.map(row => ({ id: Number(row.id), name: row.name, serviceType: row.serviceType }));
}

export function validRegistrationReceipt(data: unknown, expectedChildren: number): boolean {
  if (!data || typeof data !== "object") return false;
  const receipt = data as { familyId?: number; guardianId?: number; status?: string; requestToken?: string; children?: { id?: number }[] };
  return Number(receipt.familyId) > 0 && Number(receipt.guardianId) > 0 &&
    Array.isArray(receipt.children) && receipt.children.length === expectedChildren && receipt.children.every(child => Number(child.id) > 0) &&
    (receipt.status === "REGISTERED" || (receipt.status === "PENDING" && /^[a-f0-9]{64}$/.test(receipt.requestToken || "")));
}
