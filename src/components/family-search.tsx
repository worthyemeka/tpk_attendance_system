"use client";
import { useState } from "react";
type Family = { id: string; familyCode: string; surname: string; phone: string | null; guardians: { firstName: string; lastName: string }[]; children: { id: string; firstName: string; lastName: string; class: { name: string } }[] };
export function FamilySearch() {
  const [query, setQuery] = useState(""); const [families, setFamilies] = useState<Family[]>([]); const [loading, setLoading] = useState(false);
  async function search(e: React.FormEvent) { e.preventDefault(); setLoading(true); const res = await fetch(`/api/families?q=${encodeURIComponent(query)}`); setFamilies(await res.json()); setLoading(false); }
  return <div className="card form-card"><form className="search-row" onSubmit={search}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by surname, phone, Family ID or pass token" aria-label="Search families"/><button className="btn orange">{loading ? "Searching…" : "Search family"}</button></form>{families.map((family) => <div className="result-card" key={family.id}><div><h3>{family.surname} family</h3><p>{family.familyCode} · {family.phone ?? "No phone"}</p><p>{family.children.map((child) => `${child.firstName} ${child.lastName} (${child.class.name})`).join(" · ")}</p></div><span className="subtle">{family.guardians.map((guardian) => `${guardian.firstName} ${guardian.lastName}`).join(", ")}</span></div>)}{query && !loading && families.length === 0 && <div className="empty">No family matches that search.</div>}</div>;
}
