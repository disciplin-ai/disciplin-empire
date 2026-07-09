"use client";

import {
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

let poseLandmarker: PoseLandmarker | null = null;

export async function getPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(
    vision,
    {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
      },

      runningMode: "IMAGE",
      numPoses: 1,

      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }
  );

  return poseLandmarker;
}
export async function detectPoseLandmarks(
  image: HTMLImageElement
) {
  const landmarker = await getPoseLandmarker();

  const result = landmarker.detect(image);

  return result;
}