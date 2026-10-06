const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const extract=n=>html.match(new RegExp('^(?:async )?function '+n+'\\([^]*?^\\}', 'm'))[0];
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false});return elements.get(id)};
const resident={name:'Vitaly',phone:'050',apartment:'5'};
const ctx={console,Set,Map,Number,String,Array,Math,CFG:{activeYear:2026,email:'user',usageMode:'vaad',spreadsheetId:'s26',folderId:'f26',yearWorkspaces:{2026:{spreadsheetId:'s26',folderId:'f26'},2027:{spreadsheetId:'s27',folderId:'f27'}}},navigator:{onLine:true},accessToken:'test',yearSwitchBusy:false,receiptGenerationBusy:false,residents:[resident],allReceiptRows:[],financeRows:[],serviceAllocations:[],remoteFutureIncomeRows:[],cancelledScheduleRows:[],currentResident:()=>resident,document:{getElementById:get},persistCurrentAccountCfg:()=>{},applyBranding:()=>{},restoreReceiptResidentSelection:()=>{},refreshRecentResidents:()=>{},renderYearSelector:()=>{get('homeYearSelect').disabled=ctx.yearSwitchBusy;},validateForm:()=>{},showMsg:()=>{},showAppAlert:async()=>{},RECEIPTS_SHEET:'receipts',FINANCE_SHEET:'finance',SERVICE_ALLOCATIONS_SHEET:'alloc',CANCELLATIONS_SHEET:'cancel',residentsSheetName:()=> 'contacts',receiptSheetLayout:()=>({receiptNumIdx:7}),currentCalendarYear:()=>2026,parseHebrewDate:()=>new Date(2026,9,6),MONTH_NAMES:['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],todayIsoLocal:()=> '2026-10-06',saveOfflineDataSnapshot:()=>{}};
vm.createContext(ctx);vm.runInContext(['switchDataYear','loadYearDataForSwitch','serviceAllocationFromRow','verifyServiceAllocationSources','loadServiceAllocations','getPaidMonthsForResident'].map(extract).join('\n'),ctx);
(async()=>{
 let activated=[];ctx.activateYearWorkspace=async(year,w,kind)=>{assert.equal(kind,'year');activated.push(year);Object.assign(ctx.CFG,{activeYear:year,...w});};
 await ctx.switchDataYear(2027);assert.equal(get('homeYearSelect').disabled,false);await ctx.switchDataYear(2026);assert.deepEqual(activated,[2027,2026]);assert.equal(get('homeYearSelect').disabled,false);
 ctx.activateYearWorkspace=async(year,w)=>{Object.assign(ctx.CFG,{activeYear:year,...w});ctx.residents=[];throw Error('read failed');};
 await ctx.switchDataYear(2027);assert.equal(ctx.CFG.activeYear,2026);assert.equal(ctx.residents[0].name,'Vitaly');assert.equal(get('homeYearSelect').disabled,false);assert.equal(ctx.yearSwitchBusy,false);
 const allocation=()=>ctx.serviceAllocationFromRow(['2026:1000:2026-09','Vitaly','050','5',2026,8,1000,2026,'p','']);
 let receipts=[['date','Vitaly','050','sep 2026',1,140,'checks',1000]];
 let annual=new Map([[2026,{receipts,finance:[]}]])
 ctx.serviceAllocations=await ctx.verifyServiceAllocationSources([allocation()],annual);assert.equal(ctx.getPaidMonthsForResident(resident).has(8),true);
 receipts=[];annual=new Map([[2026,{receipts,finance:[]}]])
 ctx.serviceAllocations=await ctx.verifyServiceAllocationSources([allocation()],annual);assert.equal(ctx.serviceAllocations[0].orphaned,true);assert.equal(ctx.getPaidMonthsForResident(resident).size,0);
 // Missing source data is a read error, not evidence that a receipt was deleted.
 ctx.gapi={client:{sheets:{spreadsheets:{values:{get:async()=>{throw Error('source unavailable')}}}}}};
 await assert.rejects(ctx.verifyServiceAllocationSources([allocation()]),/source unavailable/);
 // An allocation for 2027 must be checked in its 2026 receipt workbook.
 const cross=allocation();cross.year=2027;cross.monthIndex=0;receipts=[['date','Vitaly','050','jan 2027',1,140,'checks',1000]];
 await ctx.verifyServiceAllocationSources([cross],new Map([[2026,{receipts,finance:[]}],[2027,{receipts:[],finance:[]}]]));assert.equal(cross.orphaned,false);
 // Batched year loading uses one metadata read and one values batch per workbook.
 let reads=0,maintenance=0;
 const meta={result:{sheets:['contacts','receipts','finance','alloc','cancel'].map(title=>({properties:{title}}))}};
 ctx.gapi.client.sheets.spreadsheets={get:async()=>{reads++;return meta},values:{get:async()=>{throw Error('unexpected unbatched read')},batchGet:async args=>{reads++;return {result:{valueRanges:args.ranges.map(range=>({values:range.includes('alloc')?[['2026:1000:2026-09','Vitaly','050','5',2026,8,1000,2026,'p','']]:[]}))}}}}};
 ctx.readWorkspaceSettingsRows=async()=>[['year',2026]];
 ctx.syncSettingsFromSheet=async opts=>{assert.equal(opts.strict,true);assert(opts.prefetchedRows.length);};
 ctx.loadAllReceiptRows=async opts=>{ctx.allReceiptRows=opts.prefetched.result.values;};
 ctx.loadFinanceRows=async opts=>{assert.equal(opts.prepare,false);assert.equal(opts.includeRemote,false);ctx.financeRows=[];};
 ctx.loadResidents=async opts=>{assert.equal(opts.strict,true);assert(opts.prefetched);};
 await ctx.loadYearDataForSwitch();assert.equal(reads,3);assert.equal(ctx.serviceAllocations[0].orphaned,true);
 // The full input click calls the native picker; unsupported browsers retain focus.
 const click=html.match(/document.getElementById\('servicePeriodStart'\).addEventListener\('click',event=>\{[^]*?^\}\);/m)[0];
 let handler;ctx.document={getElementById:()=>({addEventListener:(event,fn)=>handler=fn})};vm.runInContext(click,ctx);
 let opened=0,focused=0;handler({currentTarget:{showPicker:()=>opened++,focus:()=>focused++}});assert.equal(opened,1);handler({currentTarget:{focus:()=>focused++}});assert.equal(focused,1);
 console.log('PASS: repeated year switches and failure recovery, deleted receipt releases months, cross-year source verification, read errors fail closed, batched loading and whole-field month picker');
})().catch(e=>{console.error(e);process.exit(1)});
