const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,f);
require.extensions['.css']=()=>{};
const {dashboardPaletteStyle,junglePalette,contrast,paletteFromPixels}=require('../src/lib/event-palette.ts');
const jungle=dashboardPaletteStyle(junglePalette,true);
assert.equal(jungle['--theme-sidebar'],'#173f2b');assert.equal(jungle['--theme-button'],'#ffffff');assert.equal(jungle['--theme-accent'],'#ffd34e');assert.equal(jungle['--theme-button-ink'],'#963b0b');
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
const {StatCard}=require('../src/components/stat-card.tsx');
const stat=renderToStaticMarkup(React.createElement(StatCard,{icon:'Sample',value:53,title:'Children',description:'All records',onClick:()=>{}}));
assert.match(stat,/<button data-theme-control="surface"/,'Clickable statistics must remain card surfaces');
for(const file of ['src/components/attention-panel.tsx','src/app/account/overview/page.tsx'])assert.ok(fs.readFileSync(file,'utf8').includes('data-theme-control="surface"'),file);
const css=fs.readFileSync('src/components/event-appearance.css','utf8');
assert.ok(css.includes('button:not(:where([data-theme-control="surface"]))'),'Exclude record surfaces from yellow actions');
for(const selector of ['.upcoming-service-list>div','.relation-numbers>b','.overview-card','.code-card form:first-of-type>label',':focus-within','[aria-selected="true"]',':autofill','-webkit-text-fill-color:var(--theme-ink)'])assert.ok(css.includes(selector),selector);
assert.match(css,/table tbody tr>td\{background:transparent!important\}/,'Legacy cell hover backgrounds must not leak white');
assert.match(css,/tr:is\([^\n]+\)\{background:#21140d38!important/,'Focused and selected rows use translucent brown');
assert.ok(css.includes('label:has(>input[placeholder*="search" i])'),'Search wrapper coverage must include directories without a shared class');
assert.match(css,/\.guardian-search,\.teacher-search,\.search-row[^\n]+background:transparent/,'Entire search wrapper must use the theme surface');
assert.match(css,/\.setting-icon,\.card-title>i[^\n]+color:#963b0b!important/,'Pale icon tiles need burnt-orange ink');
for(const pale of ['#fff0e9','#e7f7ee','#fff0ef'])assert.ok(contrast(pale,'#963b0b')>=4.5,'Pale icon contrast');
assert.match(css,/:is\(a,\.settings-grid button\)\{background:transparent!important;[^\n]+color:var\(--theme-accent\)!important/,'Text links and sign out must be yellow without a fill');
console.log('PASS: dashboard colour contrast, shared child cards/table and teacher privacy-safe presentation.');
