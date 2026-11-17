import { Camera, Check, ImagePlus, Trash2, Trophy, UserRound, X } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import type { LocalProfile } from "../profile";

interface Props { profile: LocalProfile; onChange: (profile: LocalProfile) => void; onClose: () => void; }

async function resizePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Each photo must be smaller than 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 320;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this photo.");
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 320, 320);
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally { bitmap.close(); }
}

export function ProfilePanel({ profile, onChange, onClose }: Props) {
  const [error, setError] = useState("");
  const avatar = profile.photos[profile.avatarIndex];

  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 4 - profile.photos.length);
    event.target.value = "";
    if (!files.length) return;
    try {
      const photos = await Promise.all(files.map(resizePhoto));
      onChange({ ...profile, photos: [...profile.photos, ...photos] });
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add the photo."); }
  }

  function removePhoto(index: number) {
    const photos = profile.photos.filter((_, photoIndex) => photoIndex !== index);
    onChange({ ...profile, photos, avatarIndex: photos.length ? Math.min(profile.avatarIndex > index ? profile.avatarIndex - 1 : profile.avatarIndex, photos.length - 1) : 0 });
  }

  const wins = profile.history.filter((match) => match.result === "win").length;
  return <section className="profile-page">
    <div className="section-title"><div><p className="eyebrow">YOUR SPACE</p><h1>Player profile</h1><p>Make this commander yours. Photos and results are saved in this browser.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close profile"><X size={18} /></button></div>
    <div className="profile-grid">
      <div className="profile-card profile-identity"><div className="profile-avatar">{avatar ? <img src={avatar} alt="Current avatar" /> : <UserRound size={54} />}</div><label htmlFor="profile-name">Display name</label><input id="profile-name" maxLength={28} value={profile.name} onChange={(event) => onChange({ ...profile, name: event.target.value })} onBlur={() => { if (!profile.name.trim()) onChange({ ...profile, name: "Commander" }); }} /><small>Visible locally during your matches.</small><div className="profile-stats"><div><Trophy size={17} /><strong>{wins}</strong><span>Wins</span></div><div><Camera size={17} /><strong>{profile.photos.length}</strong><span>Photos</span></div></div></div>
      <div className="profile-card profile-gallery"><div className="card-heading"><div><p className="eyebrow">PHOTO GALLERY</p><h2>Choose your look</h2></div><span>{profile.photos.length}/4</span></div><p>Add up to four photos. Choose one as your avatar in the header.</p><div className="photo-grid">{profile.photos.map((photo, index) => <div className="photo-tile" key={`${index}-${photo.length}`}><img src={photo} alt={`Profile photo ${index + 1}`} /><div><button type="button" onClick={() => onChange({ ...profile, avatarIndex: index })} aria-label={`Use photo ${index + 1} as avatar`} title="Use as avatar">{profile.avatarIndex === index ? <Check size={16} /> : <UserRound size={16} />}</button><button type="button" onClick={() => removePhoto(index)} aria-label={`Remove photo ${index + 1}`} title="Remove photo"><Trash2 size={16} /></button></div></div>)}{profile.photos.length < 4 && <label className="photo-add"><ImagePlus size={26} /><span>Add photos</span><input type="file" accept="image/*" multiple onChange={addPhotos} /></label>}</div>{error && <p className="form-error" role="alert">{error}</p>}</div>
    </div>
    <section className="profile-card profile-history"><div className="card-heading"><div><p className="eyebrow">LOCAL HISTORY</p><h2>Recent matches</h2></div><span>{profile.history.length} played</span></div>{profile.history.length ? <ul>{profile.history.map((match) => <li key={match.id}><span className={`result-tag ${match.result}`}>{match.result}</span><strong>{match.map}</strong><span>{Math.floor(match.seconds / 60)}m {match.seconds % 60}s</span><time dateTime={match.playedAt}>{new Date(match.playedAt).toLocaleDateString()}</time></li>)}</ul> : <p>Your first player match will appear here. Demo matches do not affect your history.</p>}</section>
  </section>;
}
