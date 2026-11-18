// no ReadableStream, since a retry sends the body again
export type Audio = Blob | ArrayBuffer | Uint8Array<ArrayBuffer>;
