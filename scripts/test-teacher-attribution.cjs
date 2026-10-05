const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const cache = {};
function load(file) {
  if (cache[file]) return cache[file];
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (name.endsWith('.css')) return {};
    if (name === '@/lib/session') return { mediaUrl: (value) => value };
    if (name === '@/lib/campus-time') return load(path.join(root, 'src/lib/campus-time.ts'));
    return require(name);
  }, module, module.exports);
  cache[file] = module.exports;
  return module.exports;
}
const { TeacherAttribution, PostedTime } = load(path.join(root, 'src/components/teacher-attribution.tsx'));
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const photo = render(TeacherAttribution, { name: 'Auntie Grace Bennett', photo: '/uploads/profiles/grace.jpg', createdAt: '2026-10-05 15:12:00' });
assert.match(photo, /src="\/uploads\/profiles\/grace.jpg"/);
assert.match(photo, /Auntie Grace Bennett/);
assert.match(photo, /dateTime="2026-10-05T14:12:00.000Z"/i);
assert.match(render(TeacherAttribution, { name: 'Uncle Daniel James' }), />DJ<\/span>/);
assert.match(render(TeacherAttribution, { name: '' }), />TP<\/span>/);
assert.match(render(PostedTime, { value: 'not-a-date', label: 'Attached' }), /Attached date not recorded/);
assert.match(render(PostedTime, { value: '2026-10-05T13:20:00Z', label: 'Attached' }), /Attached 5 Oct 2026, 14:20/);
console.log('Teacher attribution rendering checks passed (7 cases).');
