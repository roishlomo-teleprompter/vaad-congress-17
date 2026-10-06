const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const names=['restoreReceiptResidentSelection','activateYearWorkspace','prepareReceiptYearTargets'];
const code=names.map(n=>html.match(new RegExp('^(?:async )?function '+n+'\\([^]*?^\\}', 'm'))[0]).join('\n');
const tenant={name:'Resident',phone:'050',apartment:'5',fee:140};
const search={value:tenant.name},picker={value:'0',dispatchEvent:()=>{}};
const ctx={setReceiptProgress:()=>{},yearWorkspaceIsHealthy:async()=>false,syncSettingsFromSheet:async()=>{},loadResidents:async()=>ctx.loadDataForCurrentAccountMode(),console,Set,Number,String,Event:class{constructor(type){this.type=type}},CFG:{usageMode:'vaad',activeYear:2026,spreadsheetId:'s26',folderId:'f26'},residents:[tenant],residentSelect:picker,document:{getElementById:()=>search},allReceiptRows:[],financeRows:[],serviceAllocations:[],remoteFutureIncomeRows:[],currentResident:()=>ctx.residents[picker.value],toggleResidentClearBtn:()=>{},wizardUpdateSummary:()=>{},persistCurrentAccountCfg:()=>{},applyBranding:()=>{},refreshWorkspaceOpenButtons:()=>{},renderYearSelector:()=>{},loadDataForCurrentAccountMode:async()=>{ctx.residents=ctx.CFG.activeYear===2027?[{name:'Other',phone:'1',apartment:'2'}, {...tenant}]:[{...tenant}];picker.value='';search.value='';}};
vm.createContext(ctx);vm.runInContext(code,ctx);
(async()=>{
await ctx.activateYearWorkspace(2027,{spreadsheetId:'s27',folderId:'f27'},true);
assert.equal(picker.value,'1');assert.equal(search.value,tenant.name);assert.equal(ctx.currentResident().phone,'050');
await ctx.activateYearWorkspace(2026,{spreadsheetId:'s26',folderId:'f26'},true);
assert.equal(picker.value,'0');
ctx.ensureYearWorkspaceForWrite=async(year)=>{await ctx.activateYearWorkspace(year,{spreadsheetId:'s'+year,folderId:'f'+year},true);return true;};
await ctx.prepareReceiptYearTargets([{year:2026},{year:2027}],null,2026);
assert.equal(ctx.CFG.activeYear,2026);assert.equal(ctx.currentResident().name,tenant.name);
// A missing contact in an intermediate year must still restore the original.
ctx.loadDataForCurrentAccountMode=async()=>{ctx.residents=ctx.CFG.activeYear===2027?[]:[{...tenant}];picker.value='';};
await ctx.prepareReceiptYearTargets([{year:2027}],null,2026);
assert.equal(ctx.currentResident().name,tenant.name);
ctx.ensureYearWorkspaceForWrite=async year=>{await ctx.activateYearWorkspace(year,{spreadsheetId:'s'+year,folderId:'f'+year},true);throw Error('Google failure');};
await assert.rejects(ctx.prepareReceiptYearTargets([{year:2027}],null,2026),/Google failure/);
assert.equal(ctx.CFG.activeYear,2026);assert.equal(ctx.currentResident().name,tenant.name);
// Same row/name alone cannot silently select a different apartment/contact.
ctx.residents=[{...tenant,phone:'999'}];assert.equal(ctx.restoreReceiptResidentSelection(tenant),false);assert.equal(picker.value,'');
console.log('PASS: contact identity and picker survive year switches, missing intermediate contacts and preparation errors; unrelated contacts are rejected');
})().catch(e=>{console.error(e);process.exit(1)});
