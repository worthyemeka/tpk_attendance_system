const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/classroom-attendance.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const exportsObject = {};
new Function('exports', compiled.outputText)(exportsObject);
const status = exportsObject.classroomAttendanceStatus;
const data = {
  serviceSession: { id: '101', serviceDate: '2026-10-04' },
  monthly: {
    presentByDate: { '2026-10-04': [3], '2026-09-27': [1] },
    presentBySession: { '99': [1], '100': [3] },
  },
};
const child = { id: '1', todayStatus: 'PRESENT', joinedAt: '2026-10-05' };
assert.equal(status(data, child, { id: 101, serviceDate: '2026-10-04' }), 'PRESENT', 'Selected-service attendance must match the Children tab, even if history is stale.');
assert.equal(status(data, { ...child, todayStatus: 'ABSENT' }, { id: '101', serviceDate: '2026-10-04' }), 'ABSENT');
assert.equal(status(data, child, { id: 99, serviceDate: '2026-09-27' }), 'PRESENT', 'String child IDs must match numeric attendance IDs; a real check-in overrides a corrected joining date.');
assert.equal(status(data, { ...child, joinedAt: '2026-09-01' }, { id: 100, serviceDate: '2026-10-04' }), 'ABSENT', 'Different services on the same Sunday must not share attendance.');
assert.equal(status(data, child, { id: 100, serviceDate: '2026-10-04' }), 'NOT_REGISTERED');
assert.equal(status({ monthly: { presentByDate: { '2026-09-27': ['1'] } } }, child, { id: 99, serviceDate: '2026-09-27' }), 'PRESENT', 'Support older API responses during deployment.');
console.log('Classroom attendance regression checks passed (6 cases).');
