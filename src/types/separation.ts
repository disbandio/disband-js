import type { Format, StemId } from "./stem.ts";
import type { Failure } from "./problem.ts";

export type StemFile = { url: string; bytes: number };

/** `silent` when the stem has no audio, which then has no files. */
export type StemFiles =
	({ silent?: never } & { [F in Format]?: StemFile }) | ({ silent: true } & { [F in Format]?: never });

type Common = { id: string; name?: string; created_at: string; expires_at: string };

export type Uploading = Common & { status: "uploading"; upload_url: string };
export type Queued = Common & {
	status: "queued";
	charge?: number;
	/** The place in line, 1 being next. */
	position?: number;
};
export type Processing = Common & { status: "processing"; charge: number };
export type Ready = Common & {
	status: "ready";
	charge: number;
	/** In seconds. */
	duration: number;
	stems: { [S in StemId]?: StemFiles };
};
export type Failed = Common & { status: "failed"; charge: number; problem: Failure };

export type Separation = Uploading | Queued | Processing | Ready | Failed;

export type SeparationPage = {
	separations: Separation[];
	/** Absent on the last page. */
	next?: string;
};

export const ended = (separation: Separation): separation is Ready | Failed =>
	separation.status === "ready" || separation.status === "failed";
