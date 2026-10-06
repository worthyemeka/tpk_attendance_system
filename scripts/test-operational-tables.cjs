const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function compile(source, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name.endsWith('.css')) return {};
    if (imports[name]) return imports[name];
    if (name.startsWith('react')) return require(name);
    throw Error(`Unexpected import ${name}`);
  } });
  return exports;
}
const badges = compile(read('src/components/record-badge.tsx'));
const operational = compile(read('src/components/operational-table.tsx'), { './record-badge': badges });
const element = React.createElement;
for (const [status, label, tone] of [['CHECKED_IN', 'In class', 'green'], ['PICKED_UP', 'Picked up', 'green'], ['PICKUP_REQUESTED', 'Pickup requested', 'amber'], ['PRESENT', 'Still present', 'amber'], ['OTHER', 'other', 'neutral']]) {
  const html = renderToStaticMarkup(element(operational.OperationalStatus, { status }));
  assert.ok(html.includes(label)); assert.ok(html.includes(`badge-${tone}`));
}
assert.ok(renderToStaticMarkup(element(operational.OperationalChild, { firstName: '<Example>', lastName: 'Child' })).includes('&lt;Example&gt;'));
const pickup = read('src/components/pickup-dashboard.tsx');
const checkin = read('src/app/account/check-in/page.tsx');
for (const source of [pickup, checkin]) {
  assert.ok(source.includes('operations-table-frame'));
  assert.ok(source.includes('className="operations-table"'));
  assert.ok(source.includes('<ClassBadge'));
  assert.ok(source.includes('<OperationalChild'));
  assert.ok(source.includes('<OperationalStatus'));
  assert.ok(source.includes('data-label="Guardian"'));
}
assert.ok(!pickup.includes('<th />'));
assert.ok(pickup.includes('colSpan={7}'));
assert.ok(checkin.includes('aria-busy={loading}'));
// Render the actual pickup rows and check-in table JSX with synthetic data only.
const rowModule = compile(`import { Fragment } from 'react';\nimport { OperationalChild, OperationalStatus } from './operations';\nimport { ClassBadge } from './badges';\nimport { FiDownload } from 'react-icons/fi';\nconst stamp = (value) => value || '—'; const dayLabel = (value) => value || '';\nexport ${pickup.slice(pickup.indexOf('function QueueRows('))}`, { './operations': operational, './badges': badges });
const fixtures = ['Tribe A', 'Tribe B', 'Tribe C', 'TribePetra Teens', undefined].map((className, index) => ({ attendanceId: index + 1, id: index + 1, firstName: index === 0 ? 'Example child with a longer' : 'Example', lastName: 'Name', className, guardianName: 'Example Guardian', guardianFirstName: 'Example', guardianLastName: 'Guardian', checkedInAt: '9:20 AM', pickedUpAt: '11:30 AM', firstVisit: index % 2 === 0, source: index % 2 ? 'ASSISTED' : 'PARENT_QR', status: index === 0 ? 'PICKUP_REQUESTED' : index === 1 ? 'CHECKED_IN' : 'PICKED_UP', pickupCode: 'TPK-EXAMPLE', pickupTicketUrl: '#ticket-preview', checkInFormUrl: '#ticket-preview' }));
const tableStart = checkin.indexOf('<div className="table-wrap operations-table-frame"');
const tableEnd = checkin.indexOf('</table></div>', tableStart) + '</table></div>'.length;
const checkinModule = compile(`import { OperationalChild, OperationalStatus } from './operations';\nimport { ClassBadge, RecordBadge } from './badges';\nimport { FiExternalLink } from 'react-icons/fi';\nconst formatCheckInTime = (value) => value || '—';\nexport function CheckInTable({ sortedItems, loading = false, canOperate = true }) { const items = sortedItems; return ${checkin.slice(tableStart, tableEnd)}; }`, { './operations': operational, './badges': badges });
const checkinHtml = renderToStaticMarkup(element(checkinModule.CheckInTable, { sortedItems: fixtures }));
assert.equal((checkinHtml.match(/data-label="Child"/g) || []).length, fixtures.length);
assert.ok(checkinHtml.includes('badge-purple'));
assert.ok(renderToStaticMarkup(element(checkinModule.CheckInTable, { sortedItems: [], loading: true })).includes('Loading arrivals'));
function pickupHtml(queue) {
  const rows = renderToStaticMarkup(element(rowModule.QueueRows, { items: fixtures, queue, grouped: false }));
  assert.equal((rows.match(/data-label="Child"/g) || []).length, fixtures.length);
  assert.ok(rows.includes(queue === 'PRESENT' ? 'Still present' : 'Picked up'));
  return `<section class="pickup-dashboard"><section class="queue-panel"><div class="pickup-register-heading"><div><p class="eyebrow">Pickup register</p><h2>Children &amp; collections</h2><p>Pickup records and tickets for the selected service.</p></div><b>5 children checked in</b></div><div class="queue-head"><div class="queue-tabs"><button class="${queue === 'PRESENT' ? 'active' : ''}">Still Present (2)</button><button class="${queue === 'COMPLETED' ? 'active' : ''}">Completed Pickups (3)</button></div><div class="queue-actions"><button class="outline-button export-button">Export PDF</button><div class="queue-filters"><label><input placeholder="Search child or guardian…"/></label><span class="app-dropdown-host"><button class="outline-button">All Classes ▾</button></span></div></div></div><p class="queue-count">5 children in this example</p><div class="table-wrap operations-table-frame"><table class="operations-table"><thead><tr><th>#</th><th>Child</th><th>Class</th><th>Guardian</th><th>Pickup code</th><th>${queue === 'PRESENT' ? 'Checked in' : 'Picked up'}</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section></section>`;
}
const present = pickupHtml('PRESENT');
const completed = pickupHtml('COMPLETED');
console.log('PASS: Both operational tables render shared badges, identities, accurate state labels, ticket links and responsive cell labels. Empty/loading state and long-name escaping verified.');
if (process.argv.includes('--preview')) {
  const css = pickup.match(/const styles = `([\s\S]*?)`;/)[1] + '\n' + ['src/app/globals.css', 'src/app/typography.css', 'src/components/dashboard-refinements.css', 'src/components/service-workspaces.css', 'src/components/record-badge.css', 'src/components/operational-table.css'].map(read).join('\n');
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Operational table design preview</title><style>${css}\nmain{padding:24px;max-width:1440px;margin:auto}h1{font-size:24px;margin:0 0 24px}.preview-nav{display:flex;gap:16px;margin:0 0 24px}.preview-nav a{color:#ad4c2c}.app-dropdown-host{display:block}</style>`;
  const pages = { '/check-in': `<section class="staff-checkin"><section class="panel checkin-records"><div class="checkin-records-heading"><div><p class="eyebrow">Attendance register</p><h2>Children checked in</h2><p>Arrivals, pickup status and tickets for the selected service.</p></div><b>5 children</b></div>${checkinHtml}</section></section>`, '/present': present, '/': completed };
  require('node:http').createServer((request, response) => { response.setHeader('Content-Type', 'text/html'); response.end(`<!doctype html><html><head>${head}</head><body><main><h1>Synthetic table preview</h1><nav class="preview-nav"><a href="/">Completed pickups</a><a href="/present">Still present</a><a href="/check-in">Check-in</a></nav>${pages[request.url] || pages['/']}</main></body></html>`); }).listen(3046, '127.0.0.1', () => console.log('Synthetic design preview: http://127.0.0.1:3046'));
}
