export function formatRelativeTime(dateString: string): string {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) {
    return "";
  }

  const diffMs = Date.now() - then;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Date(dateString).toLocaleDateString();
}

export function minutesSince(dateString: string): number {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) {
    return 0;
  }
  return Math.max(0, Math.round((Date.now() - then) / 60000));
}
