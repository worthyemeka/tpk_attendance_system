const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/' + name + '.ts'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
  const exports = {};
  new Function('exports', 'require', compiled.outputText)(exports, module => load(module.replace('./', '')));
  return exports;
}
const { sundaySignInAvailable, overviewRolesHeading } = load('overview-attendance');
const first = {kind:'SUNDAY',startsAt:'2026-10-11 08:30:00',endsAt:'2026-10-11 10:15:00'};
const second = {...first,startsAt:'2026-10-11 10:30:00',endsAt:'2026-10-11 12:30:00'};
for (const service of [first, second]) {
  assert.equal(sundaySignInAvailable(service, '2026-10-11 05:59:59'), false);
  assert.equal(sundaySignInAvailable(service, '2026-10-11 06:00:00'), true);
  assert.equal(sundaySignInAvailable(service, '2026-10-07 12:00:00'), false);
  assert.equal(sundaySignInAvailable(service, service.endsAt), false);
}
assert.equal(sundaySignInAvailable(first, '2026-10-11 10:15:00'), false);
assert.equal(sundaySignInAvailable(second, '2026-10-11 10:15:00'), true);
assert.equal(sundaySignInAvailable({...first,kind:'MDWK'},'2026-10-11 06:00:00'),false);
assert.equal(overviewRolesHeading(['2026-10-11','2026-10-11'],'2026-10-07'),'Your roles on Sunday');
assert.equal(overviewRolesHeading(['2026-10-11'],'2026-10-11'),'Your roles today');
assert.equal(overviewRolesHeading(['2026-10-04'],'2026-10-07'),'Your roles for Sunday, 4 Oct');
assert.equal(overviewRolesHeading(['2026-10-04','2026-10-11'],'2026-10-07'),'Your scheduled roles');
assert.equal(overviewRolesHeading(['2026-11-01'],'2026-10-31'),'Your roles on Sunday');
console.log('PASS: overview roles and separate Sunday service 6am boundaries (16 assertions).');
