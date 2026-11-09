/* Native iOS transport. Keep the browser Google loader for browser previews. */
(function () {
  'use strict';
  if (window.Capacitor?.getPlatform() !== 'ios') {
    document.write('<script src="https://accounts.google.com/gsi/client" async defer><\/script>');
    document.write('<script src="https://apis.google.com/js/api.js"><\/script>');
    return;
  }
  let token = null;
  const client = {
    setToken(value) { token = value?.access_token ? {access_token: value.access_token} : null; },
    getToken() { return token ? {...token} : null; },
    async init() {}
  };
  for (const [name, spec] of Object.entries(window.kabclickGoogleMethods)) {
    const parts = name.split('.');
    const methodName = parts.pop();
    let namespace = client;
    for (const part of parts) namespace = namespace[part] ||= {};
    namespace[methodName] = async function (args = {}, body) {
      if (!token) throw new Error('יש להתחבר לחשבון Google לפני ביצוע הפעולה');
      const pathKeys = new Set();
      const path = spec.url.replace(/\{([^}]+)\}/g, (_, key) => {
        pathKeys.add(key);
        if (args[key] == null || args[key] === '') throw new Error('Missing Google API parameter: ' + key);
        return encodeURIComponent(String(args[key])).replace(/'/g, '%27');
      });
      const url = new URL(path);
      for (const [key, value] of Object.entries(args)) {
        if (key === 'resource' || key === 'body' || pathKeys.has(key) || value == null) continue;
        for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(item));
      }
      const headers = {Authorization: 'Bearer ' + token.access_token};
      const options = {url: url.href, method: spec.method, headers,
        responseType: 'json', connectTimeout: 30000, readTimeout: 60000};
      const resource = body ?? args.resource ?? args.body;
      if (resource !== undefined) {
        headers['Content-Type'] = 'application/json';
        options.data = resource;
      }
      // Capacitor's native HTTP transport does not create browser API iframes.
      const response = await capacitorExports.CapacitorHttp.request(options);
      let result = response.data;
      if (typeof result === 'string') {
        try { result = JSON.parse(result); } catch (_) { result = {message: result}; }
      }
      result ??= {};
      const compatible = {result, status: response.status, headers: response.headers,
        body: typeof response.data === 'string' ? response.data : JSON.stringify(result)};
      if (response.status < 200 || response.status >= 300) {
        const error = new Error(result.error?.message || result.message || 'Google API request failed');
        Object.assign(error, compatible);
        throw error;
      }
      return compatible;
    };
  }
  window.gapi = {client, load(name, options) {
    if (name !== 'client') throw new Error('Unsupported Google API module: ' + name);
    queueMicrotask(typeof options === 'function' ? options : options.callback);
  }};
})();
