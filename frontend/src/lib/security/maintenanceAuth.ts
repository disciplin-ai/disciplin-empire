import { timingSafeEqual } from "node:crypto";

function equalSecret(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function isMaintenanceAuthorized(request: Request) {
  const expected = process.env.ADMIN_SYNC_KEY;
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  return equalSecret(authorization.slice(7), expected);
}
