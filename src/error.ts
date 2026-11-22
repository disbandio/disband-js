import type { Failure, Problem, ProblemType } from "./types/problem.ts";
import type { Failed } from "./types/separation.ts";

/**
 * An error response with the API's problem details, or a separation that failed to start after its upload, which
 * `create` throws as the response a smaller file would have had. `type` is undefined for a response without problem
 * details.
 */
export class ApiError extends Error {
	override readonly name = "ApiError";
	readonly type?: ProblemType;

	constructor(
		/** Undefined for a separation that failed to start. */
		readonly status: number | undefined,
		readonly problem?: Problem | Failure,
		/** The separation that failed to start. */
		readonly separation?: Failed,
	) {
		super(messageOf(status, problem));
		this.type = problem?.type;
	}
}

function messageOf(status: number | undefined, problem: Problem | Failure | undefined): string {
	if (problem === undefined) return `HTTP ${status}`;
	const title = "title" in problem ? problem.title : problem.type;
	return [title, problem.detail].filter(Boolean).join(": ");
}

export async function errorOf(response: Response): Promise<ApiError> {
	if (!response.headers.get("content-type")?.includes("application/problem+json")) {
		await response.body?.cancel();
		return new ApiError(response.status);
	}
	return new ApiError(response.status, (await response.json()) as Problem);
}
