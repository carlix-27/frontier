import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROFILE, loadProfile, saveProfile } from "./profile";

const key = "frontier.profile.v1";

describe("local player profile", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves a player identity and match result across reads", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (name: string) => name === key ? storage.get(name) ?? null : null, setItem: (name: string, value: string) => { storage.set(name, value); } });
    const profile = { name: "Alex", photos: ["data:image/jpeg;base64,AAAA"], avatarIndex: 0, history: [{ id: 1, result: "win" as const, map: "Crownlands", seconds: 91, playedAt: "2026-11-17T00:00:00.000Z" }] };
    saveProfile(profile);
    expect(loadProfile()).toEqual(profile);
  });

  it("recovers from invalid saved profile data", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{broken", setItem: () => {} });
    expect(loadProfile()).toEqual(DEFAULT_PROFILE);
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify({ name: "", photos: ["bad-url"], avatarIndex: 8, history: [{ id: 1, result: "unknown" }] }), setItem: () => {} });
    expect(loadProfile()).toEqual(DEFAULT_PROFILE);
  });
});
