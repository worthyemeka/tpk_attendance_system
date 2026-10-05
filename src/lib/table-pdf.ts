/** Small, dependency-free table exporter. Produces a real PDF, not a popup. */
type TableReport = {title:string;subtitle?:string;columns:string[];rows:string[][];widths?:number[]};
const ascii=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[\u2018\u2019]/g,"'").replace(/[\u2013\u2014]/g,"-").replace(/[^\x20-\x7e]/g," ");
const escape=(value:string)=>ascii(value).replace(/([\\()])/g,"\\$1");
function wrap(value:string,width:number):string[] {
  const limit=Math.max(4,Math.floor((width-14)/5));const lines:string[]=[];let line="";
  for(const word of ascii(value||"-").split(/\s+/)) {
    if(line && line.length+word.length+1>limit){lines.push(line);line="";}
    let rest=word;while(rest.length>limit){if(line){lines.push(line);line="";}lines.push(rest.slice(0,limit));rest=rest.slice(limit);}
    if(rest)line+=(line?" ":"")+rest;
  }
  if(line)lines.push(line);return lines.length?lines:["-"];
}
export function createTablePdf({title,subtitle="",columns,rows,widths}:TableReport):Blob {
  const w=842,h=595,margin=30,available=w-margin*2;
  const weights=widths||columns.map(()=>1),total=weights.reduce((a,b)=>a+b,0);
  const sizes=weights.map(value=>available*value/total);const pages:string[]=[];
  let commands:string[]=[];let y=0;
  const text=(value:string,x:number,top:number,size=9,bold=false)=>commands.push(`BT /${bold?"F2":"F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(h-top).toFixed(2)} Tm (${escape(value)}) Tj ET`);
  const rule=(top:number)=>commands.push(`0.86 0.88 0.91 RG 0.5 w ${margin} ${h-top} m ${w-margin} ${h-top} l S`);
  const start=()=>{
    commands=["0.10 0.17 0.29 rg"];text("TRIBEPETRA KIDS - WUSE CAMPUS",margin,30,10,true);text(title,margin,57,18,true);
    text(subtitle,margin,76,10);text("Confidential - share only with authorised TPK leaders.",margin,91,8);
    commands.push(`1 0.95 0.91 rg ${margin} ${h-130} ${available} 25 re f`,"0.10 0.17 0.29 rg");
    let x=margin;columns.forEach((name,i)=>{text(name,x+7,120,9,true);x+=sizes[i];});y=130;
  };
  const finish=()=>{rule(h-32);text(`TPK Service Report | Page ${pages.length+1}`,margin,h-18,8);pages.push(commands.join("\n"));};
  start();
  for(const row of rows){
    const cells=columns.map((_,i)=>wrap(String(row[i]??"-"),sizes[i]));const height=Math.max(28,Math.max(...cells.map(cell=>cell.length))*12+14);
    if(y+height>h-43){finish();start();}
    rule(y);let x=margin;cells.forEach((lines,i)=>{lines.forEach((line,j)=>text(line,x+7,y+16+j*12));x+=sizes[i];});y+=height;
  }
  if(!rows.length)text("No records in this view.",margin+7,y+21);
  rule(y);finish();
  const objects:string[]=["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  const pageIds:number[]=[];
  for(const content of pages){const id=objects.length+1;pageIds.push(id);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id+1} 0 R >>`);objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);}
  objects[1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf="%PDF-1.4\n";const offsets=[0];objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf],{type:"application/pdf"});
}
export function downloadTablePdf(filename:string,report:TableReport):void {
  const url=URL.createObjectURL(createTablePdf(report));const a=document.createElement("a");a.href=url;a.download=filename.endsWith(".pdf")?filename:filename+".pdf";document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
