import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { UserProfile } from "./userProfile";
import { DEFAULT_PROFILE } from "./userProfile";

export type { UserProfile } from "./userProfile";
export { DEFAULT_PROFILE, resolveDisplayName, resolveInitials } from "./userProfile";

const DATA_DIR  = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "user-profile.json");

export async function readProfile(): Promise<UserProfile> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function writeProfile(profile: Partial<UserProfile>): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const current = await readProfile();
  await writeFile(DATA_FILE, JSON.stringify({ ...current, ...profile }, null, 2), "utf-8");
}

export async function clearProfile(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(DEFAULT_PROFILE, null, 2), "utf-8");
}
