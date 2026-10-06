const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const extract=n=>html.match(new RegExp('^(?:async )?function '+n+'\\([^]*?^\\}', 'm'))[0];
const folder='application/vnd.google-apps.folder',sheet='application/vnd.google-apps.spreadsheet';
const clone=x=>JSON.parse(JSON.stringify(x));
const files=new Map();let next=0,updates=0,fault=false;
const add=(id,kind,mime,year,parents,name)=>files.set(id,{id,name,mimeType:mime,parents,trashed:false,appProperties:{kabclick:'1',kind,mode:'vaad',seriesId:'series',year:String(year)}});
add('root','workspace-root',folder,'',['mydrive'],'קבקליק - Building');
for(const year of [2026,2027]){add('s'+year,'sheet',sheet,year,['root'],'old sheet '+year);add('r'+year,'receipts-folder',folder,year,['root'],'old receipts '+year);add('t'+year,'settings',sheet,year,['root'],'old settings '+year);files.get('s'+year).appProperties.settingsFileId='t'+year;files.get('t'+year).appProperties.workspaceId='s'+year;}
files.set('pdf',{id:'pdf',name:'receipt.pdf',mimeType:'application/pdf',parents:['r2026'],bytes:'unchanged'});
const workspaces={2026:{spreadsheetId:'s2026',folderId:'r2026'},2027:{spreadsheetId:'s2027',folderId:'r2027'}};
const ctx={console,Map,Set,JSON,String,Number,CFG:{email:'user',usageMode:'vaad',seriesId:'series',buildingInfo:'Building',yearWorkspaces:workspaces},accessToken:'test',annualFolderPromises:new Map(),legacyWorkspaceMigrationPromises:new Map(),legacyWorkspaceMigrationCompleted:new Set(),normalizeYearWorkspaces:x=>x.yearWorkspaces||{},loadAccountCfg:(account,mode)=>({yearWorkspaces:mode==='vaad'?workspaces:{}}),workspaceRootFolderName:name=>'קבקליק - '+name,readKabClickSettingsFromCandidate:async()=>{throw Error('unexpected legacy sheet read')},showMsg:()=>{},ensureSettingsStorage:async()=>{throw Error('unexpected settings recreation')},gapi:{client:{setToken:()=>{},drive:{files:{
 get:async({fileId})=>{if(!files.has(fileId))throw Error('not found');return {result:clone(files.get(fileId))}},
 list:async({q})=>{const kind=q.match(/key='kind' and value='([^']+)'/)?.[1],year=q.match(/key='year' and value='([^']+)'/)?.[1],name=q.match(/name='([^']+)'/)?.[1],parent=q.match(/'([^']+)' in parents/)?.[1],mime=q.match(/mimeType='([^']+)'/)?.[1];return {result:{files:[...files.values()].filter(f=>(!kind||f.appProperties?.kind===kind) && (!year||f.appProperties?.year===year) && (!name||f.name===name) && (!parent||f.parents?.includes(parent)) && (!mime||f.mimeType===mime)).map(clone)}}},
 create:async({resource})=>{const id='new'+(++next);files.set(id,{id,...clone(resource),trashed:false});return {result:clone(files.get(id))}},
 update:async args=>{updates++;if(fault && args.fileId==='r2027'){fault=false;throw Error('interrupted move')};const f=files.get(args.fileId);if(args.resource)Object.assign(f,clone(args.resource));if(args.removeParents)f.parents=f.parents.filter(p=>!args.removeParents.split(',').includes(p));if(args.addParents&&!f.parents.includes(args.addParents))f.parents.push(args.addParents);return {result:clone(f)}}
}}}}};
vm.createContext(ctx);vm.runInContext(['ensureWorkspaceRootFolder','moveDriveFileIntoFolder','ensureAnnualWorkspaceFolder','organizeAnnualWorkspace','migrateLegacyWorkspacesToRoot'].map(extract).join('\n'),ctx);
(async()=>{
 await ctx.migrateLegacyWorkspacesToRoot({strict:true});assert.equal(next,2);
 for(const year of [2026,2027]){const annual=[...files.values()].find(f=>f.appProperties?.kind==='year-folder'&&f.appProperties.year===String(year));assert.equal(annual.name,'קבקליק - '+year);assert.deepEqual(annual.parents,['root']);for(const [prefix,name] of [['s','קבקליק - '],['r','קבלות - '],['t','הגדרות - לא למחוק - ']]){assert.equal(files.get(prefix+year).name,name+year);assert.deepEqual(files.get(prefix+year).parents,[annual.id]);}}
 assert.deepEqual(files.get('pdf').parents,['r2026']);assert.equal(files.get('pdf').bytes,'unchanged');
 const before=updates;await ctx.migrateLegacyWorkspacesToRoot({force:true,strict:true});assert.equal(next,2);assert.equal(updates,before);
 // Concurrent annual-folder requests share one create.
 const [a,b]=await Promise.all([ctx.ensureAnnualWorkspaceFolder(2028,'Building','series'),ctx.ensureAnnualWorkspaceFolder(2028,'Building','series')]);assert.equal(a,b);assert.equal(next,3);
 files.set('manual',{id:'manual',name:'קבקליק - 2029',mimeType:folder,parents:['root'],appProperties:{}});
 assert.equal(await ctx.ensureAnnualWorkspaceFolder(2029,'Building','series'),'manual');assert.equal(next,3);assert.equal(files.get('manual').appProperties.kind,'year-folder');
 // An interrupted migration can resume using the same IDs and year folder.
 files.get('r2027').parents=['root'];files.get('r2027').name='old';fault=true;await assert.rejects(ctx.migrateLegacyWorkspacesToRoot({force:true,strict:true}),/interrupted/);await ctx.migrateLegacyWorkspacesToRoot({force:true,strict:true});assert.equal(files.get('r2027').name,'קבלות - 2027');assert.equal(next,3);
 // Mode/ownership mismatch is rejected before that year's files move.
 files.get('s2027').appProperties.mode='business';const parent=clone(files.get('s2027').parents);await assert.rejects(ctx.organizeAnnualWorkspace(2027,workspaces[2027],'Building','series'),/IDENTITY/);assert.deepEqual(files.get('s2027').parents,parent);
 ctx.ensureLocalWorkspaceSeriesId=()=> 'series';vm.runInContext(extract('findYearWorkspaceOnDrive'),ctx);
 files.get('s2027').appProperties.mode='vaad';
 const located=await ctx.findYearWorkspaceOnDrive(2026);assert.equal(located.spreadsheetId,'s2026');assert.equal(located.folderId,'r2026');
 const lookup=extract('findYearWorkspaceOnDrive');assert(lookup.includes("key='kind' and value='sheet'"));assert(lookup.includes("key='kind' and value='receipts-folder'"));
 assert(extract('discoverAnnualWorkspacesFromDrive').includes("key='kind' and value='sheet'"));
 console.log('PASS: retro annual hierarchy, exact names, stable file/PDF identities, idempotence, concurrent creation, interruption recovery and mode isolation');
})().catch(e=>{console.error(e);process.exit(1)});
