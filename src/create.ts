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
	/** An `https` URL the separation is posted to once it is `ready` or `failed`. */
	webhook?: string;
};

// the largest file sent as the request body
const bodyLimit = 100_000_000;

export async function create(api: Api, audio: Audio, options: CreateOptions): Promise<Separation> {
	const bytes = audio instanceof Blob ? audio.size : audio.byteLength;
	const named = { ...options, name: options.name ?? nameOf(audio) };
	if (bytes <= bodyLimit) {
		const { query, headers } = requestOf(named);
		return api.json<Separation>(`/v1/separations?${query}`, {
			method: "POST",
			headers: { ...headers, "content-type": "application/octet-stream" },
			body: audio,
			signal: options.signal,
		});
	}
	const reserved = await reserve(api, bytes, named);
	try {
		// a presigned URL, so the key isn't sent
		const upload = await fetch(reserved.upload_url, { method: "PUT", body: audio, signal: options.signal });
		if (!upload.ok) throw await errorOf(upload);
	} catch (error) {
		// an unused reservation counts as an upload until it expires
		await api.send(separationPath(reserved.id), { method: "DELETE" }).catch(() => undefined);
		throw error;
	}
	// the separation can still be uploading for a moment after the PUT
	let state = await read(api, reserved.id, options.signal);
	while (state.status === "uploading") state = await read(api, reserved.id, options.signal, true);
	return state;
}

export function reserve(api: Api, bytes: number, options: CreateOptions): Promise<Uploading> {
	const { query, headers } = requestOf(options);
	query.set("bytes", String(bytes));
	return api.json<Uploading>(`/v1/separations?${query}`, { method: "POST", headers, signal: options.signal });
}

function requestOf({ stems, formats = [], name, webhook }: CreateOptions) {
	const query = new URLSearchParams();
	for (const stem of stems) query.append("stems", stem);
	for (const format of formats) query.append("formats", format);
	if (name !== undefined) query.set("name", name);
	// a header, as request logs record query strings and a webhook URL may carry a token
	const headers: Record<string, string> = webhook === undefined ? {} : { "disband-webhook": webhook };
	return { query, headers };
}

// the API refuses an empty name or one over 255 characters
function nameOf(audio: Audio): string | undefined {
	if (!(audio instanceof File)) return undefined;
	const name = audio.name.trim().slice(0, 255);
	return name === "" ? undefined : name;
}
