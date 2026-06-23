import { describe, it, expect } from "vitest";
import { toDotName, formatSeriesTitle } from "@/utils/tmdb";

describe("tmdb 命名格式化", () => {
  it("toDotName 空白转点、去非法字符、收敛连续点", () => {
    expect(toDotName("The Last of Us")).toBe("The.Last.of.Us");
    expect(toDotName("Mr. Robot")).toBe("Mr.Robot");
    expect(toDotName("Spider-Man: No Way Home")).toBe("Spider-Man.No.Way.Home");
    expect(toDotName("  多  空格  ")).toBe("多.空格");
  });

  it("formatSeriesTitle 拼接年份", () => {
    expect(formatSeriesTitle("The Last of Us", "2023-01-15")).toBe("The.Last.of.Us.2023");
    expect(formatSeriesTitle("Show", "")).toBe("Show");
    expect(formatSeriesTitle("Show", "bad-date")).toBe("Show");
  });

  it("可与季数/自动集数组合成标准命名前段", () => {
    const title = formatSeriesTitle("Breaking Bad", "2008-01-20");
    // 配合 season=1 autoEpisode 后即 Breaking.Bad.2008.S01E01
    expect(title).toBe("Breaking.Bad.2008");
  });
});
