const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const names=['appendScheduledFinanceRows','readReceiptIncomeQueue','saveReceiptIncomeJob','receiptIncomeJobMatchesAccount','receiptIncomeError','queueReceiptIncome','completeReceiptIncome','finalizeReceiptInBackground'];
const code=names.map(n=>{const m=html.match(new RegExp('^(?:async )?function '+n+'\\([^]*?^\\}','m'));assert(m,n);return m[0]}).join('\n');
const storage=new Map(),sheets={s26:[],s27:[]};let fail27=true,failAlloc=false,allocCalls=0,receiptCalls=0,timers=0;const messages=[];
const ctx={console:{error(){},warn(){}},Number,String,Array,Set,Map,JSON,Date,Math,RECEIPT_INCOME_QUEUE_KEY:'jobs',receiptIncomeRuns:new Map(),CFG:{email:'owner@example.com',usageMode:'vaad',spreadsheetId:'s26'},ensureLocalWorkspaceSeriesId:()=> 'series',navigator:{onLine:true},accessToken:'test',todayIsoLocal:()=> '2026-10-06',todayStr:()=> '6 באוקטובר 2026',localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},FINANCE_SHEET:'finance',FINANCE_PLAN_HEADER:['id'],ensureFinanceSheet:async()=>{},renderPendingReceiptIncome:()=>{},appendServiceAllocations:async()=>{allocCalls++;if(failAlloc)throw Error('allocation unavailable')},serviceMonthLabel:m=>m.key,uploadToDrive:async()=>({webViewLink:'link'}),appendReceiptRow:async()=>receiptCalls++,allReceiptRows:[],currentResident:()=>null,showMsg:s=>messages.push(s),setTimeout:()=>timers++,window:{addEventListener:()=>timers++}};
ctx.gapi={client:{sheets:{spreadsheets:{values:{batchUpdate:async()=>{},get:async a=>({result:{values:sheets[a.spreadsheetId].map(r=>r.slice(10,16))}}),append:async a=>{if(a.spreadsheetId==='s27'&&fail27)throw {result:{error:{message:'Injected 2027 failure'}}};sheets[a.spreadsheetId].push(...JSON.parse(JSON.stringify(a.resource.values)))}}}}}};
vm.createContext(ctx);vm.runInContext(code,ctx);
const dates=Array.from({length:12},(_,i)=>i===0?'2026-10-06':`${i<3?2026:2027}-${String((9+i)%12+1).padStart(2,'0')}-01`);
const snap={account:'owner@example.com',seriesId:'series',usageMode:'vaad',resident:{name:'Tenant'},receiptNumber:1000,receiptYear:2026,issueDate:'2026-10-06',totalAmount:1680,payMethod:'checks',isOtherPurpose:false,months:[0],serviceMonths:[{key:'2026-09'}],targetSpreadsheetId:'s26',targetFolderId:'f26',yearTargets:{2026:{spreadsheetId:'s26'},2027:{spreadsheetId:'s27'}},paymentPlan:{id:'plan',dates,amounts:Array(12).fill(140),count:12,total:1680,payMethod:'checks',sourceReceipt:'1000'}};
(async()=>{
await ctx.finalizeReceiptInBackground(snap,{},'receipt.pdf');
assert.equal(receiptCalls,1);assert.equal(timers,0);assert.equal(sheets.s26.length,3);assert.equal(sheets.s27.length,0);
assert(messages[0].includes('Injected 2027 failure'));assert(messages[0].includes('רישום הכנסות'));
let jobs=JSON.parse(storage.get('jobs'));assert.equal(jobs.length,1);assert.equal(jobs[0].financeDone,false);assert.equal(jobs[0].allocationsDone,true);
fail27=false;
const result=await ctx.completeReceiptIncome(jobs[0]);assert.equal(result.ok,true);assert.equal(sheets.s26.length,3);assert.equal(sheets.s27.length,9);assert.equal(receiptCalls,1);assert.equal(JSON.parse(storage.get('jobs')).length,0);
assert.equal(sheets.s26.concat(sheets.s27).reduce((sum,r)=>sum+r[4],0),1680);
// A month already present (including cancelled) is not appended a second time.
sheets.s27[0][11]='בוטל';await assert.rejects(ctx.appendScheduledFinanceRows(snap.paymentPlan,{title:'Tenant'},'s26',snap.yearTargets),/בוטלה/);assert.equal(sheets.s27.length,9);assert.equal(sheets.s27[0][11],'בוטל');
// Allocation-only errors retain the successful finance stage across reload/retry.
failAlloc=true;const next=JSON.parse(JSON.stringify(snap));next.receiptNumber=1001;next.paymentPlan.id='plan2';next.paymentPlan.sourceReceipt='1001';
const job=ctx.queueReceiptIncome(next,'period');const outcome=await ctx.completeReceiptIncome(job);assert.equal(outcome.ok,false);assert(outcome.errors[0].startsWith('רישום חודשי שירות:'));assert(!outcome.errors[0].includes('רישום הכנסות'));
jobs=JSON.parse(storage.get('jobs'));assert.equal(jobs[0].financeDone,true);const before=sheets.s26.length+sheets.s27.length;failAlloc=false;await ctx.completeReceiptIncome(jobs[0]);assert.equal(sheets.s26.length+sheets.s27.length,before);
// A queue from another account/mode must not write or be removed.
const foreign=ctx.queueReceiptIncome({...next,receiptNumber:1002,account:'another@example.com'},'period');const blocked=await ctx.completeReceiptIncome(foreign);assert.equal(blocked.ok,false);assert.equal(sheets.s26.length+sheets.s27.length,before);assert.equal(JSON.parse(storage.get('jobs')).length,1);
// Storage errors after receipt success must never retry receipt/PDF creation.
ctx.localStorage.setItem=()=>{throw Error('storage full')};messages.length=0;await ctx.finalizeReceiptInBackground({...snap,receiptNumber:1003}, {}, 'receipt.pdf');assert.equal(receiptCalls,2);assert.equal(timers,0);assert(messages[0].includes('storage full'));
console.log('PASS: partial-year failure, durable retry, no duplicate installments/receipts, cancellation preservation, separate allocation error, account isolation, storage failure');
})().catch(e=>{console.error(e);process.exit(1)});
