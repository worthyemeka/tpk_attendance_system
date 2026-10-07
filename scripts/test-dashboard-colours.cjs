const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
require.extensions['.css']=()=>{};
const {dashboardPaletteStyle,junglePalette,contrast,paletteFromPixels}=require('../src/lib/event-palette.ts');
const jungle=dashboardPaletteStyle(junglePalette,true);
assert.equal(jungle['--theme-sidebar'],'#173f2b');assert.equal(jungle['--theme-button'],'#ffd34e');assert.equal(jungle['--theme-button-ink'],'#963b0b');
for(const colours of [jungle,dashboardPaletteStyle(paletteFromPixels([95,120,20,255,240,180,25,255,50,30,15,255]),true)]){
 for(const role of ['--theme-body','--theme-panel','--theme-sidebar'])assert.ok(contrast(colours[role],'#ffffff')>=4.5,role);
 assert.ok(contrast(colours['--theme-button'],colours['--theme-button-ink'])>=4.5);
}
const {renderToStaticMarkup}=require('react-dom/server'),React=require('react'),{ChildrenGrid,ChildrenList}=require('../src/components/children-records.tsx');
const row={id:1,name:'Sample Child',firstName:'Sample',lastName:'Child',homeCampus:'Petra Mabushi (Regional Campus)',guardianName:'Sample Guardian',guardianPhone:'PRIVATE_PHONE',age:77,gender:'PRIVATE_GENDER',lastAttended:'2026-10-04'};
for(const Component of [ChildrenGrid,ChildrenList]){
 const markup=renderToStaticMarkup(React.createElement(Component,{rows:[row],onOpen:()=>{},restricted:true,sort:'name',order:'asc',onSort:()=>{}}));
 for(const text of ['Sample Child','Sample Guardian','record-child-avatar','record-profile-action'])assert.ok(markup.includes(text),text);
 for(const text of ['Petra Mabushi','Campus','PRIVATE_PHONE','PRIVATE_GENDER','77 years','No attendance','Phone not provided','Last attended'])assert.ok(!markup.includes(text),text);
}
const teacher=fs.readFileSync('src/components/teacher-child-directory.tsx','utf8');assert.ok(!teacher.includes('events-workspace'));assert.ok(!teacher.includes('EventDialog'));assert.ok(teacher.includes('DirectoryPagination'));assert.ok(teacher.includes('DataViewToggle'));
console.log('PASS: dashboard colour contrast, shared child cards/table and teacher privacy-safe presentation.');
