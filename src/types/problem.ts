// any string too, for problem types added after this release
export type ProblemType =
	| "invalid-request"
	| "unauthenticated"
	| "out-of-credits"
	| "account-suspended"
	| "account-locked"
	| "not-found"
	| "length-required"
	| "range-not-satisfiable"
	| "unsupported-audio"
	| "bad-audio"
	| "busy"
	| "internal"
	| "capacity"
	| "timeout"
	| (string & {});

/** RFC 9457 problem details. */
export type Problem = {
	type: ProblemType;
	title: string;
	status: number;
	detail?: string;
	request_id: string;
	errors?: { path: string; message: string }[];
};

export type Failure = Pick<Problem, "type" | "detail">;
