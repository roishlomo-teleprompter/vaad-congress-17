const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const names=['servicePeriodEnabled','selectedServiceMonths','sortedMonths','addMonthsToIso','splitInstallmentAmounts','buildPaymentPlanSnapshot','appendScheduledFinanceRows','prepareReceiptYearTargets','readAnnualSourceSnapshot','validateServiceMonthAvailability'];
const code=names.map(n=>{const m=html.match(new RegExp('^(?:async )?function '+n+'\\([^]*?^\\}', 'm'));assert(m,n);const first=m[0].split('\n')[0];return first.endsWith('}')?first:m[0]}).join('\n');
const inputs={servicePeriodEnabled:{checked:true},servicePeriodStart:{value:'2026-09'},servicePeriodCount:{value:'12'},paymentInstallmentCount:{value:'12'},paymentFirstDate:{value:'2026-09-05'}};
const ctx={console,Set,Map,Date,Number,String,Math,JSON,Array,document:{getElementById:id=>inputs[id]},CFG:{usageMode:'vaad',activeYear:2026,spreadsheetId:'s26',folderId:'f26',nextReceiptNumber:1000,yearWorkspaces:{}},isOtherPurpose:false,selectedMonths:new Set([0,1]),todayIsoLocal:()=> '2026-10-06',currentCalendarYear:()=>2026,paymentUsesMonthlySchedule:()=>true,receiptPaymentLabel:()=>"צ'קים דחויים",navigator:{onLine:true},FINANCE_SHEET:'finance',FINANCE_PLAN_HEADER:['id'],RECEIPTS_SHEET:'receipts',SERVICE_ALLOCATIONS_SHEET:'alloc',residentsSheetName:()=> 'contacts',readWorkspaceSettingsRows:async()=>[['יתרת פתיחה (הוצאות/הכנסות)',100]],receiptSheetLayout:()=>({receiptNumIdx:7}),serviceMonthLabel:m=>m.key,MONTH_NAMES:['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],parseHebrewDate:()=>new Date(2026,0,1)};
vm.createContext(ctx);vm.runInContext(code,ctx);
const plain=x=>JSON.parse(JSON.stringify(x));
(async()=>{
let m=plain(ctx.selectedServiceMonths());assert.equal(m.length,12);assert.equal(m[0].key,'2026-09');assert.equal(m[11].key,'2027-08');
inputs.servicePeriodCount.value='13';assert.equal(ctx.selectedServiceMonths()[12].key,'2027-09');
inputs.servicePeriodCount.value='0';assert.equal(ctx.selectedServiceMonths().length,0);
inputs.servicePeriodCount.value='1.5';assert.equal(ctx.selectedServiceMonths().length,0);
inputs.servicePeriodCount.value='61';assert.equal(ctx.selectedServiceMonths().length,0);
inputs.servicePeriodCount.value='12';
let plan=plain(ctx.buildPaymentPlanSnapshot(1680,2026,1000));assert.equal(plan.dates[0],'2026-10-06');assert.equal(plan.dates[1],'2026-11-01');assert.equal(plan.dates[11],'2027-09-01');assert.equal(plan.amounts[0],140);assert.equal(plan.amounts.reduce((a,b)=>a+b),1680);
plan.serviceMonths=m;
const writes=[];ctx.gapi={client:{sheets:{spreadsheets:{values:{batchUpdate:async()=>{},get:async()=>({result:{values:[]}}),append:async args=>writes.push(args)}}}}};ctx.ensureFinanceSheet=async()=>{};
await ctx.appendScheduledFinanceRows(plan,{title:'tenant',category:'dues',note:'period'},'s26',{2026:{spreadsheetId:'s26'},2027:{spreadsheetId:'s27'}});
assert.equal(writes.length,2);assert.equal(writes[0].resource.values.length,3);assert.equal(writes[1].resource.values.length,9);assert.equal(writes[1].resource.values[0][12],4);assert.equal(writes[1].resource.values[0][13],12);assert.equal(writes[0].resource.values[0][16],'2026-09');assert.equal(writes[1].resource.values[0][16],'2026-12');assert.equal(writes.flatMap(w=>w.resource.values).reduce((sum,r)=>sum+r[4],0),1680);
// Retry must not append a plan that is already written to either destination.
writes.length=0;ctx.gapi.client.sheets.spreadsheets.values.get=async()=>({result:{values:Array.from({length:12},(_,i)=>[plan.id,'פעיל',i+1])}});await ctx.appendScheduledFinanceRows(plan,{title:'tenant'},'s26',{2026:{spreadsheetId:'s26'},2027:{spreadsheetId:'s27'}});assert.equal(writes.length,0);
// Annual preparation preserves the active receipt workspace, including a failed target creation.
ctx.ensureYearWorkspaceForWrite=async(year,opts)=>{assert.equal(opts.automatic,true);ctx.CFG.activeYear=year;ctx.CFG.spreadsheetId='s'+year;ctx.CFG.folderId='f'+year;return true};ctx.activateYearWorkspace=async(year,w)=>{ctx.CFG.activeYear=year;Object.assign(ctx.CFG,w)};
let targets=await ctx.prepareReceiptYearTargets(m,plan,2026);assert.deepEqual(Object.keys(targets),['2026','2027']);assert.equal(ctx.CFG.spreadsheetId,'s26');
ctx.ensureYearWorkspaceForWrite=async year=>{ctx.CFG.activeYear=year;return year!==2027};await assert.rejects(ctx.prepareReceiptYearTargets(m,plan,2026));assert.equal(ctx.CFG.spreadsheetId,'s26');assert.equal(ctx.CFG.activeYear,2026);
// Legacy month selection and business schedule remain supported.
inputs.servicePeriodEnabled.checked=false;assert.equal(ctx.selectedServiceMonths().length,2);assert.equal(ctx.selectedServiceMonths()[0].key,'2026-01');
ctx.CFG.usageMode='business';plan=plain(ctx.buildPaymentPlanSnapshot(1680,2026,1000));assert.equal(plan.dates[0],'2026-09-05');assert.equal(plan.dates[11],'2027-08-05');
// Closing balance excludes future cash and cancelled payments.
const cash=[['2026-09-01','הכנסה','','',140],['2026-11-01','הכנסה','','',140],['2027-01-01','הכנסה','','',140],['2026-09-02','הוצאה','','',50],['2026-09-03','הכנסה','','',500,'','','','','','','בוטל']];
ctx.gapi={client:{drive:{files:{get:async()=>({result:{appProperties:{}}})}},sheets:{spreadsheets:{get:async()=>({result:{sheets:[{properties:{title:'contacts'}},{properties:{title:'finance'}},{properties:{title:'receipts'}}]}}),values:{get:async a=>({result:{values:a.range.includes('finance')?cash:[]}})}}}}};
assert.equal((await ctx.readAnnualSourceSnapshot({year:2026,spreadsheetId:'s26'})).closingBalance,190);
ctx.todayIsoLocal=()=> '2027-01-05';assert.equal((await ctx.readAnnualSourceSnapshot({year:2026,spreadsheetId:'s26'})).closingBalance,330);
// Duplicate service months block issuance, while cancelled service allocations are released.
ctx.CFG.usageMode='vaad';
let receiptRows=[];let allocationRows=[['id','Tenant','050','5',2027,0,1000,2026,'plan','']];
let finance=[];
ctx.gapi.client.sheets.spreadsheets.get=async()=>({result:{sheets:[{properties:{title:'alloc'}}]}});
ctx.gapi.client.sheets.spreadsheets.values.get=async a=>({result:{values:a.range.includes('finance')?finance:a.range.includes('alloc')?allocationRows:receiptRows}});
const snap={resident:{name:'Tenant',phone:'050',apartment:'5'},serviceMonths:[{year:2027,monthIndex:0,key:'2027-01'}],yearTargets:{2027:{spreadsheetId:'s27'}}};
await assert.rejects(ctx.validateServiceMonthAvailability(snap),/2027/);
allocationRows[0][9]='בוטל';await ctx.validateServiceMonthAvailability(snap);
receiptRows=[['date','Tenant','050','jan 2027',1,140,'checks',1000],['date','Tenant','050','jan 2027',1,140,'checks',1001]];
finance=[['2027-01-01','הכנסה','','',140,'','','','','','plan','בוטל',1,12,1000,1680,'2027-01']];
await assert.rejects(ctx.validateServiceMonthAvailability(snap),/2027/); // Second receipt still owns the month.
receiptRows.pop();await ctx.validateServiceMonthAvailability(snap);
console.log('PASS: period boundaries, invalid input, schedule/amount conservation, year routing, ordinals, idempotency, restoration after failure, business/legacy behavior, annual carry and cancellation');
})().catch(e=>{console.error(e);process.exit(1)});
