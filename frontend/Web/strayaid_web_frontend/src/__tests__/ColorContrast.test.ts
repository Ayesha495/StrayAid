/** WCAG AA colour contrast, checked straight from the stylesheets (jsdom can't render colour). */
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "..");
const AA_TEXT = 4.5;

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

const CSS = cssFiles(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));

const TOKENS: Record<string, string> = {};
for (const { text } of CSS) {
  for (const block of text.match(/:root\s*\{[^}]*\}/g) ?? []) {
    for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) TOKENS[name] ??= value.trim();
  }
}

function resolve(value: string, depth = 0): string {
  const match = value.match(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/);
  if (!match || depth > 5) return value;
  return resolve(TOKENS[match[1]] ?? match[2] ?? value, depth + 1);
}

function toRgb(color: string): [number, number, number] | null {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (!hex) return null;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]) {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(foreground: string, background: string) {
  const a = toRgb(resolve(foreground));
  const b = toRgb(resolve(background));
  if (!a || !b) throw new Error(`Can't read ${foreground} / ${background}`);
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("Colour contrast (WCAG AA)", () => {
  it.each([
    ["body text", "var(--color-ink)", "var(--color-canvas)"],
    ["muted text", "var(--color-ink-muted)", "var(--color-canvas)"],
    ["subtle text", "var(--color-ink-subtle)", "var(--color-canvas)"],
    ["links and green text", "var(--color-primary)", "var(--color-canvas)"],
    ["primary buttons", "#ffffff", "var(--color-primary)"],
    ["primary buttons on hover", "#ffffff", "var(--color-primary-hover)"],
    ["danger buttons", "#ffffff", "var(--color-danger)"],
    ["danger text", "var(--color-danger-ink)", "var(--color-canvas)"],
    ["danger messages", "var(--color-danger-ink)", "var(--color-danger-soft)"],
    ["success messages", "var(--green-800)", "var(--color-primary-soft)"],
  ])("%s", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("no mid-grey text that is too faint on a white page", () => {
    const failures: string[] = [];
    for (const { path, text } of CSS) {
      for (const rule of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const selector = rule[1].trim();
        // Icons only need 3:1 and sit next to labelled text; dark panels use light text on purpose.
        if (/svg|icon|::placeholder|:root|dark|sidebar|hero|final|footer|photo|overlay|on-dark/i.test(selector)) continue;
        for (const [, value] of rule[2].matchAll(/(?:^|;)\s*color\s*:\s*([^;!]+)/g)) {
          const rgb = toRgb(resolve(value.trim()));
          if (!rgb) continue;
          const lum = luminance(rgb);
          // Light colours (white, pale tints) are only ever used on dark or coloured surfaces.
          if (lum > 0.45) continue;
          const ratio = contrast(value.trim(), "#ffffff");
          if (ratio < AA_TEXT) failures.push(`${path.replace(SRC, "src")}: ${selector} → ${value.trim()} (${ratio.toFixed(2)}:1)`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
