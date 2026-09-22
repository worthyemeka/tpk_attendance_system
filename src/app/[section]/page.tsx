import { PageHeader } from "@/components/page-header";
const labels: Record<string, string> = { children: "Children", classes: "Classes", volunteers: "Volunteers", reports: "Reports", settings: "Settings" };
export default function SupportingPage({ params }: { params: { section: string } }) {
  const title = labels[params.section] ?? "TribePetra Kids";
  return <><PageHeader title={title}/><div className="card"><h2>{title}</h2><p className="subtle" style={{marginTop:8,lineHeight:1.7}}>This MVP navigation area is ready for the next operational module. Core family registration, check-in, live attendance, authorised pickup verification, and release are available now.</p></div></>;
}
