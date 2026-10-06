import { mediaUrl } from "./session";
import { downloadTablePdf, loadPdfAvatar } from "./table-pdf";

export type WeeklyAssignment = {id:number;userId:number;assignmentDate:string;serviceSessionId?:number|null;teacherName:string;dutyName:string;className?:string|null;serviceName?:string|null;profileImageUrl?:string|null;status:string};
export function rosterWeek(date:string) {
  const start=new Date(`${date}T12:00:00Z`);start.setUTCDate(start.getUTCDate()-start.getUTCDay());
  const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
const label=(date:string)=>new Intl.DateTimeFormat("en-NG",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));
export function weeklyRosterRows(items:WeeklyAssignment[],date:string) {
  const groups=new Map<string,{item:WeeklyAssignment;roles:Set<string>}>();
  for(const item of items){
    // A download from a dated roster row belongs to that date, not its surrounding week.
    if(item.assignmentDate!==date||["CANCELLED","REPLACED"].includes(item.status))continue;
    const key=`${item.userId}:${item.assignmentDate}:${item.serviceSessionId||0}`;
    const group=groups.get(key)||{item,roles:new Set<string>()};
    group.roles.add([item.dutyName,item.className].filter(Boolean).join(" - "));groups.set(key,group);
  }
  return [...groups.values()].sort((a,b)=>a.item.assignmentDate.localeCompare(b.item.assignmentDate)||a.item.teacherName.localeCompare(b.item.teacherName));
}
export function monthlyRosterRows(items:WeeklyAssignment[],month:string) {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error("Choose a valid roster month.");
  const dates=[...new Set(items.filter(item=>item.assignmentDate.startsWith(`${month}-`)).map(item=>item.assignmentDate))].sort();
  return dates.flatMap(date=>weeklyRosterRows(items,date));
}
export async function downloadMonthlyRosterPdf(items:WeeklyAssignment[],month:string,personal=false) {
  const groups=monthlyRosterRows(items,month);
  if(!groups.length)throw new Error("There are no responsibilities to download for this month.");
  const images=new Map<number,ReturnType<typeof loadPdfAvatar>>();
  groups.forEach(({item})=>{if(!images.has(item.userId))images.set(item.userId,loadPdfAvatar(item.profileImageUrl));});
  const photos=await Promise.all(groups.map(({item})=>images.get(item.userId)!));
  const monthLabel=new Intl.DateTimeFormat("en-NG",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${month}-01T12:00:00Z`));
  const name=personal?groups[0].item.teacherName.replace(/[^a-z0-9]+/gi,"-")+"-":"";
  await downloadTablePdf(`TPK-${name}${month}-roster.pdf`,{
    identity:personal?{name:groups[0].item.teacherName,photo:photos[0],label:"Teacher roster"}:undefined,
    title:personal?"My Teaching Roster":"Monthly Team Roster",subtitle:`${monthLabel} | All dates in the selected view`,
    columns:["Photo","Teacher","Date","Service","Assigned roles"],widths:[.45,1.6,.8,1.6,2.1],photos,avatarNames:groups.map(({item})=>item.teacherName),
    rows:groups.map(({item,roles})=>["",item.teacherName,label(item.assignmentDate),item.serviceName||"Ministry activity",[...roles].join("; ")]),
  });
}
function avatar(source?:string|null):Promise<{hex:string;width:number;height:number}|null> {
  return new Promise(resolve=>{
    const url=mediaUrl(source);if(!url){resolve(null);return;}
    const image=new Image();let finished=false;
    const finish=(value:{hex:string;width:number;height:number}|null)=>{if(finished)return;finished=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>finish(null),4000);image.crossOrigin="anonymous";
    image.onload=()=>{try{const canvas=document.createElement("canvas");canvas.width=96;canvas.height=96;const ctx=canvas.getContext("2d");if(!ctx)return finish(null);const side=Math.min(image.naturalWidth,image.naturalHeight);ctx.fillStyle="#ffffff";ctx.fillRect(0,0,96,96);ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,96,96);const bytes=atob(canvas.toDataURL("image/jpeg",.85).split(",")[1]);finish({hex:Array.from(bytes,char=>char.charCodeAt(0).toString(16).padStart(2,"0")).join(""),width:96,height:96});}catch{finish(null);}};
    image.onerror=()=>finish(null);image.src=url;
  });
}
export async function downloadWeeklyRosterPdf(items:WeeklyAssignment[],date:string) {
  const groups=weeklyRosterRows(items,date),images=new Map<number,Promise<Awaited<ReturnType<typeof avatar>>>>();
  groups.forEach(({item})=>{if(!images.has(item.userId))images.set(item.userId,avatar(item.profileImageUrl));});
  const photos=await Promise.all(groups.map(({item})=>images.get(item.userId)!));
  await downloadTablePdf(`TPK-${date}-roster.pdf`,{
    title:"Team Roster",subtitle:`${label(date)} | Assignments for this date only`,
    columns:["Photo","Teacher","Date","Service","Assigned roles"],widths:[.45,1.6,.8,1.6,2.1],photos,avatarNames:groups.map(({item})=>item.teacherName),
    rows:groups.map(({item,roles})=>[item.teacherName.split(/\s+/).slice(-2).map(word=>word[0]).join(""),item.teacherName,label(item.assignmentDate),item.serviceName||"Ministry activity",[...roles].join("; ")]),
  });
}
