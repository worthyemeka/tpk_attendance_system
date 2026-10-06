const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { sundayRosterColumns, matchesSundayRosterColumn } = require('../src/lib/sunday-roster-columns.ts');
const { weeklyRosterRows } = require('../src/lib/weekly-roster-pdf.ts');
const { classForBirthDate } = require('../src/lib/automatic-class.ts');
const classes = [
  { id: 2, name: 'Tribe A', ageLabel: 'Ages 9–11', minAge: 9, maxAge: 11 },
  { id: 3, name: 'Tribe B', ageLabel: 'Ages 6–8', minAge: 6, maxAge: 8 },
  { id: 4, name: 'Tribe C', ageLabel: 'Ages 3–5', minAge: 3, maxAge: 5 },
  { id: 1, name: 'TribePetra Teens', ageLabel: 'Ages 12–19', minAge: 12, maxAge: 19 },
];
const columns = sundayRosterColumns(classes);
assert.deepEqual(columns.filter(item => item.code === 'CLASS_TEACHER').map(item => item.classId), [2, 3, 4, 1]);
const teens = columns.find(item => item.classId === 1);
assert.equal(teens.label, 'TribePetra Teens');
assert.equal(teens.sub, 'Ages 12–19');
assert.ok(matchesSundayRosterColumn({ dutyCode: 'CLASS_TEACHER', classId: 1 }, teens));
assert.ok(!matchesSundayRosterColumn({ dutyCode: 'CLASS_TEACHER', classId: 2 }, teens));
assert.ok(!matchesSundayRosterColumn({ dutyCode: 'ASSEMBLY', classId: 1 }, teens));
assert.ok(matchesSundayRosterColumn({ dutyCode: 'CLASS_TEACHER', classId: '1' }, teens));
assert.equal(sundayRosterColumns([{ id: 1, name: 'Renamed Teens', ageLabel: 'Ages 12–19' }])[1].label, 'Renamed Teens');
assert.ok(sundayRosterColumns([...classes, { id: 5, name: 'Additional configured class' }]).some(item => item.classId === 5));
assert.equal(classForBirthDate(classes, '2014-10-06', '2026-10-06').id, 1);
assert.equal(classForBirthDate(classes, '2007-10-06', '2026-10-06').id, 1);
const assignment = { id: 1, userId: 99, assignmentDate: '2026-10-11', status: 'ASSIGNED', dutyCode: 'CLASS_TEACHER', dutyName: 'Class Teacher', classId: 1, className: 'TribePetra Teens', teacherName: 'Sample teacher' };
assert.ok([...weeklyRosterRows([assignment], '2026-10-11')[0].roles].some(role => role.includes('TribePetra Teens')));
const roster = fs.readFileSync('src/app/account/roster/page.tsx', 'utf8');
// Render the actual roster views, including the Teens cell, rather than only
// testing a helper that the UI might fail to use.
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const viewSource = `import { useState } from 'react';
import { FiCalendar, FiPlus, FiDownload } from 'react-icons/fi';
const mediaUrl = value => value;
const initials = name => name.slice(0, 2);
const formatDate = value => value;
${roster.slice(roster.indexOf('function Avatar('), roster.indexOf('function NonTeachingGrid('))}
export { SundayGrid, SundayList, SundayCalendar };`;
const viewModule = { exports: {} };
const viewCode = ts.transpileModule(viewSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
new Function('require', 'module', 'exports', viewCode)(require, viewModule, viewModule.exports);
for (const name of ['SundayGrid', 'SundayList', 'SundayCalendar']) {
  const props = { columns, dates: ['2026-10-11'], assignments: (date, column) => matchesSundayRosterColumn(assignment, column) ? [assignment] : [], onTeacher() {}, onAssign() {}, onDownload() {}, readOnly: true, locked: false, loading: false, downloading: false };
  const html = renderToStaticMarkup(React.createElement(viewModule.exports[name], props));
  assert.ok(html.includes('TribePetra Teens') && html.includes('Sample teacher'), `${name} must render a Teens assignment`);
  assert.ok(html.includes('Ages 12–19'));
  const empty = renderToStaticMarkup(React.createElement(viewModule.exports[name], { ...props, assignments: () => [] }));
  assert.ok(empty.includes('TribePetra Teens') && empty.includes('Unfilled'), `${name} must retain Teens even without assignments`);
}
for (const view of ['SundayGrid', 'SundayList', 'SundayCalendar']) {
  assert.ok(new RegExp(`<${view}\\s+columns=\\{sundayColumns\\}`).test(roster), `${view} must use configured classes`);
}
assert.ok(roster.includes('sundayColumns.map((item) => ({'), 'Monthly exports must use configured columns');
assert.ok(!roster.includes('className: "Tribe A"'), 'No fixed classroom allowlist');
const classrooms = fs.readFileSync('src/components/classrooms-workspace.tsx', 'utf8');
assert.ok(classrooms.includes('fetch(`${apiBase}/api/v1/classes`'));
assert.ok(classrooms.includes('{classOptions.map((item) => ('), 'Class choices must survive search/status/service filters');
console.log('PASS: all configured classes in grid/list/calendar and monthly/weekly exports; ID-based matching; Teens age placement; stable classroom filters.');
