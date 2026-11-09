/* Shared native bridge. iOS differences are explicitly platform-gated. */
const kabclickPlatform = window.Capacitor?.getPlatform() || 'web';
const kabclickNative = window.Capacitor?.isNativePlatform() ? window.Capacitor.registerPlugin('KabclickNative') : null;
const kabclickAuthorizedScopes = new Set();
function kabclickInitTokenClient(options) {
  if (!kabclickNative) return google.accounts.oauth2.initTokenClient(options);
  return { requestAccessToken() {
    kabclickNative.authorize({forceSelection:localStorage.getItem('kabclick_choose_account')==='1',accountEmail:typeof loadLastEmail==='function'?loadLastEmail():null,scope: [...new Set([...kabclickAuthorizedScopes, ...(options.include_granted_scopes && typeof SCOPES !== 'undefined' ? SCOPES.split(/\s+/) : []), ...options.scope.split(/\s+/)])].join(' ')}).then(response => {
      localStorage.removeItem('kabclick_choose_account');
      (response.scope || '').split(/\s+/).forEach(scope => kabclickAuthorizedScopes.add(scope));
      return options.callback(response);
    }).catch(error => {
      console.warn('Native Google authorization:', error.message);
      options.callback({error: error.message || 'authorization_failed'});
    });
  }};
}
if (kabclickNative) {
  document.documentElement.classList.add('android-preview');
  if (kabclickPlatform === 'ios') {
    document.documentElement.classList.add('ios-native');
    const style = document.createElement('link');
    style.rel = 'stylesheet'; style.href = 'ios-native.css';
    document.head.appendChild(style);
  }
  const open = url => kabclickNative.openExternal({url:String(url)}).catch(error => alert(error.message));
  window.open = function(url) {
    if (!url || url === 'about:blank') return {opener:null, document:{body:{textContent:''}}, location:{replace:open}, close(){}};
    open(url); return null;
  };
  async function shareFiles(files) {
    for (const file of files) {
      const data = await new Promise((resolve,reject) => {const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);});
      await kabclickNative.shareFile({name:file.name || 'receipt.pdf',mime:file.type || 'application/pdf',data});
    }
  }
  navigator.canShare = options => !!options?.files?.length;
  navigator.share = options => options.files?.length ? shareFiles(options.files) : Promise.reject(new Error('File required'));
  document.addEventListener('click', event => {
    const link=event.target.closest('a');
    if(link?.download && link.href.startsWith('blob:')) {
      event.preventDefault();
      fetch(link.href).then(r=>r.blob()).then(blob=>shareFiles([new File([blob],link.download,{type:blob.type})])).catch(error=>alert(error.message));
    } else if(link?.href && (kabclickPlatform === 'ios' ? /^(https?:|mailto:)/ : /^https?:/).test(link.href) && new URL(link.href).origin!==location.origin) {
      event.preventDefault();open(link.href);
    }
  },true);
}
