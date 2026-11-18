export type Credits = { free: number; bought: number };

export type Usage = {
	balance: Credits;
	limits: {
		/** Free credits a day, absent while free use is paused. */
		daily?: number;
		/** The longest file, in seconds. */
		seconds: number;
		/** The largest file, in bytes. */
		bytes: number;
		/** Separations at once, absent when there is no limit. */
		jobs?: number;
		/** Uploads at once. */
		uploads: number;
	};
};
