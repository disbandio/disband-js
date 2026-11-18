// any string too, for stems added after this release
export type StemId =
	| "vocals"
	| "vocals.lead"
	| "vocals.backing"
	| "instrumental"
	| "instrumental.drums"
	| "instrumental.drums.kick"
	| "instrumental.drums.snare"
	| "instrumental.drums.toms"
	| "instrumental.drums.hihat"
	| "instrumental.drums.cymbals"
	| "instrumental.drums.other"
	| "instrumental.bass"
	| "instrumental.guitar"
	| "instrumental.piano"
	| "instrumental.other"
	| (string & {});

export type Format = "wav" | "mp3";

export type Stem = { id: StemId; name: string; parent: StemId | "mix" };

export type Catalog = { stems: Stem[] };
