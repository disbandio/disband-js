import { type Failed, type Ready, type Separation, ended } from "./types/separation.ts";
import type { Api, RequestOptions } from "./api.ts";
import { read } from "./read.ts";

// the place in line, which only a queued separation has
const placeOf = (separation: Separation) => (separation.status === "queued" ? separation.position : undefined);

export async function* watch(api: Api, id: string, { signal }: RequestOptions = {}): AsyncGenerator<Separation> {
	let state = await read(api, id, signal);
	yield state;
	while (!ended(state)) {
		const next = await read(api, id, signal, true);
		if (next.status !== state.status || placeOf(next) !== placeOf(state)) yield next;
		state = next;
	}
}

export async function wait(api: Api, id: string, { signal }: RequestOptions = {}): Promise<Ready | Failed> {
	let state = await read(api, id, signal);
	while (!ended(state)) state = await read(api, id, signal, true);
	return state;
}
