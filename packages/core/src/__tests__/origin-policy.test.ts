import { describe, expect, test } from "bun:test";
import { isToolVisibleToCaller } from "../origin-policy";

describe("isToolVisibleToCaller", () => {
  const host = "https://host.example";
  const embed = "https://embed.example";

  test("same-origin is visible by default unless excluded by fromOrigins", () => {
    expect(isToolVisibleToCaller(host, host, [])).toBe(true);
    expect(isToolVisibleToCaller(host, host, [], [embed])).toBe(false);
    expect(isToolVisibleToCaller(host, host, [], [host])).toBe(true);
  });

  test("cross-origin requires two-sided opt-in", () => {
    expect(isToolVisibleToCaller(host, embed, [])).toBe(false);
    expect(isToolVisibleToCaller(host, embed, [host])).toBe(false);
    expect(isToolVisibleToCaller(host, embed, [], [embed])).toBe(false);
    expect(isToolVisibleToCaller(host, embed, [host], [embed])).toBe(true);
    expect(isToolVisibleToCaller(host, embed, ["*"], ["*"])).toBe(true);
  });
});
