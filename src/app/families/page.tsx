import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { FamilySearch } from "@/components/family-search";
export default function FamiliesPage() { return <><PageHeader title="Families"><Link href="/families/new" className="btn orange">Register family</Link></PageHeader><FamilySearch /></>; }
