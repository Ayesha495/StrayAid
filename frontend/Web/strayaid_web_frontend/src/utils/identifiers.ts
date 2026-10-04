function padId(id: number): string {
  return String(id).padStart(2, "0");
}

export function caseLabel(id: number): string {
  return `Case # ${padId(id)}`;
}

export function animalLabel(id: number): string {
  return `Animal # ${padId(id)}`;
}
