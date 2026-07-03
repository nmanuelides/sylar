/**
 * Injected into the zeus CLI process via NODE_OPTIONS=--require.
 * zeus prints its preview QR with qrcode-terminal; this shim intercepts the
 * URL so the build server can return it to the studio as a browser QR.
 */
const Module = require('module');
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  const mod = originalLoad.apply(this, arguments);
  if (request === 'qrcode-terminal' && mod && typeof mod.generate === 'function') {
    return {
      ...mod,
      generate(url, opts, cb) {
        console.log(`SYLAR_QR_URL::${url}`);
        return mod.generate(url, opts, cb);
      },
    };
  }
  return mod;
};
