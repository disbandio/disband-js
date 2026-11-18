import { afterEach, expect, test, vi } from "vitest";

import { fakeFetch, json, separation } from "./fetch.ts";
import { Disband } from "../src/index.ts";

afterEach(() => vi.unstubAllGlobals());

const disband = new Disband({ origin: "https://api.disband.test", apiKey: "disband_key" });

test("list follows the cursor page by page as it is iterated, and stops on the page without one", async () => {
	const requests = fakeFetch(
		json({ separations: [separation("ready"), separation("ready")], next: "1763400000000.sep_b" }),
		json({ separations: [separation("failed")] }),
	);
	const listed = [];
	for await (const one of disband.separations.list()) listed.push(one);
	expect(listed).toHaveLength(3);
	expect(requests.map((request) => new URL(request.url).search)).toEqual(["", "?cursor=1763400000000.sep_b"]);
});

test("list with a limit asks for pages no larger than what is left, and stops at the limit", async () => {
	const requests = fakeFetch(
		json({ separations: [separation("ready"), separation("ready")], next: "1763400000000.sep_b" }),
		json({ separations: [separation("failed")], next: "1763400000000.sep_c" }),
	);
	const listed = [];
	for await (const one of disband.separations.list({ limit: 3 })) listed.push(one);
	expect(listed).toHaveLength(3);
	expect(requests.map((request) => new URL(request.url).search)).toEqual([
		"?limit=3",
		"?cursor=1763400000000.sep_b&limit=1",
	]);
});

test("list asks for no page the loop doesn't reach", async () => {
	const requests = fakeFetch(json({ separations: [separation("ready")], next: "1763400000000.sep_a" }));
	for await (const listed of disband.separations.list()) {
		expect(listed.status).toBe("ready");
		break;
	}
	expect(requests).toHaveLength(1);
});
