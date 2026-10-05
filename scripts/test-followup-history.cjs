const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
const { historyDay, groupFollowupHistory, historyEventLabel } = require('../src/lib/followup-history.ts');
const entries = [
  { id: 1, eventType: 'CASE_CREATED', createdAt: '2026-09-27 09:00:00', staffName: 'TPK Team' },
  { id: 2, eventType: 'ASSIGNED', createdAt: '2026-10-04 12:00:00', staffName: 'Grace' },
  { id: 3, eventType: 'CONTACTED', createdAt: '2026-10-04 14:00:00', staffName: 'Daniel' },
  { id: 4, eventType: 'RESOLVED', createdAt: '2026-10-05T23:30:00Z', staffName: 'Grace' },
  { id: 5, eventType: 'UPDATED', createdAt: 'unknown', staffName: 'TPK Team' },
];
assert.equal(historyDay('2026-10-05T23:30:00Z'), '2026-10-06');
assert.equal(historyDay('2026-10-05 00:30:00'), '2026-10-05');
assert.equal(historyDay('unknown'), '');
assert.deepEqual(groupFollowupHistory(entries).map(group => group.date), ['2026-10-06', '2026-10-04', '2026-09-27', '']);
assert.deepEqual(groupFollowupHistory(entries, '2026-10').map(group => group.items.map(entry => entry.id)), [[4], [3, 2]]);
assert.deepEqual(groupFollowupHistory(entries, '2026-10', '2026-10-04')[0].items.map(entry => entry.id), [3, 2]);
assert.equal(groupFollowupHistory(entries, '2026-08').length, 0);
assert.equal(groupFollowupHistory([]).length, 0);
assert.equal(entries[0].id, 1, 'Filtering must not mutate the API history.');
assert.equal(historyEventLabel('CASE_CREATED'), 'Follow-up opened');
assert.equal(historyEventLabel('FOLLOW_UP_REPORT_SENT'), 'Follow up report sent');
console.log('PASS: calendar month/day filtering, newest-first groups, campus timezone, empty/invalid dates and readable labels.');
