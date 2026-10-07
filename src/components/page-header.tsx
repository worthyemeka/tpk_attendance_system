export function PageHeader({ eyebrow = "PETRA MABUSHI (REGIONAL)", title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</header>;
}
