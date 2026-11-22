import type { Audio } from "./types/audio.ts";
import { errorOf } from "./error.ts";
import { sleep } from "./sleep.ts";

export type RequestOptions = { signal?: AbortSignal };

type Init = RequestOptions & { method?: "POST" | "DELETE"; headers?: Record<string, string>; body?: Audio };

const backoff = (attempt: number) => 2 ** attempt * 1000;

export class Api {
	readonly #origin: string;
	readonly #key: string;
	readonly #retries: number;

	constructor({ origin, key, retries }: { origin: string; key: string; retries: number }) {
		this.#origin = new URL(origin).origin;
		this.#key = key;
		this.#retries = retries;
	}

	// an API path, with the key
	async send(target: string, init: Init = {}): Promise<Response> {
		const url = new URL(target, this.#origin);
		if (url.origin !== this.#origin) throw new Error(`${url.origin} is not the API's origin`);
		return this.#attempt(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${this.#key}` } });
	}

	// a file link from a response, which works without the key and may be on any host
	open(url: string, options: RequestOptions = {}): Promise<Response> {
		return this.#attempt(new URL(url), options);
	}

	async #attempt(url: URL, init: Init): Promise<Response> {
		// a create may already be charged, so only reads and deletes retry these errors
		const repeatable = init.method !== "POST";
		for (let attempt = 0; ; attempt++) {
			const last = attempt >= this.#retries;
			let response: Response;
			try {
				response = await fetch(url, { ...init, redirect: "manual" });
			} catch (error) {
				// sleep rejects on abort, which ends the retries
				if (!repeatable || last) throw error;
				await sleep(backoff(attempt), init.signal);
				continue;
			}
			if (response.ok) return response;
			const error = await errorOf(response);
			if (last) throw error;
			// busy is returned before anything is created, so any method retries
			if (error.type === "busy") {
				await sleep(Number(response.headers.get("retry-after") ?? 1) * 1000, init.signal);
			} else if (repeatable && response.status >= 500) {
				await sleep(backoff(attempt), init.signal);
			} else {
				throw error;
			}
		}
	}

	// not validated at run time, so a new field never breaks an older client
	async json<T>(target: string, init?: Init): Promise<T> {
		const response = await this.send(target, init);
		return (await response.json()) as T;
	}
}
