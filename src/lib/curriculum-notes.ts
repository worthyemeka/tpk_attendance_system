export type NoteBlock = {type:"heading"|"paragraph"|"list"|"image";text?:string;fileId?:number;caption?:string};
/** Layout only: imported source text is never rewritten in storage. */
export function organiseNotes(content:string):NoteBlock[]{
 const lines=content.replace(/\r/g,"").split("\n");const blocks:NoteBlock[]=[];let paragraph:string[]=[];let list:string[]=[];
 const flush=()=>{if(paragraph.length){blocks.push({type:"paragraph",text:paragraph.join(" ")});paragraph=[];}if(list.length){blocks.push({type:"list",text:list.join("\n")});list=[];}};
 for(const raw of lines){const line=raw.trim();if(!line){flush();continue;}
  const labelled=line.match(/^(Items? Needed|Materials?|Equipment|Instructions?|How to play|Preparation|Objective|Examples?|Bible reference|Memory verse|Teaching points?)\s*:\s*(.*)$/i);
  if(labelled){flush();blocks.push({type:"heading",text:labelled[1]});if(labelled[2])blocks.push({type:"paragraph",text:labelled[2]});continue;}
  if(/^#{1,3}\s+/.test(line)||/^(?:GAME|DAY|LESSON|ACTIVITY)\s+\d+\s*:?$/i.test(line)||(/^[A-Z\d\s&:()/-]+$/.test(line)&&line.length<90)){
   flush();blocks.push({type:"heading",text:line.replace(/^#{1,3}\s+/,"").replace(/:$/,"")});continue;
  }
  if(/^(?:[•●*-]\s+|\d+[.)]\s+)/.test(line)){if(paragraph.length)flush();list.push(line.replace(/^(?:[•●*-]\s+|\d+[.)]\s+)/,""));continue;}
  if(list.length)flush();if(paragraph.length&&/[.!?]$/.test(paragraph[paragraph.length-1]))flush();paragraph.push(line);
 }
 flush();return blocks;
}
export function resourceNotes(resource:{noteBlocks?:NoteBlock[];content?:string}):NoteBlock[]{return resource.noteBlocks?.length?resource.noteBlocks:organiseNotes(resource.content||"");}
