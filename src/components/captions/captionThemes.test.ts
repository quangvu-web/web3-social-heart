import { describe, expect, test } from "bun:test";
import { CAPTION_THEMES, readCaptionTheme, saveCaptionTheme } from "./captionThemes";
import { readFileSync } from "node:fs";

describe("caption theme device preference", () => {
  test("first visit and invalid saved values use dark", () => {
    for (const value of [null, "", "system", "unknown", "__proto__"]) {
      expect(readCaptionTheme({ getItem: () => value })).toBe("dark");
    }
  });
  test("all six choices persist across session/page readers on the same device", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(CAPTION_THEMES.map(t => t.label)).toEqual(["Tối", "Sáng", "Giấy ấm", "Trung tính", "Năng lượng", "Tương phản cao"]);
    for (const { value } of CAPTION_THEMES) {
      saveCaptionTheme(value, storage);
      expect(values.get("caption-theme")).toBe(value);
      expect(readCaptionTheme(storage)).toBe(value);
      expect(readCaptionTheme(storage)).toBe(value);
    }
  });
  test("blocked storage cannot break caption reading or a selection", () => {
    const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); } };
    expect(readCaptionTheme(storage)).toBe("dark");
    expect(() => saveCaptionTheme("light", storage)).not.toThrow();
  });
});

test("every palette keeps caption, translation, speaker and selected controls at readable contrast", () => {
  const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
  const luminance = (hsl: string) => {
    const [hue, saturation, lightness] = hsl.replaceAll("%", "").split(/\s+/).map(Number);
    const s = saturation / 100, l = lightness / 100;
    const a = s * Math.min(l, 1 - l);
    const rgb = [0, 8, 4].map(n => {
      const k = (n + hue / 30) % 12;
      const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const ratio = (a: string, b: string) => {
    const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
    return (high + 0.05) / (low + 0.05);
  };
  for (const { value } of CAPTION_THEMES) {
    const body = css.match(new RegExp(`\\[data-caption-theme="${value}"\\] \\{([^}]+)\\}`))?.[1];
    expect(body).toBeDefined();
    const tokens = Object.fromEntries([...body!.matchAll(/--caption-([\w-]+): ([^;]+);/g)].map(m => [m[1], m[2]]));
    for (const text of ["foreground", "muted", "speaker", "live"]) {
      expect(ratio(tokens[text], tokens.background)).toBeGreaterThanOrEqual(4.5);
    }
    for (const background of ["control", "control-hover"]) {
      expect(ratio(tokens["control-foreground"], tokens[background])).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(tokens["selected-foreground"], tokens.selected)).toBeGreaterThanOrEqual(4.5);
    if (value === "high-contrast") {
      expect(luminance(tokens.background)).toBe(0);
      expect(luminance(tokens.foreground)).toBe(1);
      expect(luminance(tokens["control-border"])).toBe(1);
    }
  }
});
