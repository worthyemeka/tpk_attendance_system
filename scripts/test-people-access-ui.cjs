const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let access = 'checking';
const source = fs.readFileSync('src/components/account-guard.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const moduleForView = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => {
  if (name === '@/lib/use-people-access') return { usePeopleAccess: () => access };
  if (name.startsWith('@/') || name === 'next/navigation') return {};
  return require(name);
}, moduleForView, moduleForView.exports);
for (const state of ['checking', 'denied', 'unavailable', 'allowed']) {
  access = state;
  const html = renderToStaticMarkup(React.createElement(moduleForView.exports.PeopleRecordsGuard, { children: React.createElement('div', {}, 'PRIVATE_RECORD_FIXTURE') }));
  assert.equal(html.includes('PRIVATE_RECORD_FIXTURE'), state === 'allowed', `${state} must not mount private records`);
}
const shell = fs.readFileSync('src/components/app-shell.tsx', 'utf8');
assert.ok(shell.includes('(children|guardians|families|check-in|pick-up|relations)'));
assert.ok(shell.includes('<PeopleRecordsGuard key={pathname}>'));
const sidebar = fs.readFileSync('src/components/sidebar.tsx', 'utf8');
assert.ok(sidebar.includes('usePeopleAccess() === "allowed"'));
assert.ok(!sidebar.includes('/api/v1/check-ins'));
const hook = fs.readFileSync('src/lib/use-people-access.ts', 'utf8');
assert.ok(hook.includes('/api/v1/me/people-access') && hook.includes('cache: "no-store"'));
assert.ok(hook.includes('60_000') && hook.includes('visibilitychange'));
assert.ok(!hook.includes('serviceSessionId'));
console.log('PASS: restricted page children never mount while checking, denied or unavailable; server permission navigation, weekly refresh and no selected-date bypass.');
