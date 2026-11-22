import type { StemFile } from "./types/separation.ts";
import { Api, type RequestOptions } from "./api.ts";
import { Separations } from "./separations.ts";
import type { Catalog } from "./types/stem.ts";
import type { Usage } from "./types/usage.ts";
import { keyOf } from "./key.ts";

export type DisbandOptions = {
	/** `DISBAND_KEY` from the environment when omitted. */
	apiKey?: string;
	/** `https://api.disband.io` when omitted. */
	origin?: string;
	/** Retries for busy responses, and for network and server errors on reads and deletes. */
	maxRetries?: number;
};

export class Disband {
	readonly separations: Separations;
	readonly #api: Api;

	constructor({ apiKey, origin = "https://api.disband.io", maxRetries = 3 }: DisbandOptions = {}) {
		if (!Number.isInteger(maxRetries) || maxRetries < 0) {
			throw new RangeError("maxRetries must be a whole number of 0 or more");
		}
		this.#api = new Api({ origin, key: keyOf(apiKey), retries: maxRetries });
		this.separations = new Separations(this.#api);
	}

	/** Fetches a stem file. Rejects with an `ApiError` once the separation has expired or was deleted. */
	download(file: StemFile, options: RequestOptions = {}): Promise<Response> {
		return this.#api.open(file.url, options);
	}

	/** The stems a separation can request. */
	catalog(options: RequestOptions = {}): Promise<Catalog> {
		return this.#api.json("/v1/catalog", options);
	}

	/** The account's credits and limits. */
	usage(options: RequestOptions = {}): Promise<Usage> {
		return this.#api.json("/v1/usage", options);
	}
}
