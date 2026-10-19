import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createMediaStore, localMediaStore } from "../src/storage.js";

test("local media store puts, reads, streams and removes objects", async () => {
  const root = await mkdtemp(join(tmpdir(), "roar-store-"));
  try {
    const store = localMediaStore(root);
    const temp = join(root, "incoming.part");
    await writeFile(temp, Buffer.from("hello"));

    await store.put("clip.jpg", temp);
    assert.deepEqual(await store.buffer("clip.jpg", 10), Buffer.from("hello"));
    assert.equal(await store.buffer("clip.jpg", 4), undefined);
    assert.equal(await store.buffer("missing.jpg"), undefined);

    const chunks: Buffer[] = [];
    for await (const chunk of await store.stream("clip.jpg")) chunks.push(Buffer.from(chunk));
    assert.equal(Buffer.concat(chunks).toString(), "hello");

    await store.remove("clip.jpg");
    assert.equal(await store.buffer("clip.jpg"), undefined);
    await store.remove("clip.jpg"); // deleting twice is fine
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("createMediaStore rejects unknown drivers and incomplete Azure config", () => {
  assert.throws(() => createMediaStore({ MEDIA_STORE: "s3" }), /Unknown MEDIA_STORE/);
  assert.throws(() => createMediaStore({ MEDIA_STORE: "azure-blob" }), /AZURE_STORAGE/);
});
