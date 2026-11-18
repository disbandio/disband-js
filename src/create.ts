import type { Separation, Uploading } from "./types/separation.ts";
import type { Format, StemId } from "./types/stem.ts";
import type { Api, RequestOptions } from "./api.ts";
import { read, separationPath } from "./read.ts";
import type { Audio } from "./types/audio.ts";
import { errorOf } from "./error.ts";

export type CreateOptions = RequestOptions & {
	stems: StemId[];
	/** Both formats when omitted. */
	formats?: Format[];
	/** The File's name when omitted. */
	name?: string;
};

// the largest file sent as the request body
const bodyLimit = 100_000_000;

export async function create(api: Api, audio: Audio, { stems, formats = [], name, signal }: CreateOptions) {
	const query = new URLSearchParams();
	for (const stem of stems) query.append("stems", stem);
	for (const format of formats) query.append("formats", format);
	const named = name ?? nameOf(audio);
	if (named !== undefined) query.set("name", named);

	const bytes = audio instanceof Blob ? audio.size : audio.byteLength;
	if (bytes <= bodyLimit) {
		return api.json<Separation>(`/v1/separations?${query}`, {
			method: "POST",
			headers: { "content-type": "application/octet-stream" },
			body: audio,
			signal,
		});
	}
	query.set("bytes", String(bytes));
	const reserved = await api.json<Uploading>(`/v1/separations?${query}`, { method: "POST", signal });
	try {
		// a presigned URL, so the key isn't sent
		const upload = await fetch(reserved.upload_url, { method: "PUT", body: audio, signal });
		if (!upload.ok) throw await errorOf(upload);
	} catch (error) {
		// an unused reservation counts as an upload until it expires
		await api.send(separationPath(reserved.id), { method: "DELETE" }).catch(() => undefined);
		throw error;
	}
	// the separation can still be uploading for a moment after the PUT
	let state = await read(api, reserved.id, signal);
	while (state.status === "uploading") state = await read(api, reserved.id, signal, true);
	return state;
}

// the API refuses an empty name or one over 255 characters
function nameOf(audio: Audio): string | undefined {
	if (!(audio instanceof File)) return undefined;
	const name = audio.name.trim().slice(0, 255);
	return name === "" ? undefined : name;
}
