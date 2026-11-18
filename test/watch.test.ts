import { afterEach, expect, test, vi } from "vitest";

import { fakeFetch, hang, json, separation } from "./fetch.ts";
import { wait, watch } from "../src/watch.ts";
import { Api } from "../src/api.ts";

const api = new Api({ origin: "https://api.disband.test", key: "disband_key", retries: 3 });

afterEach(() => vi.unstubAllGlobals());

async function statuses(states: AsyncIterable<{ status: string }>) {
	const seen = [];
	for await (const state of states) seen.push(state.status);
	return seen;
}

test("yields the current state, then each status once, and stops once ready", async () => {
	const requests = fakeFetch(
		json(separation("queued")),
		json(separation("queued")),
		json(separation("processing")),
		json(separation("processing")),
		json(separation("ready", { charge: 35, duration: 210, stems: {} })),
	);
	expect(await statuses(watch(api, "sep_test"))).toEqual(["queued", "processing", "ready"]);
	expect(requests).toHaveLength(5);
	expect(requests[0].headers.has("prefer")).toBe(false);
	expect(requests.slice(1).every((request) => request.headers.get("prefer") === "wait=60")).toBe(true);
});

test("yields each new place in line while queued, and not a wait that ended unchanged", async () => {
	fakeFetch(
		json(separation("queued", { position: 3 })),
		json(separation("queued", { position: 3 })),
		json(separation("queued", { position: 1 })),
		json(separation("ready", { charge: 35, duration: 210, stems: {} })),
	);
	const places = [];
	for await (const state of watch(api, "sep_test"))
		places.push(state.status === "queued" ? state.position : state.status);
	expect(places).toEqual([3, 1, "ready"]);
});

test("asks once for a separation that has already ended", async () => {
	const requests = fakeFetch(json(separation("failed", { charge: 0, problem: {} })));
	expect(await statuses(watch(api, "sep_test"))).toEqual(["failed"]);
	expect(requests).toHaveLength(1);
});

test("stops asking when the loop is left", async () => {
	const requests = fakeFetch(json(separation("queued")), json(separation("processing")));
	for await (const state of watch(api, "sep_test")) {
		if (state.status === "queued") break;
	}
	expect(requests).toHaveLength(1);
});

test("an abort ends a held read with the signal's reason, without retrying it", async () => {
	const controller = new AbortController();
	const requests = fakeFetch(json(separation("queued")), hang, json(separation("ready")));
	const waited = wait(api, "sep_test", { signal: controller.signal });
	setTimeout(() => controller.abort(new Error("gone")), 10);
	await expect(waited).rejects.toThrow("gone");
	expect(requests).toHaveLength(2);
});

test("wait returns a failed separation instead of throwing", async () => {
	fakeFetch(json(separation("processing")), json(separation("failed", { charge: 10, problem: { type: "bad-audio" } })));
	expect((await wait(api, "sep_test")).status).toBe("failed");
});
