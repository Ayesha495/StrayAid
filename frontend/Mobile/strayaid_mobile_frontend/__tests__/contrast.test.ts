import { colors } from "../theme/tokens";

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const channel = (s: number) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

// WCAG AA: 4.5:1 for normal text.
describe("Colour contrast (WCAG AA)", () => {
  it.each([
    ["headings and body text", colors.ink, colors.surface],
    ["headings on the screen background", colors.ink, colors.canvas],
    ["supporting text", colors.inkMuted, colors.surface],
    ["supporting text on the screen background", colors.inkMuted, colors.canvas],
    ["text on green buttons", colors.onPrimary, colors.primary],
    ["green links", colors.primary, colors.surface],
    ["destructive text", colors.criticalInk, colors.surface],
    ["error messages", colors.criticalInk, colors.criticalSoft],
  ])("%s", (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Text colours in the screens", () => {
  const { readdirSync, readFileSync, statSync } = jest.requireActual<typeof import("fs")>("fs");
  const { join } = jest.requireActual<typeof import("path")>("path");

  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.tsx?$/.test(name) ? [path] : [];
    });

  it("no text colour is too faint to read on white", () => {
    const failures: string[] = [];
    for (const file of [...sourceFiles(join(__dirname, "../app")), ...sourceFiles(join(__dirname, "../components"))]) {
      for (const [, hex] of readFileSync(file, "utf8").matchAll(/(?<![a-zA-Z])color:\s*"(#[0-9A-Fa-f]{6})"/g)) {
        // Pale colours are only used on dark or coloured surfaces (photos, buttons, splash).
        if (luminance(hex) > 0.45) continue;
        if (contrast(hex, "#FFFFFF") < 4.5) failures.push(`${file.split("strayaid_mobile_frontend")[1]}: ${hex}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
