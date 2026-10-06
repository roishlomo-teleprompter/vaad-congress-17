const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const extract=n=>html.match(new RegExp('^(?:async )?function '+n+'\\([^]*?^\\}', 'm'))[0];
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,hidden:true,checked:false,style:{},classList:{add:()=>{}}});return elements.get(id)};
const resident={name:'Resident',phone:'050',apartment:'5'};
let pdfs=0,writes=0,blocked=false;
const ctx={console,Date,Number,Math,Promise,receiptGenerationBusy:false,receiptProgressTimer:null,receiptProgressStarted:0,CFG:{activeYear:2026,usageMode:'vaad',nextReceiptNumber:1000,email:'user'},navigator:{onLine:true},document:{getElementById:get},currentResident:()=>resident,manualAmount:()=>0,isOtherPurpose:false,businessVatEnabled:()=>false,paymentPlanIsValid:()=>true,selectedServiceMonths:()=>[{year:2026,monthIndex:8}],hideMsg:()=>{},showMsg:(text)=>ctx.lastMessage=text,setInterval:()=>1,clearInterval:()=>{},validateForm:()=>{get('wizardCancelBtn').disabled=ctx.receiptGenerationBusy;},currentCalendarYear:()=>2026,ensureYearWorkspaceForWrite:async()=>{throw {status:429,result:{error:{message:'Quota exceeded'}}};},residents:[resident],residentSelect:{value:'0'},buildPdfBlob:async()=>{pdfs++;},finalizeReceiptInBackground:()=>writes++,showAppAlert:async()=>{},loadAllReceiptRows:async opts=>{assert.equal(opts.strict,true);throw Error('receipt read failed');},syncSettingsFromSheet:async()=>{},restoreReceiptResidentSelection:()=>{},setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(['setReceiptProgress','startReceiptProgress','stopReceiptProgress','isSheetsReadQuotaError','performGenerateReceipt'].map(extract).join('\n'),ctx);
(async()=>{
 await ctx.performGenerateReceipt();assert(ctx.lastMessage.includes('Google'));assert.equal(ctx.receiptGenerationBusy,false);assert.equal(get('receiptProgress').hidden,true);assert.equal(get('wizardBackBtn').disabled,false);assert.equal(get('wizardCancelBtn').disabled,false);assert.equal(pdfs,0);assert.equal(writes,0);
 ctx.ensureYearWorkspaceForWrite=async()=>true;
 await ctx.performGenerateReceipt();assert(ctx.lastMessage.includes('receipt read failed'));assert.equal(ctx.receiptGenerationBusy,false);assert.equal(pdfs,0);
 // A second click while preparing must do nothing.
 ctx.receiptGenerationBusy=true;ctx.ensureYearWorkspaceForWrite=async()=>{blocked=true;return true;};await ctx.performGenerateReceipt();assert.equal(blocked,false);
 // Known annual targets do not activate or reload the receipt workspace.
 ctx.receiptGenerationBusy=false;ctx.CFG.spreadsheetId='s26';ctx.CFG.folderId='f26';ctx.CFG.yearWorkspaces={2027:{spreadsheetId:'s27',folderId:'f27'}};ctx.yearWorkspaceIsHealthy=async()=>true;ctx.receiptWorkspaceTabsReady=async()=>true;ctx.activateYearWorkspace=async()=>{throw Error('unexpected full workspace activation')};
 vm.runInContext(extract('prepareReceiptYearTargets'),ctx);
 const targets=await ctx.prepareReceiptYearTargets([{year:2026},{year:2027}],null,2026);
 assert.equal(targets[2026].spreadsheetId,'s26');assert.equal(targets[2027].spreadsheetId,'s27');assert.equal(blocked,false);
 // Successful generation keeps the captured contact/amount and starts one background save.
 ctx.activateYearWorkspace=async(year,w)=>Object.assign(ctx.CFG,{activeYear:year,...w});
 ctx.ensureYearWorkspaceForWrite=async()=>true;
 ctx.loadAllReceiptRows=async opts=>assert.equal(opts.strict,true);
 ctx.syncSettingsFromSheet=async opts=>assert.equal(opts.strict,true);
 ctx.ensureLocalWorkspaceSeriesId=()=> 'series';ctx.receiptPaymentLabel=()=> 'checks';
 ctx.sortedMonths=()=>[8];ctx.residentFee=()=>140;ctx.servicePeriodEnabled=()=>true;
 ctx.todayIsoLocal=()=> '2026-10-06';ctx.buildPaymentPlanSnapshot=()=>null;
 ctx.validateServiceMonthAvailability=async()=>{};ctx.receiptHTML=()=> 'receipt';
 ctx.persistCurrentAccountCfg=()=>{};ctx.spawnConfetti=()=>{};
 ctx.buildPdfBlob=async()=>{pdfs++;return {};};
 await ctx.performGenerateReceipt();assert.equal(pdfs,1);assert.equal(writes,1);assert.equal(ctx.receiptGenerationBusy,false);assert.equal(ctx.CFG.nextReceiptNumber,1001);
 console.log('PASS: quota and critical-read failures stop before PDF/writes, progress and controls recover, double generation blocked, known annual targets avoid reloads');
})().catch(e=>{console.error(e);process.exit(1)});
