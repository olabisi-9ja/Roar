// Durable media storage. Development keeps files on disk; deployed instances use a private Azure
// Blob container. Keys are the opaque "<uuid>.<ext>" names already stored in media.blobUrl and
// media.thumbnailUrl ("/uploads/<key>"), so rows and public URLs do not change with the driver.
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";

export interface MediaStore {
  /** Persist a validated temp file under `key`. The temp file is consumed. */
  put(key: string, file: string): Promise<void>;
  /** Read a whole object for model input, or undefined when missing/oversized. */
  buffer(key: string, maxBytes?: number): Promise<Buffer | undefined>;
  /** Stream an object for an HTTP response. Throws when it does not exist. */
  stream(key: string): Promise<Readable>;
  /** Delete an object; missing objects are not an error. */
  remove(key: string): Promise<void>;
}

export function localMediaStore(root: string): MediaStore {
  const pathFor = (key: string) => join(root, key);
  return {
    async put(key, file) {
      await mkdir(root, { recursive: true });
      await rename(file, pathFor(key));
    },
    async buffer(key, maxBytes) {
      try {
        const info = await stat(pathFor(key));
        if (maxBytes !== undefined && info.size > maxBytes) return undefined;
        return await readFile(pathFor(key));
      } catch {
        return undefined;
      }
    },
    async stream(key) {
      return createReadStream(pathFor(key));
    },
    async remove(key) {
      await rm(pathFor(key), { force: true });
    },
  };
}

function azureBlobStore(container: ContainerClient): MediaStore {
  const blob = (key: string) => container.getBlockBlobClient(key);
  return {
    async put(key, file) {
      await blob(key).uploadFile(file, { concurrency: 4 });
      await rm(file, { force: true });
    },
    async buffer(key, maxBytes) {
      try {
        const client = blob(key);
        const properties = await client.getProperties();
        if (maxBytes !== undefined && (properties.contentLength ?? Number.POSITIVE_INFINITY) > maxBytes) return undefined;
        const response = await client.download();
        if (!response.readableStreamBody) return undefined;
        const chunks: Buffer[] = [];
        for await (const chunk of response.readableStreamBody) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      } catch {
        return undefined;
      }
    },
    async stream(key) {
      const response = await blob(key).download();
      if (!response.readableStreamBody) throw new Error(`Media object ${key} has no body.`);
      return response.readableStreamBody as Readable;
    },
    async remove(key) {
      await blob(key).deleteIfExists();
    },
  };
}

export function createMediaStore(env: NodeJS.ProcessEnv = process.env): MediaStore {
  const driver = (env["MEDIA_STORE"] ?? "local").toLowerCase();
  if (driver === "local") return localMediaStore(env["UPLOAD_DIR"] ?? join(process.cwd(), "uploads"));
  if (driver !== "azure-blob") throw new Error(`Unknown MEDIA_STORE "${driver}". Use local or azure-blob.`);

  const containerName = env["AZURE_STORAGE_CONTAINER"] ?? "media";
  const connectionString = env["AZURE_STORAGE_CONNECTION_STRING"];
  const account = env["AZURE_STORAGE_ACCOUNT"];
  if (connectionString) {
    return azureBlobStore(BlobServiceClient.fromConnectionString(connectionString).getContainerClient(containerName));
  }
  if (account) {
    const service = new BlobServiceClient(`https://${account}.blob.core.windows.net`, new DefaultAzureCredential());
    return azureBlobStore(service.getContainerClient(containerName));
  }
  throw new Error("MEDIA_STORE=azure-blob needs AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT.");
}

export const mediaStore = createMediaStore();
