const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
const{organiseNotes,resourceNotes}=require('../src/lib/curriculum-notes.ts'),{createNotePdf}=require('../src/lib/curriculum-note-pdf.ts');
const source='GAME 8:\nClap only when the ball drops.\nThe kids form a circle around a teacher holding a ball.\nThey clap whenever the teacher drops the ball.\nItems Needed : a big football.';
const blocks=organiseNotes(source);assert.equal(blocks[0].type,'heading');assert.equal(blocks.at(-2).text,'Items Needed');assert.equal(blocks.at(-1).text,'a big football.');assert.ok(blocks.filter(b=>b.type==='paragraph').length>=3);
assert.deepEqual(organiseNotes('# Preparation\n\nRead the lesson.\n\n- Ball\n- Space').map(b=>b.type),['heading','paragraph','list']);assert.equal(resourceNotes({content:'Original',noteBlocks:[{type:'heading',text:'Saved'}]})[0].text,'Saved');
assert.throws(()=>createNotePdf({title:'Picture',eventName:'VBS',type:'GAME',blocks:[{type:'image',fileId:7}]}));
(async()=>{const report={title:'Clap When the Ball Drops',eventName:'VBS 2026 - The Great Jungle Journey',type:'GAME',scope:'Monday - Whole event',blocks:[...blocks,{type:'heading',text:'Additional teacher guidance'},{type:'paragraph',text:('Keep the children safe and explain the rules clearly. ').repeat(250)},{type:'paragraph',text:'W'.repeat(300)}]};const pdf=await createNotePdf(report).text();assert.match(pdf,/%PDF-1.4/);assert.match(pdf,/Page 2/);assert.match(pdf,/Items Needed/);assert.match(pdf,/How|GAME 8/);assert.ok(!pdf.includes('undefined'));console.log('PASS: organised source notes, section overrides, missing picture errors and multipage styled PDF.');})();

const multiline=organiseNotes('First instruction\nSecond instruction');assert.equal(multiline[0].text,'First instruction\nSecond instruction');
const bank=resourceNotes({noteBlocks:[{type:'paragraph',text:'Ages 5–8 (Beginner) M D A A (Clue: First man) V E E (Clue: First woman) Ages 9–12 (Intermediate) T I O N R E A C (Clue: The world)'}]});
assert.deepEqual(bank.map(b=>b.type),['heading','list','heading','list']);assert.equal(bank[1].text.split('\n').length,2);assert.match(bank[3].text,/T I O N R E A C/);
