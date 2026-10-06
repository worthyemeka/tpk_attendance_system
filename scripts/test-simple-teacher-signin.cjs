const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const source = fs.readFileSync('src/components/teacher-attendance-workspace.tsx', 'utf8');
assert.ok(!source.includes('SecuritySetup') && !source.includes('AcceptedAnswers'));
assert.ok(!source.includes('/challenge') && !source.includes('/security'));
assert.ok(!source.includes('Answer verified'));
assert.ok(source.includes('Teachers Welfare') && source.includes('Assign follow-up'));
const component = source.slice(source.indexOf('export function SundayAttendanceButton('));
const moduleForView = { exports: {} };
const code = ts.transpileModule(`import {useState,useEffect} from 'react';import {FiCheckCircle} from 'react-icons/fi';const teacherAttendanceRequest=()=>Promise.resolve({});${component}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function('require', 'module', 'exports', code)(require, moduleForView, moduleForView.exports);
const service = { id: 1, kind: 'SUNDAY', name: 'First Service', startsAt: '2026-10-11 08:30:00', endsAt: '2026-10-11 10:30:00' };
const html = renderToStaticMarkup(React.createElement(moduleForView.exports.SundayAttendanceButton, { service, serverTime: '2026-10-11 09:00:00' }));
assert.ok(html.includes('I’m here') && !html.includes('disabled'));
assert.ok(!html.includes('<input') && !html.includes('question'));
for (const time of ['2026-10-11 08:29:59', '2026-10-11 10:30:00']) {
  const closed = renderToStaticMarkup(React.createElement(moduleForView.exports.SundayAttendanceButton, { service, serverTime: time }));
  assert.ok(closed.includes('disabled'));
}
assert.ok(renderToStaticMarkup(React.createElement(moduleForView.exports.SundayAttendanceButton, { service, serverTime: '2026-10-11 09:00:00', present: true })).includes('You’re marked present'));
// Exercise the actual click handler with lightweight hook state and a request spy.
let values = [], cursor = 0, calls = [], saved = 0;
const fakeReact = { ...React, useEffect() {}, useState(initial) { const key = cursor++; if (!(key in values)) values[key] = initial; return [values[key], value => { values[key] = value; }]; } };
const request = async (...args) => { calls.push(args); return {}; };
const interactionModule = { exports: {} };
const interactionCode = ts.transpileModule(`import {useState,useEffect} from 'react';import {FiCheckCircle} from 'react-icons/fi';import {teacherAttendanceRequest} from './request';${component}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
new Function('require', 'module', 'exports', interactionCode)(name => name === 'react' ? fakeReact : name === './request' ? { teacherAttendanceRequest: request } : require(name), interactionModule, interactionModule.exports);
(async () => {
  const props = { service, serverTime: '2026-10-11 09:00:00', onSaved: () => saved++ };
  const tree = interactionModule.exports.SundayAttendanceButton(props);
  tree.props.children[0].props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['/services/1/sign-in', 'POST', { attended: true }]]);
  assert.equal(saved, 1);
  cursor = 0;
  const result = interactionModule.exports.SundayAttendanceButton(props);
  assert.ok(result.props.children[0].props.disabled);
  assert.ok(renderToStaticMarkup(result).includes('Your attendance for First Service is recorded.'));
  console.log('PASS: one-tap self-confirmation, no question/setup UI, service-window boundaries, present state and register refresh; welfare UI retained.');
})().catch(error => { console.error(error); process.exitCode = 1; });
