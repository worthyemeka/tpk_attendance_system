const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const idle = 48 * 60 * 60 * 1000;
let now = 1_800_000_000_000;
let counter = 0;
const timers = new Map();
const values = new Map();
class Surface {
  constructor() { this.events = new Map(); }
  addEventListener(name, fn) { const listeners = this.events.get(name) || new Set(); listeners.add(fn); this.events.set(name, listeners); }
  removeEventListener(name, fn) { this.events.get(name)?.delete(fn); }
  dispatchEvent(event) { for (const fn of [...(this.events.get(event.type) || [])]) fn(event); }
}
const window = new Surface();
const document = new Surface(); document.visibilityState = 'visible';
window.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
window.setTimeout = (fn, delay) => { const id = ++counter; timers.set(id, { fn, at: now + delay }); return id; };
window.clearTimeout = id => timers.delete(id);
window.setInterval = (fn, delay) => { const id = ++counter; timers.set(id, { fn, at: now + delay, interval: delay }); return id; };
window.clearInterval = window.clearTimeout;
class TestDate extends Date { static now() { return now; } }
const teacher = { staffUserId: 123, name: 'Test Teacher', accessLevel: 'TPK_ADMIN', teamStatus: 'ACTIVE' };
const token = 'a'.repeat(64);
const calls = [];
let serverExpiry = now + idle;
let handler = async (_url, options) => {
  calls.push(options.method);
  if (serverExpiry <= now) return { status: 401, ok: false };
  if (options.method === 'POST') serverExpiry = now + idle;
  return { status: 200, ok: true, json: async () => ({ teacher, expiresAtMs: serverExpiry, serverTimeMs: now }) };
};
const context = vm.createContext({ window, document, Date: TestDate, Event: class { constructor(type) { this.type = type; } }, AbortController, process: { env: { NODE_ENV: 'production' } }, fetch: (...args) => handler(...args) });
const exportsByName = {};
function load(name) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, `src/lib/${name}.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  context.exports = exports; context.require = key => exportsByName[key.replace('./', '')];
  vm.runInContext(output, context);
  exportsByName[name] = exports;
  return exports;
}
const sessions = load('session');
const lifecycle = load('teacher-session-lifecycle');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function advance(ms) {
  const end = now + ms;
  for (;;) {
    const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    const [id, timer] = next; now = timer.at;
    if (timer.interval) timer.at += timer.interval; else timers.delete(id);
    timer.fn(); await settle();
  }
  now = end; await settle();
}
function save() { sessions.saveTeacherSession({ ...teacher, sessionToken: token, expiresAt: now + idle, lastActivityAt: now }); serverExpiry = now + idle; }
async function run() {
  assert.equal(sessions.readTeacherSession(), null);
  const offset = lifecycle.teacherSessionFromResponse({ teacher, expiresAtMs: 1_000 + idle, serverTimeMs: 1_000 }, token);
  assert.equal(offset.expiresAt, now + idle, 'server clock drift does not shorten or extend the deadline');
  save();
  const expiry = serverExpiry;
  await lifecycle.validateTeacherSession(); assert.equal(serverExpiry, expiry, 'GET does not renew');
  assert.equal(sessions.readTeacherSession().staffUserId, 123);
  await advance(idle - 1); assert.ok(sessions.readTeacherSession());
  await advance(1); assert.equal(sessions.readTeacherSession(), null, 'expires at exactly 48 hours');
  assert.equal(await lifecycle.validateTeacherSession(true), null, 'expired browser session cannot renew');
  save();
  const normal = handler;
  handler = async () => ({ status: 401, ok: false });
  assert.equal(await lifecycle.validateTeacherSession(), null); assert.equal(sessions.readTeacherSession(), null);
  save(); handler = async () => { throw Error('Offline'); };
  await assert.rejects(lifecycle.validateTeacherSession()); assert.ok(sessions.readTeacherSession(), 'outages do not log out a valid session');
  let resolve;
  handler = () => new Promise(done => { resolve = done; });
  const pending = lifecycle.validateTeacherSession();
  sessions.clearTeacherSession();
  resolve({ status: 200, ok: true, json: async () => ({ teacher, expiresAtMs: now + idle, serverTimeMs: now }) });
  assert.equal(await pending, null); assert.equal(sessions.readTeacherSession(), null, 'late response cannot undo logout');
  handler = normal; save(); calls.length = 0;
  let expired = 0;
  const stop = lifecycle.monitorTeacherSession(() => { expired++; });
  await settle(); assert.deepEqual(calls, ['GET']);
  window.dispatchEvent({ type: 'pointerdown', isTrusted: false }); await advance(1);
  assert.equal(calls.includes('POST'), false, 'synthetic events are not activity');
  document.visibilityState = 'hidden'; window.dispatchEvent({ type: 'keydown', isTrusted: true }); await advance(1);
  assert.equal(calls.includes('POST'), false, 'hidden input does not renew');
  document.visibilityState = 'visible';
  await advance(5 * 60_000);
  const beforeInput = serverExpiry; assert.equal(beforeInput, sessions.readTeacherSession().expiresAt, 'polling retains deadline');
  window.dispatchEvent({ type: 'pointerdown', isTrusted: true }); await advance(0);
  assert.equal(calls.filter(method => method === 'POST').length, 1); assert.ok(serverExpiry > beforeInput);
  window.dispatchEvent({ type: 'keydown', isTrusted: true }); await advance(59_999);
  assert.equal(calls.filter(method => method === 'POST').length, 1, 'activity requests are throttled');
  await advance(1); assert.equal(calls.filter(method => method === 'POST').length, 2, 'last interaction is not dropped');
  window.dispatchEvent({ type: 'focus' }); await settle();
  assert.equal(calls.at(-1), 'GET', 'focus checks but does not renew');
  await advance(idle); assert.ok(expired > 0); assert.equal(sessions.readTeacherSession(), null, 'open inactive dashboard expires despite polling');
  stop(); assert.equal(timers.size, 0, 'all lifecycle timers are cleaned up');
  save(); const stop2 = lifecycle.monitorTeacherSession(() => { expired++; }); await settle();
  values.delete('tpk-teacher'); window.dispatchEvent({ type: 'storage', key: 'tpk-teacher' });
  assert.ok(expired > 1, 'logout in another tab redirects'); stop2();
  const auth = fs.readFileSync(path.join(root, 'src/components/teacher-auth.tsx'), 'utf8');
  assert.match(auth, /if \(signup\) return;[\s\S]*validateTeacherSession\(\)/);
  assert.match(auth, /session && !cancelled\)[\s\S]*new URLSearchParams\(window.location.search\).get\("next"\)/);
  assert.match(auth, /window.location.replace\(next && next.startsWith\("\/account\/"\) \? next : "\/account\/overview"\)/);
  console.log('Teacher session checks passed: redirect wiring, 48-hour boundary, clock drift, activity, polling, outages, logout and multiple tabs.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
