import type { Failed, Ready } from "./types/separation.ts";

// Standard Webhooks: HMAC-SHA256 over `id.timestamp.body`, a secret written as `whsec_` and its base64
const encoder = new TextEncoder();
const tolerance = 5 * 60;

const decode = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
const encode = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

const hmac = (key: Uint8Array<ArrayBuffer>) =>
	crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

/** The webhook secret of an API key, the same as when the key was created. */
export async function webhookSecret(apiKey: string): Promise<string> {
	const mac = await crypto.subtle.sign("HMAC", await hmac(encoder.encode(apiKey)), encoder.encode("disband webhooks"));
	return `whsec_${encode(mac)}`;
}

/** The separation a webhook posted, or `undefined` when its signature or timestamp doesn't verify. */
export async function verifyWebhook(request: Request, secret: string): Promise<Ready | Failed | undefined> {
	const id = request.headers.get("webhook-id");
	const timestamp = request.headers.get("webhook-timestamp");
	const signatures = request.headers.get("webhook-signature");
	if (id === null || timestamp === null || signatures === null) return undefined;
	if (Math.abs(Date.now() / 1000 - Number(timestamp)) > tolerance) return undefined;
	const body = await request.text();
	// with or without its prefix, as Standard Webhooks libraries take it
	const key = await hmac(decode(secret.replace(/^whsec_/, "")));
	const content = encoder.encode(`${id}.${timestamp}.${body}`);
	for (const entry of signatures.split(" ")) {
		const [version, mac] = entry.split(",");
		if (version === "v1" && mac !== undefined && (await crypto.subtle.verify("HMAC", key, decode(mac), content))) {
			return JSON.parse(body) as Ready | Failed;
		}
	}
	return undefined;
}
