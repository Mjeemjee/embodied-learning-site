importScripts('demo-runtime.js');
self.onmessage = function (event) {
  try { self.postMessage({ logs: DemoRuntime.execute(event.data.code) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
