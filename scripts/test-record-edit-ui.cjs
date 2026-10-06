const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const child = read('src/components/child-directory.tsx');
assert.match(child, /careInformation: careInformation.trim\(\) \|\| null/);
assert.doesNotMatch(child, /const careResponse = await fetch/);
assert.match(child, /disabled=\{saving \|\| !careLoaded\}/);
const guardian = read('src/components/guardian-directory.tsx');
assert.match(guardian, /edit=\{isSuperAdmin\(session\)/);
assert.match(guardian, /className="drawer-edit" onClick=\{edit\}/);
const editor = read('src/components/guardian-record-editor.tsx');
assert.match(editor, /<AppSelect aria-label="Guardian relationship"/);
assert.match(editor, /method: "PATCH"/);
assert.match(editor, /await saved\(\)/);
assert.doesNotMatch(editor, /className="guardian-record-editor profile-panel"/);
const moduleResult = { exports: {} };
const output = ts.transpileModule(editor, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const requireMock = name => {
  if (name.endsWith('.css')) return {};
  if (name === './use-profile-dialog') return { useProfileDialog() {} };
  if (name === './app-dropdown') return { AppSelect: props => React.createElement('select', props) };
  if (name.includes('guardian-relationships')) return { GUARDIAN_RELATIONSHIPS: ['Mother', 'Father', 'Guardian', 'Other'] };
  if (name.includes('lib/session')) return {};
  return require(name);
};
new Function('exports', 'require', output)(moduleResult.exports, requireMock);
const html = renderToStaticMarkup(React.createElement(moduleResult.exports.GuardianRecordEditor, {
  guardian: { id: 123, firstName: 'Test', lastName: 'Parent', relationship: 'Grandmother', primaryPhone: '08000000000', secondaryPhone: null, homeAddress: 'Test address' }, cancel() {}, saved: async () => {},
}));
for (const text of ['Edit guardian', 'First name', 'Last name', 'Primary phone / WhatsApp', 'Second phone', 'Email', 'Grandmother', 'Test address', 'Save Changes']) assert.ok(html.includes(text), text);
assert.match(html, /aria-modal="true"/);
console.log('Record edit UI checks passed: single atomic child save, safe care loading, Super Admin edit button, working guardian form and shared dropdown.');
