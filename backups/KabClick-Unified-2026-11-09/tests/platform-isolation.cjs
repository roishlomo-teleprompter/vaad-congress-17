const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baseline = JSON.parse(read('tests/android-baseline.json'));

// Undo only the explicitly reviewed integration points. Everything else must
// match the released Android source, including every original CSS rule.
let html = read('www/index.html');
html = html.replace('<script src="google-rest-methods.js"></script>\n<script src="google-bootstrap.js"></script>',
  '<script src="https://accounts.google.com/gsi/client" async defer></script>\n<script src="https://apis.google.com/js/api.js"></script>');
html = html.replace("const APP_BUILD = '282';", "const APP_BUILD = '276';");
html = html.replace("typeof gapi!=='undefined' && (kabclickPlatform === 'ios' || (typeof google!=='undefined' && google.accounts?.oauth2))",
  "typeof gapi!=='undefined' && typeof google!=='undefined' && google.accounts?.oauth2");
html = html.replace("\n    if(kabclickPlatform === 'ios') alert('החיבור ל-Google עדיין לא מוכן. בדוק חיבור לאינטרנט ונסה שוב.');", '');
assert.equal(hash(html), baseline.indexSha256, 'Unreviewed Android layout or business-logic change');
for (const [name, expected] of Object.entries(baseline.nativeFiles)) {
  assert.equal(hash(fs.readFileSync(path.join(root, name))), expected, 'Android native changed: '+name);
}
for (const [name, expected] of Object.entries(baseline.assets)) {
  assert.equal(hash(fs.readFileSync(path.join(root, 'www', name))), expected, 'Asset changed: '+name);
}
const adapter = read('www/native-adapter.js');
const bootstrap = read('www/google-bootstrap.js');

function environment(platform) {
  const classes = new Set(), styles = [], writes = [], events = new Map(), external = [], auth = [];
  const native = {
    authorize: async options => {auth.push(options);return {access_token:'test-token',scope:options.scope};},
    openExternal: async options => {external.push(options.url);},
    shareFile: async () => {}
  };
  const stored = new Map();
  const document = {
    documentElement:{classList:{add:(...names)=>names.forEach(n=>classes.add(n))}},
    head:{appendChild:node=>styles.push(node.href)}, createElement:()=>({}),
    write:s=>writes.push(s), addEventListener:(name,callback)=>events.set(name,callback)
  };
  const cap = {getPlatform:()=>platform,isNativePlatform:()=>platform!=='web',registerPlugin:()=>native};
  const context = {console,URL,queueMicrotask,document,window:{Capacitor:cap},navigator:{},
    localStorage:{getItem:k=>stored.get(k)||null,removeItem:k=>stored.delete(k)},
    location:{origin:platform==='ios'?'capacitor://localhost':'https://localhost'},
    google:{accounts:{oauth2:{initTokenClient:()=>({web:true})}}},
    capacitorExports:{CapacitorHttp:{request:async()=>{throw Error('Unexpected native HTTP request');}}}
  };
  vm.createContext(context);
  vm.runInContext(read('www/google-rest-methods.js'),context);
  vm.runInContext(adapter,context);
  vm.runInContext(bootstrap,context);
  return {context,classes,styles,writes,events,external,auth};
}

(async()=>{
  for (const platform of ['android','ios','web']) {
    const e=environment(platform);
    assert.equal(e.classes.has('ios-native'), platform==='ios');
    assert.equal(e.styles.includes('ios-native.css'), platform==='ios');
    assert.equal(e.classes.has('android-preview'), platform!=='web');
    assert.equal(e.writes.length, platform==='ios'?0:2);
    assert.equal(Boolean(e.context.window.gapi?.client), platform==='ios');
    if(platform==='web') continue;
    let callback;
    e.context.result=r=>{callback=r;};
    vm.runInContext("kabclickInitTokenClient({scope:'https://www.googleapis.com/auth/drive.file',callback:result}).requestAccessToken()",e.context);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(callback.access_token,'test-token');
    assert.equal(e.auth.length,1);
    for(const href of ['https://docs.google.com/spreadsheets/d/test','mailto:test@example.com']) {
      let prevented=false;
      e.events.get('click')({target:{closest:()=>({href})},preventDefault:()=>{prevented=true;}});
      assert.equal(prevented,href.startsWith('https:') || platform==='ios');
    }
  }
  // iOS intentionally skips GIS loading; Android still waits for real GIS.
  const extract = read('www/index.html').match(/^function waitForGoogleLibraries\([^]*?^\}/m)[0];
  for(const platform of ['android','ios']) {
    const context={Date,Promise,setTimeout:fn=>fn(),gapi:{},kabclickPlatform:platform};
    vm.createContext(context);vm.runInContext(extract,context);
    if(platform==='ios') await vm.runInContext('waitForGoogleLibraries(0)',context);
    else await assert.rejects(vm.runInContext('waitForGoogleLibraries(0)',context));
  }
  console.log('Platform isolation PASS: Android HTML/CSS/business source, 40 native files, assets, native authorization, links, and iOS-only bootstrap/styles.');
})().catch(error=>{console.error(error);process.exit(1);});
