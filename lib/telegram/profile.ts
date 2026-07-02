export const DEFAULT_PROFILE_ID = "default";

export async function getCurrentProfileId(): Promise<string> {
  return DEFAULT_PROFILE_ID;
}
