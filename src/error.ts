import type { Problem, ProblemType } from "./types/problem.ts";

/** An error response, with the API's problem details. `type` is undefined for a response without them. */
export class ApiError extends Error {
	override readonly name = "ApiError";
	readonly type?: ProblemType;

	constructor(
		readonly status: number,
		readonly problem?: Problem,
	) {
		super(problem === undefined ? `HTTP ${status}` : [problem.title, problem.detail].filter(Boolean).join(": "));
		this.type = problem?.type;
	}
}

export async function errorOf(response: Response): Promise<ApiError> {
	if (!response.headers.get("content-type")?.includes("application/problem+json")) {
		await response.body?.cancel();
		return new ApiError(response.status);
	}
	return new ApiError(response.status, (await response.json()) as Problem);
}
