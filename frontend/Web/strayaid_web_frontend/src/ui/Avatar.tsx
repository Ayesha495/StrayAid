import { initialsOf } from "../utils/format";

type AvatarProps = {
  name?: string | null;
  src?: string | null;
  size?: number;
  square?: boolean;
};

function Avatar({ name, src, size = 36, square = false }: AvatarProps) {
  return (
    <span
      className={`avatar${square ? " avatar-square" : ""}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      aria-hidden={src ? undefined : true}
    >
      {src ? <img src={src} alt={name ?? ""} /> : initialsOf(name)}
    </span>
  );
}

export default Avatar;
