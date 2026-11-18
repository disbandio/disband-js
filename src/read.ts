import type { Separation } from "./types/separation.ts";
import type { Api } from "./api.ts";

export const separationPath = (id: string) => `/v1/separations/${encodeURIComponent(id)}`;

// a held read returns once the separation changes, its place in line included, at most 60 s later
export function read(api: Api, id: string, signal?: AbortSignal, held = false): Promise<Separation> {
	return api.json(separationPath(id), { signal, headers: held ? { prefer: "wait=60" } : {} });
}
