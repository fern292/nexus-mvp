import { generateNonce } from "siwe";
import { nonceStore } from "@/lib/nonce-store";

export async function GET() {
  const nonce = generateNonce();
  const key = nonce.slice(0, 16);
  nonceStore.set(key, nonce);
  return Response.json({ nonce }, { headers: { "Cache-Control": "no-store" } });
}
