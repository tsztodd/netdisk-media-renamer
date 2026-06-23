import { describe, it, expect } from "vitest";
import { compileBlocks, applyBlock, createBlock } from "@/utils/patternBuilder";
import type { IPatternBlock } from "@/utils/patternBuilder";

const block = (b: Partial<IPatternBlock>): IPatternBlock => ({
  id: b.id || "x",
  type: b.type || "removeText",
  enabled: b.enabled !== false,
  ...b,
});

describe("patternBuilder", () => {
  it("removeText 删除所有字面量出现", () => {
    expect(applyBlock("[abc]剧名[abc]", block({ type: "removeText", text: "[abc]" }))).toBe("剧名");
  });

  it("replaceText 字面量查找替换（不受正则特殊字符影响）", () => {
    expect(applyBlock("a.b.c", block({ type: "replaceText", from: ".", to: "-" }))).toBe("a-b-c");
  });

  it("removeBrackets 删除各类括号及内容", () => {
    expect(
      applyBlock("[1080p]片名(2023)【国语】", block({ type: "removeBrackets", brackets: "all" }))
    ).toBe("片名");
  });

  it("padNumber 数字补零", () => {
    expect(applyBlock("第1集", block({ type: "padNumber", length: 2 }))).toBe("第01集");
    expect(applyBlock("EP7", block({ type: "padNumber", length: 3 }))).toBe("EP007");
  });

  it("prefix / suffix", () => {
    expect(applyBlock("name", block({ type: "prefix", text: "S01." }))).toBe("S01.name");
    expect(applyBlock("name", block({ type: "suffix", text: ".final" }))).toBe("name.final");
  });

  it("regex 高级正则，非法正则原样返回不抛错", () => {
    expect(applyBlock("ab12cd", block({ type: "regex", pattern: "\\d+", replace: "#" }))).toBe(
      "ab#cd"
    );
    expect(applyBlock("ab", block({ type: "regex", pattern: "(", replace: "x" }))).toBe("ab");
  });

  it("停用的积木被跳过", () => {
    expect(applyBlock("abc", block({ type: "removeText", text: "a", enabled: false }))).toBe("abc");
  });

  it("compileBlocks 按顺序串联整条管线", () => {
    const blocks: IPatternBlock[] = [
      block({ id: "1", type: "removeBrackets", brackets: "all" }),
      block({ id: "2", type: "replaceText", from: " ", to: "." }),
      block({ id: "3", type: "padNumber", length: 2 }),
      block({ id: "4", type: "prefix", text: "Show." }),
    ];
    const run = compileBlocks(blocks);
    expect(run("[HD] my show 5")).toBe("Show.my.show.05");
  });

  it("createBlock 带合理默认参数", () => {
    expect(createBlock("padNumber").length).toBe(2);
    expect(createBlock("removeBrackets").brackets).toBe("all");
    expect(createBlock("regex").flags).toBe("g");
  });
});
