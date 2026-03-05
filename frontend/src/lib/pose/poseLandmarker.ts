// src/lib/pose/poseLandmarker.ts
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

/**
 * IMPORTANT:
 * - This file is a LIB file (not a React component).
 * - Do NOT import types from UI components here.
 * - Keep all pose/overlay types owned by lib so build is stable.
 */

/* ========================= TYPES ========================= */

export type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type PosePacket = {
  landmarks: PoseLandmark[]; // normalized (0..1)
  timestampMs: number;
  width: number;
  height: number;
};

/**
 * Overlay primitives your UI can render on top of the frame/canvas.
 * Keep this type here (lib), not inside a component file.
 */
export type Overlay =
  | {
      kind: "point";
      id?: string;
      x: number; // pixels
      y: number; // pixels
      label?: string;
      confidence?: number;
    }
  | {
      kind: "line";
      id?: string;
      x1: number; // pixels
      y1: number; // pixels
      x2: number; // pixels
      y2: number; // pixels
      label?: string;
      confidence?: number;
    }
  | {
      kind: "box";
      id?: string;
      x: number; // pixels (top-left)
      y: number; // pixels (top-left)
      w: number; // pixels
      h: number; // pixels
      label?: string;
      confidence?: number;
    }
  | {
      kind: "text";
      id?: string;
      x: number; // pixels
      y: number; // pixels
      text: string;
    };

/* ========================= SINGLETON ========================= */

let _pose: PoseLandmarker | null = null;
let _loading: Promise<PoseLandmarker> | null = null;

type InitArgs = {
  /**
   * Provide an explicit model path if you host it yourself.
   * If omitted, we use MediaPipe's default hosted bundle + a common model.
   */
  modelAssetPath?: string;

  /**
   * If you want to use a different CDN/bundle location for wasm.
   * Most setups are fine with the default below.
   */
  wasmFilesetPath?: string;

  /**
   * Running mode:
   * - "IMAGE" for single frame images
   * - "VIDEO" for video frames with timestamps
   */
  runningMode?: "IMAGE" | "VIDEO";
};

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("poseLandmarker can only run in the browser (window is undefined).");
  }
}

/* ========================= INIT ========================= */

export async function getPoseLandmarker(args: InitArgs = {}): Promise<PoseLandmarker> {
  assertBrowser();

  if (_pose) return _pose;
  if (_loading) return _loading;

  _loading = (async () => {
    const wasmFilesetPath =
      args.wasmFilesetPath ?? "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

    const modelAssetPath =
      args.modelAssetPath ??
      // Common working model path used in many MediaPipe examples.
      // You can replace with your own hosted model later.
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

    const runningMode = args.runningMode ?? "VIDEO";

    const vision = await FilesetResolver.forVisionTasks(wasmFilesetPath);

    const pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath,
      },
      runningMode,
      // tune these later
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    _pose = pose;
    return pose;
  })();

  return _loading;
}

export function resetPoseLandmarker() {
  try {
    _pose?.close?.();
  } catch {}
  _pose = null;
  _loading = null;
}

/* ========================= DETECT ========================= */

export async function detectPoseFromImage(image: ImageBitmap | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) {
  const pose = await getPoseLandmarker({ runningMode: "IMAGE" });

  const res = pose.detect(image);
  const lm = res?.landmarks?.[0] ?? [];
  return lm as PoseLandmark[];
}

export async function detectPoseFromVideoFrame(args: {
  video: HTMLVideoElement | HTMLCanvasElement | ImageBitmap;
  timestampMs: number;
}) {
  const pose = await getPoseLandmarker({ runningMode: "VIDEO" });

  // detectForVideo expects a timestamp
  const res = pose.detectForVideo(args.video, args.timestampMs);
  const lm = res?.landmarks?.[0] ?? [];
  return lm as PoseLandmark[];
}

/* ========================= OVERLAY HELPERS ========================= */

/**
 * Convert normalized landmarks (0..1) into overlay points in pixel space.
 * Your UI can render these.
 */
export function landmarksToOverlays(args: {
  landmarks: PoseLandmark[];
  width: number;
  height: number;
  withLabels?: boolean;
}): Overlay[] {
  const { landmarks, width, height, withLabels } = args;

  const overlays: Overlay[] = [];
  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    overlays.push({
      kind: "point",
      id: `lm_${i}`,
      x: p.x * width,
      y: p.y * height,
      label: withLabels ? String(i) : undefined,
      confidence: p.visibility,
    });
  }
  return overlays;
}