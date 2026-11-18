// process is undefined in Workers
export function keyOf(apiKey: string | undefined): string {
	const key = apiKey ?? globalThis.process?.env.DISBAND_KEY;
	if (key === undefined || key === "") {
		throw new Error("Neither apiKey nor DISBAND_KEY is set");
	}
	return key;
}
