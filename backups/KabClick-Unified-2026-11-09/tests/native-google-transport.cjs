const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'../www')+'/';
const calls=[];let status=200,data={values:[['שלום']]};
const context={URL,queueMicrotask,console,window:{Capacitor:{getPlatform:()=> 'ios'}},capacitorExports:{CapacitorHttp:{request:async opts=>{calls.push(opts);return {status,data,headers:{}};}}}};
vm.createContext(context);
for(const name of ['google-rest-methods.js','google-bootstrap.js'])vm.runInContext(fs.readFileSync(root+name,'utf8'),context);
(async()=>{
const c=context.window.gapi.client;
await assert.rejects(()=>c.drive.files.list({}),/להתחבר/);
c.setToken({access_token:'test-token'});
for(const [name,spec] of Object.entries(context.window.kabclickGoogleMethods)){
 const args={};for(const [key,where] of Object.entries(spec.params))if(where==='path')args[key]='עברית /?#';
 if(!['GET','DELETE'].includes(spec.method))args.resource={values:[['נתון']],requests:[]};
 const method=name.split('.').reduce((v,k)=>v[k],c);
 const reply=await method(args);const call=calls.at(-1);
 assert.equal(call.method,spec.method);assert.ok(!/[{}]/.test(call.url));assert.ok(call.url.startsWith('https://'));assert.equal(call.headers.Authorization,'Bearer test-token');assert.equal(reply.result.values[0][0],'שלום');
}
await c.sheets.spreadsheets.values.batchGet({spreadsheetId:'abc',ranges:["'דיירים'!A1:C2","'הכנסות'!A2:Q"]});
assert.equal(new URL(calls.at(-1).url).searchParams.getAll('ranges').length,2);
await c.drive.files.update({fileId:'abc',addParents:'folder',removeParents:'old',resource:{appProperties:{x:null}}});
assert.equal(calls.at(-1).data.appProperties.x,null);assert.equal(new URL(calls.at(-1).url).searchParams.get('addParents'),'folder');
status=429;data={error:{code:429,message:'quota exceeded'}};let before=calls.length;
await assert.rejects(()=>c.drive.files.list({}),e=>e.status===429&&e.result.error.code===429&&e.message==='quota exceeded');assert.equal(calls.length,before+1);
status=200;data='{"id":"file"}';assert.equal((await c.drive.files.get({fileId:'abc'})).result.id,'file');
c.setToken(null);await assert.rejects(()=>c.drive.files.list({}),/להתחבר/);
const writes=[];const browser={window:{Capacitor:{getPlatform:()=> 'web'}},document:{write:s=>writes.push(s)}};vm.createContext(browser);vm.runInContext(fs.readFileSync(root+'google-bootstrap.js','utf8'),browser);assert.equal(writes.length,2);assert.equal(browser.window.gapi,undefined);
console.log('PASS: all 13 Google routes; Hebrew paths; array queries; JSON bodies; quota error compatibility; no mutation retry; token clearing; browser fallback.');
})().catch(e=>{console.error(e);process.exit(1)});
