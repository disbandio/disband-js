<p align="center">
  <img src="https://disband.io/favicon.svg" alt="" width="128">
</p>

<h1 align="center">Disband</h1>

<p align="center">
  TypeScript SDK for the stem separation API at <a href="https://disband.io">disband.io</a>
  <br><br>
  <a href="https://www.npmjs.com/package/disband"><img src="https://img.shields.io/npm/v/disband?color=blue" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/disbandio/disband-js?color=blue" alt="License"></a>
</p>

## Usage

```sh
npm install disband
```

Create a key on [API keys](https://disband.io/app/keys) and set it as `DISBAND_KEY`.

## Examples

### Split a song

```ts
import { Disband } from "disband";
import { openAsBlob } from "node:fs";
import { writeFile } from "node:fs/promises";

// reads DISBAND_KEY
const disband = new Disband();

const song = await openAsBlob("song.mp3");
const { id } = await disband.separations.create(song, {
  stems: ["vocals", "instrumental"],
  formats: ["mp3"],
});
const separation = await disband.separations.wait(id);
if (separation.status === "failed") {
  throw new Error(separation.problem.type);
}

for (const [stem, files] of Object.entries(separation.stems)) {
  // silent stems have no files
  const mp3 = files?.mp3;
  if (mp3 === undefined) continue;

  const response = await disband.download(mp3);
  if (response.body) {
    await writeFile(`${stem}.mp3`, response.body);
  }
}
```

### Upload from a user's browser

Reserve the upload on your server, then hand the upload URL to the browser. The key stays on your server, and the
file never passes through it.

```ts
// on your server
const { id, upload_url } = await disband.separations.reserve(file.size, {
  stems: ["vocals", "instrumental"],
  webhook: "https://example.com/hooks/disband",
});
```

```ts
// in the browser, with the upload_url from your server
await fetch(upload_url, { method: "PUT", body: file });
```

The separation starts once the upload is complete.

### Follow its progress

```ts
// 3, 2, 1, queued, processing, ready
for await (const state of disband.separations.watch(id)) {
  console.log((state.status === "queued" && state.position) || state.status);
}
```

### List recent separations

```ts
for await (const separation of disband.separations.list({ limit: 20 })) {
  console.log(separation.id, separation.status);
}
```

### Handle errors

```ts
import { ApiError } from "disband";

try {
  const { id } = await disband.separations.create(song, { stems: ["vocals"] });
  const separation = await disband.separations.wait(id);
  if (separation.status === "failed" && separation.problem.type === "bad-audio") {
    console.log("The file couldn't be decoded");
  }
} catch (error) {
  if (!(error instanceof ApiError && error.type === "out-of-credits")) throw error;
  console.log(error.problem?.detail);
}
```

### Receive a webhook

```ts
import { verifyWebhook } from "disband";

await disband.separations.create(song, {
  stems: ["vocals"],
  webhook: "https://example.com/disband",
});

// at https://example.com/disband
export default {
  async fetch(request: Request, env: { DISBAND_WEBHOOK_SECRET: string }) {
    const separation = await verifyWebhook(request, env.DISBAND_WEBHOOK_SECRET);
    if (separation === undefined) return new Response(null, { status: 400 });
    return new Response(null, { status: 204 });
  },
};
```

## Requirements

- Node.js 22.12 or later
- Bun
- Deno
- Cloudflare Workers

## Docs

[disband.io/docs](https://disband.io/docs)
