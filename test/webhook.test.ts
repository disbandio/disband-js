import { Webhook } from "standardwebhooks";
import { expect, test } from "vitest";

import { verifyWebhook, webhookSecret } from "../src/webhook.ts";
import { separation } from "./fetch.ts";

const apiKey = "disband_EXAMPLEexampleEXAMPLEexampleEXAMPLE00";
const body = JSON.stringify(separation("ready", { charge: 35, duration: 210, stems: {} }));

// signed by the Standard Webhooks library, as the API's are
const posted = (secret: string, signedAt = new Date(), sent = body) =>
	new Request("https://receiver.example/hooks", {
		method: "POST",
		headers: {
			"webhook-id": "sep_test",
			"webhook-timestamp": String(Math.floor(signedAt.getTime() / 1000)),
			"webhook-signature": new Webhook(secret).sign("sep_test", signedAt, sent),
		},
		body,
	});

test("a key's webhook secret is the documented derivation of the key", async () => {
	// the API docs' worked example
	expect(await webhookSecret(apiKey)).toBe("whsec_MeFukvonQ5URJghmuKcsZq13z3KhKzPTJ6iSpp/Cfo8=");
});

test("a webhook signed with the key's secret gives its separation", async () => {
	const secret = await webhookSecret(apiKey);
	expect(await verifyWebhook(posted(secret), secret)).toEqual(JSON.parse(body));
});

test("a webhook signed with another secret, for another body or long ago doesn't verify", async () => {
	const secret = await webhookSecret(apiKey);
	const other = await webhookSecret("disband_OTHERotherOTHERotherOTHERotherOTHER00");
	expect(await verifyWebhook(posted(other), secret)).toBeUndefined();
	expect(await verifyWebhook(posted(secret, new Date(), `${body} `), secret)).toBeUndefined();
	expect(await verifyWebhook(posted(secret, new Date(Date.now() - 10 * 60 * 1000)), secret)).toBeUndefined();
});
