import { chipStyle, type ChipKind } from "../utils/statusStyles";

function StatusChip({ kind, value }: { kind: ChipKind; value: string | null | undefined }) {
  if (!value) return null;
  const style = chipStyle(kind, value);
  return <span className={`chip ${style.className}`}>{style.label}</span>;
}

export default StatusChip;
