/** Small, dependency-free table exporter. Produces a real PDF, not a popup. */
import { mediaUrl, readTeacherSession } from "./session";
export type PdfImage = {hex:string;width:number;height:number};
export type PdfIdentity = {name:string;photo?:PdfImage|null;label?:string};
export type TableReport = {title:string;subtitle?:string;columns:string[];rows:string[][];widths?:number[];photos?:(PdfImage|null)[];branding?:PdfImage[];identity?:PdfIdentity;downloadedBy?:string;avatarNames?:string[];photoColumn?:number};
export const pdfInitials=(name:string)=>name.trim().replace(/^(Auntie|Uncle)\s+/i,"").split(/\s+/).filter(Boolean).map(word=>word[0]).filter((_,index,words)=>index===0||index===words.length-1).join("").toUpperCase();
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
export function createTablePdf({title,subtitle="",columns,rows,widths,photos,branding=[],identity,downloadedBy,avatarNames,photoColumn=0}:TableReport):Blob {
  const w=842,h=595,margin=30,available=w-margin*2;
  const weights=widths||columns.map(()=>1),total=weights.reduce((a,b)=>a+b,0);
  const sizes=weights.map(value=>available*value/total);const pages:string[]=[];
  let commands:string[]=[];let y=0;
  const text=(value:string,x:number,top:number,size=9,bold=false)=>commands.push(`BT /${bold?"F2":"F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(h-top).toFixed(2)} Tm (${escape(value)}) Tj ET`);
  const rule=(top:number)=>commands.push(`0.86 0.88 0.91 RG 0.5 w ${margin} ${h-top} m ${w-margin} ${h-top} l S`);
  const avatar=(name:string,photo:PdfImage|null|undefined,ref:string,x:number,top:number,size:number)=>{
    const r=size/2,cx=x+r,cy=h-top-r,k=r*.55228475;
    const circle=`${cx+r} ${cy} m ${cx+r} ${cy+k} ${cx+k} ${cy+r} ${cx} ${cy+r} c ${cx-k} ${cy+r} ${cx-r} ${cy+k} ${cx-r} ${cy} c ${cx-r} ${cy-k} ${cx-k} ${cy-r} ${cx} ${cy-r} c ${cx+k} ${cy-r} ${cx+r} ${cy-k} ${cx+r} ${cy} c h`;
    commands.push("q");
    if(photo)commands.push(`${circle} W n ${size} 0 0 ${size} ${x} ${h-top-size} cm /${ref} Do`);
    else{commands.push(`0.96 0.93 0.88 rg ${circle} f`,"0.48 0.35 0.22 rg");const initials=pdfInitials(name),font=size*.30;text(initials,cx-initials.length*font*.32,top+size*.61,font,true);}
    commands.push("Q");
  };
  const start=()=>{
    commands=["0.10 0.17 0.29 rg"];
    const headingX=branding.length?margin+128:margin;
    branding.slice(0,2).forEach((logo,index)=>{const scale=Math.min((branding.length===1?116:52)/logo.width,58/logo.height);const width=logo.width*scale,height=logo.height*scale;commands.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${margin+index*62} ${(h-23-height).toFixed(2)} cm /B${index} Do Q`);});
    text("TRIBEPETRA KIDS - MABUSHI (REGIONAL) CAMPUS",headingX,30,9,true);text(title,headingX,54,17,true);
    wrap(subtitle,w-margin-headingX).slice(0,2).forEach((line,index)=>text(line,headingX,71+index*11,9));
    if(identity && !pages.length){avatar(identity.name,identity.photo,"H",margin,91,36);text(identity.label||"Teacher roster",margin+46,101,8);wrap(identity.name,available-46).slice(0,2).forEach((line,index)=>text(line,margin+46,116+index*11,11,true));}
    const header=identity&&!pages.length?154:105;
    text("Confidential - share only with authorised TPK leaders.",margin,header-8,8);
    commands.push(`1 0.95 0.91 rg ${margin} ${h-header-25} ${available} 25 re f`,"0.10 0.17 0.29 rg");
    let x=margin;columns.forEach((name,i)=>{text(name,x+7,header+15,9,true);x+=sizes[i];});y=header+25;
  };
  const finish=(last=false)=>{rule(h-32);text(`TPK Service Report | Page ${pages.length+1}`,margin,h-18,8);if(last&&downloadedBy)text(`Downloaded by ${ascii(downloadedBy).slice(0,90)}`,w-430,h-18,8);pages.push(commands.join("\n"));};
  start();
  for(const [rowIndex,row] of rows.entries()){
    const photo=photos?.[rowIndex];
    const hasAvatar=Boolean(photos||avatarNames);
    const cells=columns.map((_,i)=>hasAvatar&&i===photoColumn?[]:wrap(String(row[i]??"-"),sizes[i]));const height=Math.max(hasAvatar?48:28,Math.max(...cells.map(cell=>cell.length))*12+14);
    if(y+height>h-43){finish();start();}
    if(rowIndex%2===1)commands.push(`0.98 0.98 0.97 rg ${margin} ${h-y-height} ${available} ${height} re f`,"0.10 0.17 0.29 rg");
    rule(y);if(hasAvatar){const size=Math.min(34,sizes[photoColumn]-14);avatar(avatarNames?.[rowIndex]||row[photoColumn],photo,`I${rowIndex}`,margin+sizes.slice(0,photoColumn).reduce((sum,size)=>sum+size,0)+7,y+7,size);}let x=margin;cells.forEach((lines,i)=>{lines.forEach((line,j)=>text(line,x+7,y+16+j*12));x+=sizes[i];});y+=height;
  }
  if(!rows.length)text("No records in this view.",margin+7,y+21);
  rule(y);finish(true);
  const objects:string[]=["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];
  const imageRefs:string[]=[];
  if(identity?.photo){const photo=identity.photo,id=objects.length+1,encoded=photo.hex+">";objects.push(`<< /Type /XObject /Subtype /Image /Width ${photo.width} /Height ${photo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${encoded.length} >>\nstream\n${encoded}\nendstream`);imageRefs.push(`/H ${id} 0 R`);}
  branding.slice(0,2).forEach((logo,index)=>{const id=objects.length+1;const encoded=logo.hex+">";objects.push(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${encoded.length} >>\nstream\n${encoded}\nendstream`);imageRefs.push(`/B${index} ${id} 0 R`);});
  photos?.forEach((photo,index)=>{if(!photo)return;const id=objects.length+1;const encoded=photo.hex+">";objects.push(`<< /Type /XObject /Subtype /Image /Width ${photo.width} /Height ${photo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${encoded.length} >>\nstream\n${encoded}\nendstream`);imageRefs.push(`/I${index} ${id} 0 R`);});
  const pageIds:number[]=[];
  for(const content of pages){const id=objects.length+1;pageIds.push(id);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${imageRefs.join(" ")} >> >> /Contents ${id+1} 0 R >>`);objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);}
  objects[1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  let pdf="%PDF-1.4\n";const offsets=[0];objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf],{type:"application/pdf"});
}
const brandingCache:Record<string,Promise<PdfImage[]>|undefined>={};
export function loadEventReportBranding(type:string){return loadReportBranding(type==="VBS");}
export function loadReportBranding(vbs=false):Promise<PdfImage[]> {
  const key=vbs?"vbs":"tpk";let brandingPromise=brandingCache[key];
  if(!brandingPromise)brandingPromise=Promise.all((vbs?["/brand/vbs-great-jungle-journey.png"]:["/brand/petra-logo.jpg","/brand/tpk-logo.png"]).map(source=>new Promise<PdfImage>((resolve,reject)=>{
    const image=new Image();const timer=window.setTimeout(()=>reject(new Error("The report logos could not load. Please try exporting again.")),8000);
    image.onload=()=>{window.clearTimeout(timer);try{const canvas=document.createElement("canvas");canvas.width=vbs?480:180;canvas.height=Math.round(canvas.width*image.naturalHeight/image.naturalWidth);const ctx=canvas.getContext("2d");if(!ctx)throw new Error("PDF image rendering is unavailable.");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);const bytes=atob(canvas.toDataURL("image/jpeg",.92).split(",")[1]);resolve({hex:Array.from(bytes,char=>char.charCodeAt(0).toString(16).padStart(2,"0")).join(""),width:canvas.width,height:canvas.height});}catch(error){reject(error);}};
    image.onerror=()=>{window.clearTimeout(timer);reject(new Error("The report logos could not load. Please try exporting again."));};image.src=source;
  }))).catch(error=>{brandingCache[key]=undefined;throw error;});
  brandingCache[key]=brandingPromise;return brandingPromise;
}
export async function downloadTablePdf(filename:string,report:TableReport):Promise<void> {
  const branding=report.branding??await loadReportBranding();
  const session=readTeacherSession();
  const downloadedBy=report.downloadedBy??(session?session.name||`${session.firstName} ${session.lastName}`:undefined);
  const url=URL.createObjectURL(createTablePdf({...report,branding,downloadedBy}));const a=document.createElement("a");a.href=url;a.download=filename.endsWith(".pdf")?filename:filename+".pdf";document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
export function loadPdfAvatar(source?:string|null):Promise<PdfImage|null>{
  const url=mediaUrl(source);if(!url)return Promise.resolve(null);
  return new Promise(resolve=>{const image=new Image();image.crossOrigin="anonymous";let done=false;const finish=(value:PdfImage|null)=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};const timer=setTimeout(()=>finish(null),4000);image.onerror=()=>finish(null);image.onload=()=>{try{const canvas=document.createElement("canvas");canvas.width=canvas.height=96;const ctx=canvas.getContext("2d");if(!ctx)return finish(null);const side=Math.min(image.naturalWidth,image.naturalHeight);ctx.fillStyle="#fff";ctx.fillRect(0,0,96,96);ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,96,96);const bytes=atob(canvas.toDataURL("image/jpeg",.88).split(",")[1]);finish({hex:Array.from(bytes,char=>char.charCodeAt(0).toString(16).padStart(2,"0")).join(""),width:96,height:96});}catch{finish(null);}};image.src=url;});
}
