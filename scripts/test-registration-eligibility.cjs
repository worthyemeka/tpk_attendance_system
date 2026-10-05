const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, dependencies = require) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {}; new Function('exports', 'require', code)(exports, dependencies); return exports;
}
const helpers = load('src/lib/registration-eligibility.ts');
const today = '2026-10-05';
const cases = [
  ['2023-10-06','UNDER_THREE'], ['2023-10-05','ELIGIBLE'], ['2023-10-04','ELIGIBLE'],
  ['2024-11-19','UNDER_THREE'], ['2018-11-19','ELIGIBLE'], ['2027-01-01','INVALID_DATE'],
  ['2026-02-30','INVALID_DATE'], ['','INVALID_DATE'], ['2024-02-29','UNDER_THREE'],
];
for (const [dob, expected] of cases) assert.equal(helpers.registrationEligibility(dob,today),expected,dob);
assert.equal(helpers.registrationEligibility('2024-02-29','2027-02-28'),'UNDER_THREE');
assert.equal(helpers.registrationEligibility('2024-02-29','2027-03-01'),'ELIGIBLE');
assert.equal(helpers.campusToday(new Date('2026-10-04T23:30:00Z')),today,'Use Lagos day, not browser timezone.');
const { ReviewStep } = load('src/components/new-child-registration.tsx', name => {
  if (name === '@/lib/registration-eligibility') return helpers;
  if (name.endsWith('.css')) return {};
  if (name.startsWith('@/components/')) return {};
  if (name === '@/lib/session') return {};
  return require(name);
});
const props = { guardian:{firstName:'Grace',lastName:'Bennett',relationship:'Mother',primaryPhone:'08000000000',address:'Sample address'},pickupMode:'SELF',picker:{},service:'Sunday service',back(){},editChildren(){},submit(){},saving:false };
const child = {id:1,firstName:'Maya',lastName:'Bennett',dateOfBirth:'2025-01-01'};
const render = children => renderToStaticMarkup(React.createElement(ReviewStep,{...props,children}));
const blocked = render([child]);
assert.match(blocked,/role="alert"/);
assert.match(blocked,/not three years old/);
assert.match(blocked,/Maya Bennett/);
assert.match(blocked,/disabled=""/);
assert.match(blocked,/Review children/);
assert.match(render([{...child,dateOfBirth:helpers.campusToday(new Date(new Date().getTime() - 86400000))}]),/disabled=""/);
assert.doesNotMatch(render([{...child,dateOfBirth:'2018-11-19'}]),/disabled=""|registration-age-notice/);
assert.match(render([{...child,id:2,dateOfBirth:'2018-11-19'},child]),/disabled=""/,'One younger sibling must not slip through.');
console.log('Registration age and final-review checks passed (20 assertions).');
