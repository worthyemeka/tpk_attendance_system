export function PageHeader({ eyebrow = "PETRA WUSE", title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</header>;
}
