import { afterEach, expect, test, vi } from "vitest";

import { fakeFetch, json, problem } from "./fetch.ts";
import { Api } from "../src/api.ts";

const api = new Api({ origin: "https://api.disband.test", key: "disband_key", retries: 3 });

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

test("a busy create waits for Retry-After and sends the same body again", async () => {
	vi.useFakeTimers();
	const requests = fakeFetch(problem("busy", 429, { "retry-after": "3" }), json({}, 202));
	const sent = api.send("/v1/separations", { method: "POST", body: new Blob(["audio"]) });
	await vi.advanceTimersByTimeAsync(2999);
	expect(requests).toHaveLength(1);
	await vi.advanceTimersByTimeAsync(1);
	expect((await sent).status).toBe(202);
	expect(await Promise.all(requests.map((request) => request.text()))).toEqual(["audio", "audio"]);
});

test("busy is given up after the retries", async () => {
	const requests = fakeFetch(...Array.from({ length: 4 }, () => problem("busy", 429, { "retry-after": "0" })));
	await expect(api.send("/v1/separations", { method: "POST" })).rejects.toSatisfy(
		(error: { type?: string }) => error.type === "busy",
	);
	expect(requests).toHaveLength(4);
});

test("a create is never repeated after a network or server error, as it may have been charged", async () => {
	const requests = fakeFetch(new TypeError("fetch failed"), json({}));
	await expect(api.send("/v1/separations", { method: "POST" })).rejects.toThrow("fetch failed");
	expect(requests).toHaveLength(1);

	const more = fakeFetch(new Response("Bad gateway", { status: 502 }), json({}));
	await expect(api.send("/v1/separations", { method: "POST" })).rejects.toMatchObject({
		name: "ApiError",
		status: 502,
		problem: undefined,
	});
	expect(more).toHaveLength(1);
});

test("a read is repeated after a network error and after a server error, as a deploy causes", async () => {
	vi.useFakeTimers();
	const requests = fakeFetch(new TypeError("fetch failed"), problem("internal", 500), json([]));
	const sent = api.send("/v1/separations");
	await vi.runAllTimersAsync();
	expect((await sent).status).toBe(200);
	expect(requests).toHaveLength(3);
});

test("an abort during Retry-After ends the wait with the signal's reason", async () => {
	const controller = new AbortController();
	fakeFetch(problem("busy", 429, { "retry-after": "60" }));
	const sent = api.send("/v1/separations", { method: "POST", signal: controller.signal });
	setTimeout(() => controller.abort(new Error("gone")), 10);
	await expect(sent).rejects.toThrow("gone");
});

test("the key goes to the API's origin only, and a file link is fetched without it", async () => {
	const requests = fakeFetch(new Response("{}"), new Response("mp3"));
	await expect(api.send("https://elsewhere.test/v1/separations")).rejects.toThrow("elsewhere.test");
	expect(requests).toHaveLength(0);

	await api.send("/v1/separations");
	expect(requests[0]?.headers.get("authorization")).toBe("Bearer disband_key");
	await api.open("https://files.test/separations/sep_test/vocals.mp3?X-Amz-Signature=signed");
	expect(requests[1]?.headers.get("authorization")).toBeNull();
});
