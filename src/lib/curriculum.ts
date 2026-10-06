export type CurriculumClass = { id:number;name:string;ageLabel:string;minAge:number;maxAge:number;displayOrder:number;active:boolean|number;children:number;description?:string };
export type TeachingResource = { id:number;classId:number;weekDate:string|null;type:"LESSON"|"VIDEO"|"GAME";title:string;topic?:string;description?:string;videoUrl?:string;durationMinutes?:number;setting?:string;materials?:string;instructions?:string;fileName?:string;downloadUrl?:string;mimeType?:string;size?:number;createdAt:string;author:string;authorId:number;authorProfileImageUrl?:string };
export function sundayWeeks(month:string):string[]{
  const [year,m]=month.split("-").map(Number);const day=new Date(Date.UTC(year,m-1,1));const dates:string[]=[];
  day.setUTCDate(day.getUTCDate()+(7-day.getUTCDay())%7);
  while(day.getUTCMonth()===m-1){dates.push(day.toISOString().slice(0,10));day.setUTCDate(day.getUTCDate()+7);}return dates;
}
export function resourceDate(value:string):string{return new Intl.DateTimeFormat("en-NG",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(value.slice(0,10)+"T12:00:00Z"));}
export function visibleResources(items:TeachingResource[],query:string,kind:string,week:string,classId:string){
  const q=query.trim().toLowerCase();return items.filter(item=>(!kind||item.type===kind)&&(!week||!item.weekDate||item.weekDate===week)&&(!classId||Number(item.classId)===Number(classId))&&(!q||[item.title,item.topic,item.description,item.materials].join(" ").toLowerCase().includes(q)));
}
