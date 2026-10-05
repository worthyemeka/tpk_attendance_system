// Uses installed TypeScript to exercise the actual exporter, without connecting to an API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {rosterWeek,weeklyRosterRows}=require('../src/lib/weekly-roster-pdf.ts');
const {createTablePdf}=require('../src/lib/table-pdf.ts');
assert.deepEqual(rosterWeek('2026-10-08'),{start:'2026-10-04',end:'2026-10-10'});
assert.deepEqual(rosterWeek('2027-01-01'),{start:'2026-12-27',end:'2027-01-02'});
const item=(id,date,duty,status='ASSIGNED',userId=1,serviceSessionId=101)=>({id,userId,teacherName:'Sample Teacher',assignmentDate:date,serviceSessionId,dutyName:duty,status});
const rows=weeklyRosterRows([item(1,'2026-10-04','Attendance'),item(2,'2026-10-04','Head of Service'),item(3,'2026-10-08','Prayers'),item(4,'2026-10-11','Assembly'),item(5,'2026-10-04','Assembly','CANCELLED'),item(6,'2026-10-04','Assembly','ASSIGNED',1,102)],'2026-10-04');
assert.equal(rows.length,3);assert.ok(rows.some(row=>[...row.roles].join(';')==='Attendance;Head of Service'));
assert.ok(rows.some(row=>row.item.serviceSessionId===102));
const pdf=createTablePdf({title:'Weekly Roster',columns:['Teacher','Assigned roles'],rows:Array.from({length:30},()=>['Sample Teacher','Attendance; Head of Service']),photos:Array(30).fill(null)});
pdf.text().then(text=>{assert.ok(text.startsWith('%PDF-1.4'));assert.ok(text.includes('Head of Service'));assert.ok(text.includes('/Count 4'));console.log('PASS: stacked roles, cancelled and next-week exclusion, service IDs, year boundary and multipage PDF');});
