type PrintStat = { label: string; value: string | number; note?: string };
type PrintSection = {
  title: string;
  rows: { label: string; value: string | number }[];
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function printBrandedDocument({
  eyebrow,
  title,
  subtitle,
  stats = [],
  columns,
  rows,
  sections = [],
  confidential = true,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  stats?: PrintStat[];
  columns: string[];
  rows: (string | number | null | undefined)[][];
  sections?: PrintSection[];
  confidential?: boolean;
}) {
  const page = window.open("", "_blank", "noopener,noreferrer");
  if (!page) return;
  const generated = new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());
  page.document.write(`<!doctype html>
    <html><head><title>${escapeHtml(title)}</title><style>
      @page{size:A4;margin:15mm}*{box-sizing:border-box}body{margin:0;color:#10213f;font-family:Arial,sans-serif;font-size:11px;background:#fff}
      .brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e8e3dd;padding-bottom:18px}.brand-left{display:flex;align-items:center;gap:13px}.seal{width:54px;height:54px;border:2px solid #12213b;border-radius:50%;display:grid;place-items:center;font:italic 20px Georgia,serif}.campus{border-left:2px solid #ff6039;padding-left:13px;letter-spacing:2px;font-weight:800}.campus small{display:block;margin-top:5px;color:#68758b;font-size:8px;letter-spacing:2px}.kids{color:#f59b00;font:800 19px Georgia,serif;text-align:right}.kids small{display:block;color:#172a4c;font:italic 10px Georgia,serif}
      .eyebrow{margin:31px 0 8px;color:#f05a34;text-transform:uppercase;letter-spacing:2px;font-weight:800;font-size:12px}h1{margin:0;font:700 34px Georgia,serif;letter-spacing:-1px} .subtitle{margin:8px 0 25px;color:#66758e;font-size:15px}.stats{display:grid;grid-template-columns:repeat(${Math.max(1, Math.min(stats.length, 4))},1fr);margin:0 0 25px;border-radius:14px;background:#fff9f4;overflow:hidden}.stat{min-height:82px;padding:16px;border-right:1px solid #e9dfd5}.stat:last-child{border-right:0}.stat strong{display:block;font-size:25px}.stat span{display:block;margin-top:5px;font-weight:800}.stat small{display:block;margin-top:3px;color:#6b7890}
      .table-title{display:flex;justify-content:space-between;align-items:end;margin:0 0 11px}.table-title h2{margin:0;font:700 20px Georgia,serif}.generated{padding:9px 12px;border-radius:9px;background:#fff7e9;color:#765321;font-size:9px}.generated b{display:block;color:#172a4c;font-size:10px}table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #dae3ef;border-radius:10px;overflow:hidden}th{padding:10px 8px;background:#f2f7fd;color:#315276;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.4px}td{padding:10px 8px;border-top:1px solid #e3e9f0;vertical-align:top;color:#31425f}tr:nth-child(even) td{background:#fcfdff}.details{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:20px}.detail{padding:13px;border:1px solid #e5e1da;border-radius:10px}.detail h3{margin:0 0 9px;font:700 15px Georgia,serif}.detail-row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-top:1px solid #efede9}.detail-row:first-of-type{border-top:0}.detail-row span{color:#68758b}.notice{display:flex;gap:10px;margin-top:24px;padding:14px;border:1px solid #cfe4ff;border-radius:10px;background:#f1f8ff;color:#314d73}.notice b{display:block;margin-bottom:3px}.footer{position:fixed;bottom:10mm;left:15mm;right:15mm;display:flex;justify-content:space-between;align-items:end;color:#64718a;font-size:9px}.footer strong{display:block;color:#172a4c;letter-spacing:2px}.footer:before{content:"";position:absolute;left:0;top:-8px;width:4px;height:29px;border-radius:5px;background:#ff6039}@media print{.footer{position:fixed}}
    </style></head><body>
    <header class="brand"><div class="brand-left"><div class="seal">Petra</div><div class="campus">PETRA CHRISTIAN CENTRE<small>WUSE CAMPUS · PEOPLE · PURPOSE · POSSIBILITIES</small></div></div><div class="kids">TribePetra Kids<small>A place to belong, grow and lead.</small></div></header>
    <p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p>
    ${stats.length ? `<section class="stats">${stats.map((stat) => `<div class="stat"><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.label)}</span>${stat.note ? `<small>${escapeHtml(stat.note)}</small>` : ""}</div>`).join("")}</section>` : ""}
    <div class="table-title"><h2>Directory details</h2><div class="generated">Generated on<b>${escapeHtml(generated)}</b></div></div>
    <table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${columns.length}">No records found for this export.</td></tr>`}</tbody></table>
    ${sections.length ? `<section class="details">${sections.map((section) => `<article class="detail"><h3>${escapeHtml(section.title)}</h3>${section.rows.map((row) => `<div class="detail-row"><span>${escapeHtml(row.label)}</span><b>${escapeHtml(row.value)}</b></div>`).join("")}</article>`).join("")}</section>` : ""}
    ${confidential ? `<section class="notice"><div>ⓘ</div><div><b>Confidential information</b>This document contains TPK information. Please handle responsibly and share only with authorised Petra leaders.</div></section>` : ""}
    <footer class="footer"><div><strong>TRIBEPETRA KIDS · WUSE CAMPUS</strong>CHECK IN · BELONG · GROW</div><div>Generated from the TribePetra Kids Management System</div></footer><script>window.print()</script></body></html>`);
  page.document.close();
}
