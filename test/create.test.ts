import { afterEach, expect, test, vi } from "vitest";

import { fakeFetch, json, separation } from "./fetch.ts";
import { create, reserve } from "../src/create.ts";
import { Api } from "../src/api.ts";

const api = new Api({ origin: "https://api.disband.test", key: "disband_key", retries: 0 });
const upload_url = "https://storage.disband.test/put?signature=x";
// the largest request body the API documents
const bodyLimit = 100_000_000;

afterEach(() => vi.unstubAllGlobals());

test("sends a small file as the create's body, named after the File", async () => {
	const requests = fakeFetch(json(separation("queued"), 202));
	const file = new File(["audio"], "example.mp3");
	expect((await create(api, file, { stems: ["vocals", "instrumental"], formats: ["mp3"] })).status).toBe("queued");
	const url = new URL(requests[0].url);
	expect(url.pathname).toBe("/v1/separations");
	expect(url.searchParams.getAll("stems")).toEqual(["vocals", "instrumental"]);
	expect(url.searchParams.getAll("formats")).toEqual(["mp3"]);
	expect(url.searchParams.get("name")).toBe("example.mp3");
	expect(await requests[0].text()).toBe("audio");
});

test("a File without a usable name sends none, which the API would refuse", async () => {
	const requests = fakeFetch(json(separation("queued"), 202));
	await create(api, new File(["audio"], "  "), { stems: ["vocals"] });
	expect(new URL(requests[0].url).searchParams.has("name")).toBe(false);
});

test("a file of exactly the body limit still goes as the body", async () => {
	const requests = fakeFetch(json(separation("queued"), 202));
	await create(api, new Blob([new Uint8Array(bodyLimit)]), { stems: ["vocals"] });
	expect(requests).toHaveLength(1);
	expect(new URL(requests[0].url).searchParams.has("bytes")).toBe(false);
});

test("a larger file is put to a reserved upload without the key, then followed until it leaves uploading", async () => {
	const requests = fakeFetch(
		json(separation("uploading", { upload_url }), 202),
		new Response(null, { status: 200 }),
		json(separation("uploading", { upload_url })),
		json(separation("queued")),
	);
	const created = await create(api, new Blob([new Uint8Array(bodyLimit + 1)]), { stems: ["vocals"] });
	expect(created.status).toBe("queued");
	const [reserve, put, read, held] = requests;
	expect(new URL(reserve.url).searchParams.get("bytes")).toBe(String(bodyLimit + 1));
	expect(reserve.body).toBeNull();
	expect(put.url).toBe(upload_url);
	expect(put.headers.has("authorization")).toBe(false);
	expect(read.headers.has("prefer")).toBe(false);
	expect(held.headers.get("prefer")).toBe("wait=60");
});

test("a failed upload deletes its reservation, which would hold a job slot for an hour", async () => {
	const requests = fakeFetch(
		json(separation("uploading", { upload_url }), 202),
		new Response(null, { status: 403 }),
		new Response(null, { status: 204 }),
	);
	await expect(create(api, new Blob([new Uint8Array(bodyLimit + 1)]), { stems: ["vocals"] })).rejects.toMatchObject({
		name: "ApiError",
		status: 403,
	});
	expect(requests[2].method).toBe("DELETE");
	expect(new URL(requests[2].url).pathname).toBe("/v1/separations/sep_test");
});

test("a reservation sends the size, stems, name and webhook but no body, and returns the upload URL", async () => {
	const requests = fakeFetch(json(separation("uploading", { upload_url }), 202));
	const reserved = await reserve(api, 4_000_000, {
		stems: ["vocals"],
		name: "example.wav",
		webhook: "https://receiver.example/hooks",
	});
	expect(reserved.upload_url).toBe(upload_url);
	expect(requests).toHaveLength(1);
	const url = new URL(requests[0].url);
	expect(url.searchParams.get("bytes")).toBe("4000000");
	expect(url.searchParams.getAll("stems")).toEqual(["vocals"]);
	expect(url.searchParams.get("name")).toBe("example.wav");
	expect(requests[0].headers.get("disband-webhook")).toBe("https://receiver.example/hooks");
	expect(requests[0].body).toBeNull();
});

test("a webhook goes as a header, never in the query", async () => {
	const requests = fakeFetch(json(separation("queued"), 202));
	await create(api, new Blob(["audio"]), { stems: ["vocals"], webhook: "https://receiver.example/hooks?token=1" });
	expect(requests[0].headers.get("disband-webhook")).toBe("https://receiver.example/hooks?token=1");
	expect(requests[0].url).not.toContain("receiver.example");
});
