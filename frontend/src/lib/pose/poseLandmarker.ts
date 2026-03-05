// src/lib/pose/poseLandmarker.ts
// Runs in the browser only (SenseiVisionClient is a client component)

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Overlay } from "@/components/SenseiVisionScreen";

export type PoseLandmark = { x: number; y: number; z?: number; visibility?: number };
export type PosePacket = {
  // we keep it small + stable
  version: 1;
  landmarks: PoseLandmark[]; // 33 landmarks (single-person)
  source: "mediapipe";
};

let _pose: PoseLandmarker | null = null;
let _loading: Promise<PoseLandmarker> | null = null;

const WASM_BASE = "/mediapipe/wasm";                 // you will add these to /public
const MODEL_URL = "/models/pose_landmarker_lite.task"; // you will add this to /public/models

async function getPoseLandmarker() {
  if (_pose) return _pose;
  if (_loading) return _loading;

  _loading = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL },
      runningMode: "IMAGE",
      numPoses: 1,
    });
    _pose = landmarker;
    return landmarker;
  })();

  return _loading;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function overlayFromLandmarks(lm: PoseLandmark[]): Overlay {
  // MediaPipe Pose 33 indices (common subset)
  const P = {
    nose: 0,
    lShoulder: 11,
    rShoulder: 12,
    lElbow: 13,
    rElbow: 14,
    lWrist: 15,
    rWrist: 16,
    lHip: 23,
    rHip: 24,
    lKnee: 25,
    rKnee: 26,
    lAnkle: 27,
    rAnkle: 28,
  };

  const pt = (i: number): [number, number] => {
    const p = lm[i];
    return [clamp01(p?.x ?? 0.5), clamp01(p?.y ?? 0.5)];
  };

  const lines: Overlay["lines"] = [
    { a: pt(P.lShoulder), b: pt(P.rShoulder), tone: "neutral", label: "Shoulders" },
    { a: pt(P.lHip), b: pt(P.rHip), tone: "neutral", label: "Hips" },

    { a: pt(P.lShoulder), b: pt(P.lElbow), tone: "neutral" },
    { a: pt(P.lElbow), b: pt(P.lWrist), tone: "neutral" },

    { a: pt(P.rShoulder), b: pt(P.rElbow), tone: "neutral" },
    { a: pt(P.rElbow), b: pt(P.rWrist), tone: "neutral" },

    { a: pt(P.lHip), b: pt(P.lKnee), tone: "neutral" },
    { a: pt(P.lKnee), b: pt(P.lAnkle), tone: "neutral" },

    { a: pt(P.rHip), b: pt(P.rKnee), tone: "neutral" },
    { a: pt(P.rKnee), b: pt(P.rAnkle), tone: "neutral" },

    { a: pt(P.lShoulder), b: pt(P.lHip), tone: "neutral" },
    { a: pt(P.rShoulder), b: pt(P.rHip), tone: "neutral" },
  ];

  const points: Overlay["points"] = [
    { p: pt(P.nose), tone: "neutral" },
    { p: pt(P.lShoulder), tone: "neutral" },
    { p: pt(P.rShoulder), tone: "neutral" },
    { p: pt(P.lHip), tone: "neutral" },
    { p: pt(P.rHip), tone: "neutral" },
    { p: pt(P.lKnee), tone: "neutral" },
    { p: pt(P.rKnee), tone: "neutral" },
    { p: pt(P.lAnkle), tone: "neutral" },
    { p: pt(P.rAnkle), tone: "neutral" },
  ];

  return { lines, points };
}

async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
  const blob = file.slice(0, file.size, file.type);
  return await createImageBitmap(blob);
}

export async function buildPoseOverlayFromFile(file: File): Promise<{ overlay: Overlay; pose: PosePacket }> {
  const landmarker = await getPoseLandmarker();
  const bmp = await fileToImageBitmap(file);

  const res = landmarker.detect(bmp);
  bmp.close?.();

  const landmarks = res?.landmarks?.[0] as any[] | undefined;
  if (!landmarks || landmarks.length < 10) {
    throw new Error("No pose detected in frame.");
  }

  const packed: PoseLandmark[] = landmarks.map((p: any) => ({
    x: clamp01(Number(p.x)),
    y: clamp01(Number(p.y)),
    z: Number.isFinite(p.z) ? Number(p.z) : undefined,
    visibility: Number.isFinite(p.visibility) ? Number(p.visibility) : undefined,
  }));

  const overlay = overlayFromLandmarks(packed);

  const pose: PosePacket = {
    version: 1,
    landmarks: packed,
    source: "mediapipe",
  };

  return { overlay, pose };
}