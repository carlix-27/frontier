export interface MatchRecord {
  id: number;
  result: "win" | "loss" | "draw";
  map: string;
  seconds: number;
  playedAt: string;
}

export interface LocalProfile {
  name: string;
  photos: string[];
  avatarIndex: number;
  history: MatchRecord[];
}

const STORAGE_KEY = "frontier.profile.v1";
export const DEFAULT_PROFILE: LocalProfile = { name: "Commander", photos: [], avatarIndex: 0, history: [] };

export function loadProfile(): LocalProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const saved = JSON.parse(raw) as Partial<LocalProfile>;
    const photos = Array.isArray(saved.photos) ? saved.photos.filter((photo): photo is string => typeof photo === "string" && photo.startsWith("data:image/")).slice(0, 4) : [];
    return {
      name: typeof saved.name === "string" && saved.name.trim() ? saved.name.trim().slice(0, 28) : DEFAULT_PROFILE.name,
      photos,
      avatarIndex: typeof saved.avatarIndex === "number" && Number.isInteger(saved.avatarIndex) && saved.avatarIndex >= 0 && saved.avatarIndex < photos.length ? saved.avatarIndex : 0,
      history: Array.isArray(saved.history) ? saved.history.filter((entry): entry is MatchRecord => !!entry && typeof entry.id === "number" && ["win", "loss", "draw"].includes(entry.result) && typeof entry.map === "string" && typeof entry.seconds === "number" && typeof entry.playedAt === "string").slice(0, 20) : [],
    };
  } catch { return DEFAULT_PROFILE; }
}

export function saveProfile(profile: LocalProfile): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }
  catch { /* Local play remains available when browser storage is disabled. */ }
}
