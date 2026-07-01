import { writeFile, readFile, mkdir, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { supabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

const execAsync = promisify(exec);

export const AUDIO_COMPRESS_THRESHOLD = 23 * 1024 * 1024;
export const AUDIO_MAX_RAW_SIZE = 500 * 1024 * 1024;

export const SUPPORTED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
  "audio/flac",
  "video/mp4",
];

export const SUPPORTED_AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "ogg", "oga", "webm", "mp4", "aac", "flac"];

export interface StoredAudioFile {
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: string;
}

export function isSupportedAudioFile(fileName: string, mimeType?: string | null): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_AUDIO_EXTENSIONS.includes(ext) || Boolean(mimeType && SUPPORTED_AUDIO_MIME_TYPES.includes(mimeType));
}

function safeBaseName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._\-а-яА-Я]/g, "_")
    .slice(0, 80) || "audio";
}

async function compressAudio(inputBuffer: Buffer, originalName: string): Promise<Buffer> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tmpIn = `/tmp/audio_in_${id}`;
  const tmpOut = `/tmp/audio_out_${id}.mp3`;
  try {
    await writeFile(tmpIn, inputBuffer);
    await execAsync(
      `ffmpeg -i "${tmpIn}" -vn -ar 16000 -ac 1 -b:a 16k "${tmpOut}" -y`,
      { timeout: 120_000 },
    );

    let compressed = await readFile(tmpOut);

    if (compressed.length > AUDIO_COMPRESS_THRESHOLD) {
      await execAsync(
        `ffmpeg -i "${tmpIn}" -vn -ar 8000 -ac 1 -b:a 8k "${tmpOut}" -y`,
        { timeout: 120_000 },
      );
      compressed = await readFile(tmpOut);
    }

    console.log(
      `[audio/upload] ${originalName}: ${(inputBuffer.length / 1024 / 1024).toFixed(1)} MB -> ${(compressed.length / 1024 / 1024).toFixed(1)} MB`,
    );
    return compressed;
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}

async function compressAudioFile(inputPath: string, originalName: string, originalSize?: number): Promise<Buffer> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tmpOut = `/tmp/audio_out_${id}.mp3`;
  try {
    await execAsync(
      `ffmpeg -i "${inputPath}" -vn -ar 16000 -ac 1 -b:a 16k "${tmpOut}" -y`,
      { timeout: 120_000 },
    );

    let compressed = await readFile(tmpOut);

    if (compressed.length > AUDIO_COMPRESS_THRESHOLD) {
      await execAsync(
        `ffmpeg -i "${inputPath}" -vn -ar 8000 -ac 1 -b:a 8k "${tmpOut}" -y`,
        { timeout: 120_000 },
      );
      compressed = await readFile(tmpOut);
    }

    console.log(
      `[audio/upload] ${originalName}: ${originalSize ? `${(originalSize / 1024 / 1024).toFixed(1)} MB` : "file"} -> ${(compressed.length / 1024 / 1024).toFixed(1)} MB`,
    );
    return compressed;
  } finally {
    await unlink(tmpOut).catch(() => {});
  }
}

export async function storeAudioBuffer(input: {
  buffer: Buffer;
  originalName: string;
  mimeType?: string | null;
}): Promise<StoredAudioFile> {
  if (!isSupportedAudioFile(input.originalName, input.mimeType)) {
    throw new Error("Unsupported audio file format");
  }
  if (input.buffer.length > AUDIO_MAX_RAW_SIZE) {
    throw new Error("Audio file is too large");
  }

  let buffer = input.buffer;
  let storedExt = input.originalName.match(/\.[^.]+$/)?.[0] ?? ".mp3";
  let contentType = input.mimeType || "audio/mpeg";

  if (buffer.length > AUDIO_COMPRESS_THRESHOLD) {
    buffer = await compressAudio(buffer, input.originalName);
    storedExt = ".mp3";
    contentType = "audio/mpeg";
  }

  const storedName = `${Date.now()}-${safeBaseName(input.originalName)}${storedExt}`;

  if (isSupabaseConfigured()) {
    const { error } = await supabaseServer!.storage
      .from("audio")
      .upload(storedName, buffer, { contentType, upsert: false });

    if (error) throw new Error(`Storage upload: ${error.message}`);

    return {
      fileName: input.originalName,
      fileUrl: `storage://audio/${storedName}`,
      fileSize: buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, storedName), buffer);

  return {
    fileName: input.originalName,
    fileUrl: `/uploads/${storedName}`,
    fileSize: buffer.length,
    uploadedAt: new Date().toISOString(),
  };
}

export async function storeAudioFileFromPath(input: {
  filePath: string;
  originalName: string;
  mimeType?: string | null;
  fileSize?: number | null;
}): Promise<StoredAudioFile> {
  if (!isSupportedAudioFile(input.originalName, input.mimeType)) {
    throw new Error("Unsupported audio file format");
  }
  if (input.fileSize && input.fileSize > AUDIO_MAX_RAW_SIZE) {
    throw new Error("Audio file is too large");
  }

  if (input.fileSize && input.fileSize > AUDIO_COMPRESS_THRESHOLD) {
    const compressed = await compressAudioFile(input.filePath, input.originalName, input.fileSize);
    return storeAudioBuffer({
      buffer: compressed,
      originalName: input.originalName.replace(/\.[^.]+$/, "") + ".mp3",
      mimeType: "audio/mpeg",
    });
  }

  const buffer = await readFile(input.filePath);
  return storeAudioBuffer({
    buffer,
    originalName: input.originalName,
    mimeType: input.mimeType,
  });
}
