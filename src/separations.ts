import type { Failed, Ready, Separation, SeparationPage, Uploading } from "./types/separation.ts";
import { type CreateOptions, create, reserve } from "./create.ts";
import type { Api, RequestOptions } from "./api.ts";
import { read, separationPath } from "./read.ts";
import type { Audio } from "./types/audio.ts";
import { wait, watch } from "./watch.ts";

// the API's largest page and its default
const largestPage = 100;

export type ListOptions = RequestOptions & {
	/** The most separations to list. */
	limit?: number;
};

export class Separations {
	readonly #api: Api;

	constructor(api: Api) {
		this.#api = api;
	}

	/** Resolves once the separation is queued, not when it is done. */
	create(audio: Audio, options: CreateOptions): Promise<Separation> {
		return create(this.#api, audio, options);
	}

	/**
	 * Reserves an upload for a file of `bytes` without sending it, so a client without the key, such as a user's
	 * browser, can upload it with one `PUT` of exactly that size to `upload_url`. The separation is queued once the
	 * upload is complete.
	 */
	reserve(bytes: number, options: CreateOptions): Promise<Uploading> {
		return reserve(this.#api, bytes, options);
	}

	get(id: string, options: RequestOptions = {}): Promise<Separation> {
		return read(this.#api, id, options.signal);
	}

	/** Newest first, fetching each page as the loop reaches it. */
	async *list({ limit = Infinity, ...options }: ListOptions = {}): AsyncGenerator<Separation> {
		let left = limit;
		let cursor: string | undefined;
		while (left > 0) {
			const query = new URLSearchParams();
			if (cursor !== undefined) query.set("cursor", cursor);
			// a full page unless fewer are left, so a small limit costs a small page
			if (left < largestPage) query.set("limit", String(left));
			const search = query.size > 0 ? `?${query}` : "";
			const page = await this.#api.json<SeparationPage>(`/v1/separations${search}`, options);
			yield* page.separations.slice(0, left);
			left -= page.separations.length;
			if (page.next === undefined) return;
			cursor = page.next;
		}
	}

	/** Cancels a running separation. A queued one's charge is returned. */
	async delete(id: string, options: RequestOptions = {}): Promise<void> {
		await this.#api.send(separationPath(id), { method: "DELETE", signal: options.signal });
	}

	/** Yields the current state, then each change of its status or place in line, until `ready` or `failed`. */
	watch(id: string, options?: RequestOptions): AsyncGenerator<Separation> {
		return watch(this.#api, id, options);
	}

	/** Resolves once the separation is `ready` or `failed`. */
	wait(id: string, options?: RequestOptions): Promise<Ready | Failed> {
		return wait(this.#api, id, options);
	}
}
