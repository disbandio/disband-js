import { vi } from "vitest";

type Answer = Response | Error | ((request: Request) => Response | Promise<Response>);

export function fakeFetch(...answers: Answer[]): Request[] {
	const requests: Request[] = [];
	vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
		const request = new Request(input, init);
		requests.push(request);
		const answer = answers.shift();
		if (answer === undefined) throw new Error(`No response left for ${request.method} ${request.url}`);
		if (answer instanceof Error) throw answer;
		return typeof answer === "function" ? answer(request) : answer;
	});
	return requests;
}

export const json = (body: unknown, status = 200) => Response.json(body, { status });

export const problem = (type: string, status: number, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify({ type, title: type, status, request_id: "req" }), {
		status,
		headers: { "content-type": "application/problem+json", ...headers },
	});

export const separation = (status: string, more: object = {}) => ({
	id: "sep_test",
	name: "example.mp3",
	created_at: "2026-11-16T10:00:00Z",
	expires_at: "2026-11-16T11:00:00Z",
	status,
	...more,
});

// never resolves, rejects with the abort reason
export const hang = (request: Request) =>
	new Promise<Response>((_, reject) => request.signal.addEventListener("abort", () => reject(request.signal.reason)));
