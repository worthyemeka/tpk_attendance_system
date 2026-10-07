export type EventPalette = {primary:string;secondary:string;accent:string;surface:string;text:string;onPrimary:string;onAccent:string};
export const junglePalette:EventPalette={primary:"#46501c",secondary:"#392b17",accent:"#d9a52c",surface:"#faf8ef",text:"#29321d",onPrimary:"#ffffff",onAccent:"#171c11"};
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const hex=(c:number[])=>"#"+c.map(v=>Math.round(v).toString(16).padStart(2,"0")).join("");
export function luminance(colour:string){return rgb(colour).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);}
export function contrast(a:string,b:string){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function darken(c:string){let v=rgb(c);while(contrast(hex(v),"#ffffff")<4.5)v=v.map(x=>x*.9);return hex(v);}
// Small quantised histogram, ignoring transparent/background-like pixels. No
// external image service: pixels and palette stay on the user's device.
export function paletteFromPixels(pixels:ArrayLike<number>):EventPalette{
 const bins=new Map<string,{n:number;c:number[]}>();
 for(let i=0;i<pixels.length;i+=4){const c=[pixels[i],pixels[i+1],pixels[i+2]],hi=Math.max(...c),lo=Math.min(...c);if(pixels[i+3]<180||hi-lo<22||hi<35||lo>235)continue;const key=c.map(v=>Math.floor(v/32)).join(",");const b=bins.get(key)||{n:0,c:[0,0,0]};b.n++;c.forEach((v,j)=>b.c[j]+=v);bins.set(key,b);}
 const colours=[...bins.values()].sort((a,b)=>b.n-a.n).slice(0,24).map(b=>hex(b.c.map(v=>v/b.n)));
 if(!colours.length)throw Error("This image has no clear foreground colours. Try a coloured logo or choose the Jungle preset.");
 const green=colours.find(c=>{const[r,g,b]=rgb(c);return g>r*.9&&g>b*1.25;});const primary=darken(green||colours[0]);
 const accent=colours.find(c=>{const[r,g,b]=rgb(c);return r>130&&g>75&&b<g*.75;})||colours.find(c=>contrast(c,primary)>2)||colours[0];
 const secondary=darken([...colours].sort((a,b)=>luminance(a)-luminance(b))[0]);
 return {primary,secondary,accent,surface:hex(rgb(accent).map(v=>v*.06+255*.94)),text:darken(primary),onPrimary:"#ffffff",onAccent:contrast(accent,"#171c11")>=4.5?"#171c11":"#ffffff"};
}
export async function scanEventImage(file:File):Promise<EventPalette>{
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>25*1024*1024)throw Error("Choose a PNG, JPG or WebP image up to 25 MB.");
 const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>16000000)throw Error("Use artwork under 16 megapixels.");const canvas=document.createElement("canvas");canvas.width=canvas.height=96;const ctx=canvas.getContext("2d");if(!ctx)throw Error("Colour scanning is unavailable in this browser.");ctx.drawImage(image,0,0,96,96);return paletteFromPixels(ctx.getImageData(0,0,96,96).data);}finally{URL.revokeObjectURL(url);}
}
export function paletteStyle(palette?:EventPalette|null):Record<string,string>{const p=palette||junglePalette;return Object.fromEntries(Object.entries(p).map(([k,v])=>[`--event-${k.replace(/[A-Z]/g,m=>"-"+m.toLowerCase())}`,v]));}
