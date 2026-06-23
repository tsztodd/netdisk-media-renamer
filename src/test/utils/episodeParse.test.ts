import { describe, it, expect } from "vitest";
import extractEpisode from "@/utils/episodeParse";

describe("extractEpisode", () => {
  it("纯数字文件名（最常见）", () => {
    expect(extractEpisode("12")).toBe(12);
    expect(extractEpisode("01")).toBe(1);
    expect(extractEpisode("100")).toBe(100);
  });

  it("显式集数标记优先", () => {
    expect(extractEpisode("E05")).toBe(5);
    expect(extractEpisode("EP12")).toBe(12);
    expect(extractEpisode("Show.Name.Episode 9.1080p")).toBe(9);
    expect(extractEpisode("第8集")).toBe(8);
    expect(extractEpisode("23话")).toBe(23);
  });

  it("排除疑似年份，取真正的集数", () => {
    expect(extractEpisode("Perfect.Crown.2026.12")).toBe(12);
    expect(extractEpisode("2008 Breaking Bad 03")).toBe(3);
  });

  it("无数字返回 undefined（调用方回退顺序）", () => {
    expect(extractEpisode("trailer")).toBeUndefined();
    expect(extractEpisode("")).toBeUndefined();
  });
});
