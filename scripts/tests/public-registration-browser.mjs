import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.TEST_SITE||'http://127.0.0.1:3073';
let mode='lost';const payloads=[];const errors=[];
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname;
 if(path==='/api/v1/public/service-session/current' && mode==='closed') return route.fulfill({json:{success:true,data:null}});
 if(path==='/api/v1/public/registrations') {
  payloads.push(route.request().postDataJSON());
  if(mode==='invalid')return route.fulfill({json:{success:true,data:{}}});
  const response=await route.fetch({url:'http://127.0.0.1:8098'+path});
  if(mode==='lost'){mode='retry';return route.abort('failed');}
  return route.fulfill({response});
 }
 return route.fulfill({response:await route.fetch({url:'http://127.0.0.1:8098'+path})});
});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
async function fill(phone,closed=false){
 await page.goto(base+'/check-in/parent?flow=new');
 await page.getByLabel('Child’s First Name').fill('Browser');
 await page.getByLabel('Child’s Last Name').fill('Fixture');
 await page.getByLabel('Date of Birth').fill('2020-01-01');
 await page.getByRole('button',{name:'Female',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('First Name',{exact:false}).fill('Test');
 await page.getByLabel('Last Name',{exact:false}).fill('Fixture');
 await page.getByLabel('Primary Phone Number').fill(phone);
 await page.getByRole('combobox',{name:/Relationship to child/}).click();
 await page.getByRole('option',{name:'Mother',exact:true}).click();
 await page.getByLabel('Home Address').fill('Test address only');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 if(!closed)await page.getByRole('button',{name:'Continue',exact:true}).click();
}
await fill('08000000004');
await page.getByRole('button',{name:'Register & send check-in request'}).click();
await page.getByRole('alert').waitFor();
assert.equal(await page.getByRole('heading',{name:'Registration received',exact:true}).count(),0);
await page.getByRole('button',{name:'Register & send check-in request'}).click();
await page.getByRole('heading',{name:'Registration received',exact:true}).waitFor();
assert.equal(payloads[0].submissionKey,payloads[1].submissionKey);
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
mode='invalid';await fill('08000000005');
await page.getByRole('button',{name:'Register & send check-in request'}).click();
await page.getByText('We could not confirm that registration was saved.',{exact:false}).waitFor();
assert.equal(await page.getByRole('heading',{name:'Registration received',exact:true}).count(),0);
mode='closed';await fill('08000000006',true);
await page.getByRole('button',{name:'Save registration',exact:true}).click();
await page.getByRole('heading',{name:'Registration saved',exact:true}).waitFor();
assert.equal(payloads.at(-1).registrationOnly,true);
await page.screenshot({path:'/tmp/tpk-registration-saved-mobile.png',fullPage:true});
await page.goto(base+'/families/new');await page.waitForURL('**/check-in/parent?flow=new');
assert.equal(errors.length,0,errors.join('\n'));
console.log('PASS: mobile browser → PHP → isolated MySQL; retry after committed response lost; invalid success rejected; closed-window registration saved; legacy link redirect; no overflow/runtime errors.');
await browser.close();
