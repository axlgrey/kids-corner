// Face tracking worker: runs TensorFlow.js off the main thread so the
// camera picture and items stay smooth even when tracking is slow.
// Messages in:  { type: "init", level, backend }
//               { type: "detect", frame: ImageData }
// Messages out: { type: "ready", backend, timings }  { type: "faces", faces }
//               { type: "error", message }
self.window = self;
importScripts(
  "vendor/tfjs/tf.min.js",
  "vendor/tfjs/tf-backend-webgpu.min.js",
  "vendor/tfjs/tf-backend-wasm.min.js",
  "vendor/tfjs/face-landmarks-detection.min.js",
  "vendor/tfjs/face-detection.min.js"
);

const url = (path) => new URL(path, self.location.href).href;
const DETECTOR_URL = url("vendor/tfjs/detector/model.json");
const MESH_URL = url("vendor/tfjs/mesh/model.json");
if (tf.wasm) tf.wasm.setWasmPaths(url("vendor/tfjs/"));

let model = null;
let fast = false;

const setBackendSafe = async (name) => {
  if (!tf.findBackendFactory(name)) return false;
  try {
    const ok = await tf.setBackend(name);
    if (ok) await tf.ready();
    return ok;
  } catch {
    return false;
  }
};

const makeFinder = (faces) => faceDetection.createDetector(faceDetection.SupportedModels.MediaPipeFaceDetector, {
  runtime: "tfjs",
  modelType: "short",
  maxFaces: faces,
  detectorModelUrl: DETECTOR_URL
});

// Time the face finder on each backend with a blank frame and keep the
// fastest. On some phones (older Mali GPUs) WASM beats WebGL.
const pickBackend = async () => {
  const timings = {};
  let best = null;
  let bestMs = Infinity;
  for (const name of ["webgpu", "webgl", "wasm"]) {
    if (!(await setBackendSafe(name))) continue;
    try {
      const det = await makeFinder(1);
      const input = tf.zeros([240, 320, 3], "int32");
      await det.estimateFaces(input);
      await det.estimateFaces(input);
      const start = performance.now();
      for (let i = 0; i < 4; i++) await det.estimateFaces(input);
      const ms = (performance.now() - start) / 4;
      input.dispose();
      det.dispose();
      timings[name] = Math.round(ms * 10) / 10;
      if (ms < bestMs) { bestMs = ms; best = name; }
    } catch (err) {
      timings[name] = String(err && err.message || err);
    }
  }
  return { best: best || "cpu", timings };
};

const init = async ({ level, backend }) => {
  if (model) { try { model.dispose(); } catch {} model = null; }
  let timings = null;
  if (!backend || !(await setBackendSafe(backend))) {
    const picked = await pickBackend();
    timings = picked.timings;
    backend = picked.best;
    if (!(await setBackendSafe(backend))) {
      backend = "cpu";
      await setBackendSafe("cpu");
    }
  }
  fast = !!level.fast;
  model = fast
    ? await makeFinder(level.faces)
    : await faceLandmarksDetection.createDetector(faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh, {
      runtime: "tfjs",
      maxFaces: level.faces,
      refineLandmarks: false,
      detectorModelUrl: DETECTOR_URL,
      landmarkModelUrl: MESH_URL
    });
  self.postMessage({ type: "ready", backend: tf.getBackend(), timings });
};

const detect = async (frame) => {
  const input = tf.browser.fromPixels(frame);
  try {
    const faces = await model.estimateFaces(input, { flipHorizontal: false });
    self.postMessage({
      type: "faces",
      faces: faces.map((face) => ({ keypoints: face.keypoints.map((k) => ({ x: k.x, y: k.y })), fast }))
    });
  } finally {
    input.dispose();
  }
};

let queue = Promise.resolve();
self.onmessage = (event) => {
  const msg = event.data;
  queue = queue.then(async () => {
    try {
      if (msg.type === "init") await init(msg);
      else if (msg.type === "detect" && model) await detect(msg.frame);
      else if (msg.type === "detect") self.postMessage({ type: "faces", faces: [] });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err && err.message || err), during: msg.type });
    }
  });
};
