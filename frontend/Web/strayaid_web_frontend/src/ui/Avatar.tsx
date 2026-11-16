import { useState } from "react";
import { initialsOf } from "../utils/format";

type AvatarProps = {
  name?: string | null;
  src?: string | null;
  size?: number;
  square?: boolean;
};

function Avatar({ name, src, size = 36, square = false }: AvatarProps) {
  // A picture that fails to load (deleted or moved file) falls back to initials, not a broken-image icon.
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = Boolean(src) && failed !== src;
  return (
    <span
      className={`avatar${square ? " avatar-square" : ""}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      aria-hidden={showImage ? undefined : true}
    >
      {showImage ? <img src={src ?? undefined} alt={name ?? ""} onError={() => setFailed(src ?? null)} /> : initialsOf(name)}
    </span>
  );
}

export default Avatar;
