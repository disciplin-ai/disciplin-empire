import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Durable evidence.
 *
 * The footage is what happened. An observation is what someone saw in it.
 * Those are separate records here and must stay separate: one asset supports
 * many readings — Vision today, a better Vision later, the coach, the athlete —
 * without ever duplicating the media or overwriting an earlier reading.
 *
 * Nothing in here trusts a client clock. Whatever the browser reports is kept
 * beside the server's own timestamp, never in place of it.
 */

export const EVIDENCE_BUCKET = "evidence";

export type EvidenceOrigin = "recorded" | "backfilled";

export type StoredAsset = {
  id: string;
  storage_path: string;
  content_hash: string;
  uploaded_at: string;
};

export type EvidenceWriteResult =
  | { ok: true; asset: StoredAsset; observationId: string | null; reused: boolean }
  | { ok: false; stage: "upload" | "asset" | "observation"; error: string };

function extensionFor(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function hashBytes(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Persists the media and the reading of it.
 *
 * Re-uploading identical bytes reuses the existing asset rather than storing
 * the file twice — the same clip reviewed again is one asset with two
 * observations, which is the whole point of separating them.
 */
export async function recordEvidence(
  supabase: SupabaseClient,
  input: {
    athleteUserId: string;
    bytes: Buffer;
    mimeType: string;
    uploaderName: string;
    uploaderRole: "athlete" | "coach";
    organisationId?: string | null;
    organisationName?: string | null;
    capturedAt?: string | null;
    clientReportedAt?: string | null;
    origin?: EvidenceOrigin;
    observation?: {
      kind: "vision_model" | "coach" | "athlete";
      observerName: string;
      observerRole: "system" | "athlete" | "coach";
      model?: string | null;
      modelVersion?: string | null;
      claims: unknown;
      confidence?: number | null;
      observedAt?: string | null;
      supersedesObservationId?: string | null;
    };
  }
): Promise<EvidenceWriteResult> {
  const origin = input.origin ?? "recorded";
  const contentHash = hashBytes(input.bytes);

  // Same bytes, same athlete — one asset.
  const { data: existing } = await supabase
    .from("evidence_assets")
    .select("id, storage_path, content_hash, uploaded_at")
    .eq("athlete_user_id", input.athleteUserId)
    .eq("content_hash", contentHash)
    .maybeSingle();

  let asset = (existing as StoredAsset | null) ?? null;
  let reused = Boolean(asset);

  if (!asset) {
    const assetId = crypto.randomUUID();
    const storagePath = `${input.athleteUserId}/${assetId}.${extensionFor(input.mimeType)}`;

    const upload = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(storagePath, input.bytes, {
        contentType: input.mimeType,
        upsert: false,
      });

    if (upload.error) {
      return { ok: false, stage: "upload", error: upload.error.message };
    }

    const { data: inserted, error: assetError } = await supabase
      .from("evidence_assets")
      .insert({
        id: assetId,
        athlete_user_id: input.athleteUserId,
        storage_bucket: EVIDENCE_BUCKET,
        storage_path: storagePath,
        content_hash: contentHash,
        byte_size: input.bytes.byteLength,
        mime_type: input.mimeType,
        captured_at: input.capturedAt ?? null,
        client_reported_at: input.clientReportedAt ?? null,
        uploaded_by_user_id: input.athleteUserId,
        uploader_name_snapshot: input.uploaderName,
        uploader_role_snapshot: input.uploaderRole,
        organisation_id: input.organisationId ?? null,
        organisation_name_snapshot: input.organisationName ?? null,
        origin,
      })
      .select("id, storage_path, content_hash, uploaded_at")
      .single();

    if (assetError || !inserted) {
      return {
        ok: false,
        stage: "asset",
        error: assetError?.message ?? "asset row not created",
      };
    }

    asset = inserted as StoredAsset;
    reused = false;
  }

  let observationId: string | null = null;

  if (input.observation) {
    const o = input.observation;
    const { data: obs, error: obsError } = await supabase
      .from("evidence_observations")
      .insert({
        asset_id: asset.id,
        athlete_user_id: input.athleteUserId,
        observer_kind: o.kind,
        observer_user_id: o.kind === "vision_model" ? null : input.athleteUserId,
        observer_name_snapshot: o.observerName,
        observer_role_snapshot: o.observerRole,
        organisation_id: input.organisationId ?? null,
        organisation_name_snapshot: input.organisationName ?? null,
        observer_model: o.kind === "vision_model" ? o.model ?? null : null,
        observer_model_version: o.kind === "vision_model" ? o.modelVersion ?? null : null,
        claims: o.claims ?? {},
        confidence: o.confidence ?? null,
        observed_at: o.observedAt ?? null,
        client_reported_at: input.clientReportedAt ?? null,
        supersedes_observation_id: o.supersedesObservationId ?? null,
        origin,
      })
      .select("id")
      .single();

    if (obsError || !obs) {
      // The asset is already durable. Say so plainly rather than reporting a
      // clean save: a half-written record the caller believes is whole is
      // worse than a failure it can see.
      return {
        ok: false,
        stage: "observation",
        error: obsError?.message ?? "observation row not created",
      };
    }

    observationId = (obs as { id: string }).id;
  }

  return { ok: true, asset, observationId, reused };
}

/** Short-lived read URL. Media is never public. */
export async function signedEvidenceUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 300
) {
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) return null;
  return data.signedUrl;
}
