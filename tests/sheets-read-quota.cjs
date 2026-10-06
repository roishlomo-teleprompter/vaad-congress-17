const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const extract=n=>html.match(new RegExp('^(?:async )?function '+n+'\\([^]*?^\\}', 'm'))[0];
function setup(fn){
 let clock=0;const waits=[],progress=[];
 const ctx={console,Promise,Map,JSON,Number,String,Math:Object.assign(Object.create(Math),{random:()=>0}),Date:{now:()=>clock},CFG:{email:'user',usageMode:'vaad'},setTimeout:(r,ms)=>{assert(ms>=0);waits.push(ms);clock+=ms;queueMicrotask(r);},setReceiptProgress:t=>progress.push(t),gapi:{client:{sheets:{spreadsheets:{get:fn,values:{get:fn,batchGet:fn,append:()=>{throw Error('write sentinel')}}}}}}};
 vm.createContext(ctx);vm.runInContext(extract('isSheetsReadQuotaError')+'\n'+extract('installSheetsReadGuard'),ctx);ctx.installSheetsReadGuard();
 return {ctx,waits,progress,time:()=>clock};
}
(async()=>{
 let count=0;let state=setup(async()=>{count++;return {result:{values:[]}}});
 let api=state.ctx.gapi.client.sheets.spreadsheets;
 const write=api.values.append;
 const p1=api.values.get({spreadsheetId:'s',range:'A:B'}),p2=api.values.get({spreadsheetId:'s',range:'A:B'});
 assert.equal(p1,p2);await Promise.all([p1,p2]);assert.equal(count,1);
 await api.get({spreadsheetId:'s'});assert.equal(count,2);assert(state.waits.includes(1500));assert.equal(api.values.append,write);
 let attempts=0;state=setup(async()=>{attempts++;if(attempts<3)throw {status:429,result:{error:{message:'Quota exceeded'}}};return {result:{values:[['ok']]}}});
 await state.ctx.gapi.client.sheets.spreadsheets.values.get({spreadsheetId:'s',range:'A:B'});
 assert.equal(attempts,3);assert(state.time()>=24000);assert(state.progress.some(x=>x.includes('ממתין')));
 attempts=0;state=setup(async()=>{attempts++;throw {status:429}});
 await assert.rejects(state.ctx.gapi.client.sheets.spreadsheets.get({spreadsheetId:'s'}));assert.equal(attempts,5);
 attempts=0;state=setup(async()=>{attempts++;throw {status:403,result:{error:{message:'Permission denied'}}}});
 await assert.rejects(state.ctx.gapi.client.sheets.spreadsheets.get({spreadsheetId:'s'}));assert.equal(attempts,1);
 attempts=0;state=setup(async()=>{attempts++;return {result:{}}});
 const stale=state.ctx.gapi.client.sheets.spreadsheets.get({spreadsheetId:'s'});state.ctx.CFG.email='other';await assert.rejects(stale);assert.equal(attempts,0);
 console.log('PASS: paced reads, concurrent read coalescing, quota recovery/countdown, bounded retry, no permission retry, no write wrapping, queued account isolation');
})().catch(e=>{console.error(e);process.exit(1)});
