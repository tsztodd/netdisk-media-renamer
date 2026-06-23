import { describe, it, expect } from "vitest";
import simpleDiff from "@/utils/simpleDiff";

// 还原属性：过滤 added 拼接 === 旧名；过滤 removed 拼接 === 新名
const reconstruct = (oldStr: string, newStr: string) => {
  const diff = simpleDiff(oldStr, newStr);
  const oldBack = diff
    .filter((c) => !c.added)
    .map((c) => c.value)
    .join("");
  const newBack = diff
    .filter((c) => !c.removed)
    .map((c) => c.value)
    .join("");
  return { oldBack, newBack };
};

describe("simpleDiff", () => {
  it("空与相等输入", () => {
    expect(simpleDiff("", "")).toEqual([]);
    expect(simpleDiff("abc", "abc")).toEqual([{ value: "abc", added: false, removed: false }]);
  });

  it("还原属性对各种用例都成立", () => {
    const cases: [string, string][] = [
      ["第01集.mp4", "剧名.S01E01.mp4"],
      ["abc.mp4", "abcd.mp4"],
      ["abcd.mp4", "abc.mp4"],
      ["", "新增内容"],
      ["要删除内容", ""],
      ["前缀中间后缀", "前缀替换后缀"],
      ["完全不同AAA", "毫不相干BBB"],
      ["a", "b"],
    ];
    for (const [o, n] of cases) {
      const { oldBack, newBack } = reconstruct(o, n);
      expect(oldBack).toBe(o);
      expect(newBack).toBe(n);
    }
  });

  it("公共前后缀被识别为未变更段", () => {
    const diff = simpleDiff("前缀ABC后缀", "前缀XY后缀");
    expect(diff).toEqual([
      { value: "前缀", added: false, removed: false },
      { value: "ABC", added: false, removed: true },
      { value: "XY", added: true, removed: false },
      { value: "后缀", added: false, removed: false },
    ]);
  });
});
