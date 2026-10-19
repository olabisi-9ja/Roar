// Browser-declared MIME types are only a hint. We stream uploads to disk, then check the first bytes
// before accepting them, so an HTML/script payload cannot be stored as an image or video.
import { open } from "node:fs/promises";

const ascii = (buffer: Buffer, start: number, end: number) => buffer.subarray(start, end).toString("ascii");

export function hasMagicBytes(header: Buffer, mimetype: string): boolean {
  switch (mimetype) {
    case "image/jpeg":
      return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    case "image/png":
      return header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/gif":
      return header.length >= 6 && (ascii(header, 0, 6) === "GIF87a" || ascii(header, 0, 6) === "GIF89a");
    case "image/webp":
      return header.length >= 12 && ascii(header, 0, 4) === "RIFF" && ascii(header, 8, 12) === "WEBP";
    case "video/mp4":
      return header.length >= 8 && ascii(header, 4, 8) === "ftyp";
    case "video/webm":
      return header.length >= 4 && header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
    default:
      return false;
  }
}

export async function hasValidSignature(path: string, mimetype: string): Promise<boolean> {
  const handle = await open(path, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return hasMagicBytes(header.subarray(0, bytesRead), mimetype);
  } finally {
    await handle.close();
  }
}
