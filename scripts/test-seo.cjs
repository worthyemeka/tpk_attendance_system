const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function load(file, environment = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, process: { env: environment }, require: name => { if (name === '@/lib/seo') return load('src/lib/seo.ts', environment); throw Error(`Unexpected import ${name}`); } });
  return exports;
}
const seo = load('src/lib/seo.ts', { VERCEL_ENV: 'production' });
const routes = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (entry.name === 'page.tsx') routes.push('/' + path.relative(path.join(root, 'src/app'), dir).replaceAll(path.sep, '/')); } }
walk(path.join(root, 'src/app'));
for (const route of routes) {
  const dir = path.join(root, 'src/app', route);
  const metadataFile = route === '/' ? path.join(dir, 'page.tsx') : path.join(dir, 'layout.tsx');
  assert.ok(fs.existsSync(metadataFile), `Metadata missing for ${route}`);
  assert.match(fs.readFileSync(metadataFile, 'utf8'), /(?:metadata|generateMetadata)\s*(?:=|\()/, route);
  if (route === '/[section]' || route === '/account/[section]') continue;
  assert.ok(seo.PAGE_SEO[route], `SEO copy missing for ${route}`);
  const meta = seo.pageMetadata(route);
  assert.ok(meta.description.length >= 60 && meta.description.length < 200, `Description length: ${route}`);
  assert.ok(meta.keywords.length >= 8, route);
  assert.ok(meta.title.absolute.length && meta.openGraph.images.length && meta.twitter.images.length, route);
  assert.equal(meta.robots.index, route === '/', `Indexing policy: ${route}`);
  if (route !== '/') { assert.equal(meta.robots.follow, false); assert.equal(meta.robots.nosnippet, true); }
  if (route.includes('[')) assert.equal(meta.alternates, null);
  else assert.equal(meta.alternates.canonical, new URL(route, seo.SITE_URL).href);
}
assert.equal(seo.sectionMetadata('classes').title.absolute, seo.PAGE_SEO['/account/classes'].title + ' | ' + seo.SITE_NAME);
assert.equal(seo.sectionMetadata('unknown').robots.index, false);
assert.equal(seo.sectionMetadata('volunteers', false).alternates, null);
assert.equal(load('src/lib/seo.ts', { VERCEL_ENV: 'preview' }).pageMetadata('/').robots.index, false);
const sitemap = load('src/app/sitemap.ts', { VERCEL_ENV: 'production' }).default();
assert.equal(sitemap.length, 1); assert.equal(sitemap[0].url, seo.SITE_URL + '/');
assert.equal(load('src/app/sitemap.ts', { VERCEL_ENV: 'preview' }).default().length, 0);
assert.equal(load('src/app/robots.ts', { VERCEL_ENV: 'production' }).default().sitemap, seo.SITE_URL + '/sitemap.xml');
assert.equal(load('src/app/robots.ts', { VERCEL_ENV: 'preview' }).default().rules.disallow, '/');
console.log(`PASS: ${routes.length} page routes have metadata; private routes and previews excluded from indexing; public sitemap validated.`);

// Optional production-build integration checks: no login or database mutation.
if (process.argv[2]) (async () => {
  const base = new URL(process.argv[2]);
  for (const route of routes.filter(p => p !== '/account').map(p => p.replace('[classId]', '1').replace('/account/[section]', '/account/classes').replace('/[section]', '/volunteers'))) {
    const response = await fetch(new URL(route, base), { redirect: 'manual' });
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.match(html, /<title>[^<]+<\/title>/, route);
    const expected = route === '/volunteers' ? seo.sectionMetadata('volunteers', false) : seo.pageMetadata(route === '/account/classrooms/1' ? '/account/classrooms/[classId]' : route);
    const title = html.match(/<title>([^<]+)<\/title>/)[1].replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"');
    assert.equal(title, expected.title.absolute, `Page-specific title: ${route}`);
    const head = html.match(/<head>[\s\S]*?<\/head>/)?.[0] || '';
    if (expected.alternates === null) assert.doesNotMatch(head, /rel="canonical"/, `Inherited canonical: ${route}`);
    else assert.equal(new URL(head.match(/rel="canonical" href="([^"]+)"/)?.[1]).href, new URL(expected.alternates.canonical).href, `Canonical: ${route}`);
    assert.match(html, /name="description" content="[^"]+"/, route);
    assert.match(html, /name="keywords" content="[^"]+"/, route);
    assert.match(html, /property="og:title"/, route);
    assert.match(html, /name="twitter:card"/, route);
    if (route !== '/') assert.match(html, /name="robots" content="[^"]*noindex/, route);
    else { assert.match(html, /name="robots" content="index, follow"/); assert.match(html, /application\/ld\+json/); }
    if (/^\/(account|teacher|check-in|families|pick-up|pickup-ticket)(\/|$)/.test(route)) assert.match(response.headers.get('x-robots-tag') || '', /noindex/, route);
    assert.doesNotMatch(head, /(?:token=|familyCode=|childId=)/, `Sensitive query data in metadata: ${route}`);
  }
  const ticket = await fetch(new URL('/pickup-ticket?token=seo-test-not-a-real-token', base));
  assert.doesNotMatch((await ticket.text()).match(/<head>[\s\S]*?<\/head>/)?.[0] || '', /seo-test-not-a-real-token/);
  assert.match(await (await fetch(new URL('/robots.txt', base))).text(), /Sitemap:/);
  const xml = await (await fetch(new URL('/sitemap.xml', base))).text();
  assert.match(xml, /<loc>https:\/\/tpk-checkin.vercel.app\/<\/loc>/); assert.doesNotMatch(xml, /account|teacher|token/);
  console.log('PASS: Rendered titles, keywords, descriptions, sharing tags, noindex headers and token-free canonicals on every page.');
})().catch(error => { console.error(error); process.exitCode = 1; });
