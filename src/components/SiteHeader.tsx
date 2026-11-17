import { Compass, Moon, Plus, Sun, UserRound } from "lucide-react";
import type { LocalProfile } from "../profile";

interface Props {
  theme: "light" | "dark";
  profile: LocalProfile;
  onThemeChange: () => void;
  onHome: () => void;
  onCreate: () => void;
  onProfile: () => void;
}

export function SiteHeader({ theme, profile, onThemeChange, onHome, onCreate, onProfile }: Props) {
  const avatar = profile.photos[profile.avatarIndex];
  return <nav className="site-header" aria-label="Main navigation">
    <button type="button" className="site-brand" onClick={onHome}><Compass size={23} strokeWidth={2.3} /><span>Frontier</span></button>
    <div className="site-nav"><button type="button" onClick={onHome}>Home</button><button type="button" onClick={onCreate}><Plus size={15} /> Create match</button></div>
    <div className="site-actions">
      <button type="button" className="icon-button" onClick={onThemeChange} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title={theme === "dark" ? "Light theme" : "Dark theme"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
      <button type="button" className="profile-trigger" onClick={onProfile} aria-label={`Open ${profile.name}'s profile`}>{avatar ? <img src={avatar} alt="" /> : <span className="avatar-fallback"><UserRound size={18} /></span>}<span>{profile.name}</span></button>
    </div>
  </nav>;
}
