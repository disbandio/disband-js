import { expect, test } from "vitest";

import { ApiError, Disband } from "../src/index.ts";

// skipped without DISBAND_ORIGIN and DISBAND_KEY, which a local .env sets
const origin = process.env.DISBAND_ORIGIN;

// two seconds of a 440 Hz tone as 16-bit mono WAV
function tone(): Uint8Array<ArrayBuffer> {
	const rate = 44_100;
	const samples = rate * 2;
	const view = new DataView(new ArrayBuffer(44 + samples * 2));
	const text = (at: number, value: string) =>
		[...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
	text(0, "RIFF");
	view.setUint32(4, 36 + samples * 2, true);
	text(8, "WAVEfmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, rate, true);
	view.setUint32(28, rate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	text(36, "data");
	view.setUint32(40, samples * 2, true);
	for (let i = 0; i < samples; i++) {
		view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12_000), true);
	}
	return new Uint8Array(view.buffer);
}

test.skipIf(origin === undefined)("splits a song end to end", { timeout: 180_000 }, async () => {
	const disband = new Disband({ origin });
	const created = await disband.separations.create(tone(), {
		stems: ["vocals", "instrumental"],
		formats: ["mp3"],
		name: "test.wav",
	});
	const ids = [];
	for await (const separation of disband.separations.list()) ids.push(separation.id);
	expect(ids).toContain(created.id);

	const ended = await disband.separations.wait(created.id);
	if (ended.status === "failed") throw new Error(ended.problem.type);
	// a tone has no vocals, so the instrumental isn't silent
	const mp3 = ended.stems.instrumental?.mp3;
	if (mp3 === undefined) throw new Error("The instrumental came without its MP3");
	const response = await disband.download(mp3);
	expect((await response.arrayBuffer()).byteLength).toBe(mp3.bytes);

	await disband.separations.delete(created.id);
	await expect(disband.separations.get(created.id)).rejects.toSatisfy(
		(error) => error instanceof ApiError && error.type === "not-found",
	);
});
