// TalkBack and VoiceOver announce what a control is from its role. Every tappable element in
// the screens needs one, unless it is deliberately hidden from screen readers.
describe("Tappable elements have a role", () => {
  const { readdirSync, readFileSync, statSync } = jest.requireActual<typeof import("fs")>("fs");
  const { join } = jest.requireActual<typeof import("path")>("path");

  const screens = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return screens(path);
      return name.endsWith(".tsx") ? [path] : [];
    });

  // The opening tag, skipping ">" inside braces and arrow functions.
  const openingTag = (source: string, start: number) => {
    let depth = 0;
    for (let i = start; i < source.length; i++) {
      const char = source[i];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0 && source[i - 1] !== "=") return source.slice(start, i + 1);
    }
    return source.slice(start);
  };

  it("every Pressable and TouchableOpacity", () => {
    const missing: string[] = [];
    for (const file of [...screens(join(__dirname, "../app")), ...screens(join(__dirname, "../components"))]) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<(Pressable|TouchableOpacity)\b/g)) {
        const tag = openingTag(source, match.index ?? 0);
        if (!/accessibilityRole|accessible=\{false\}|importantForAccessibility="no"/.test(tag)) {
          const line = source.slice(0, match.index).split("\n").length;
          missing.push(`${file.split("strayaid_mobile_frontend")[1]}:${line}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
