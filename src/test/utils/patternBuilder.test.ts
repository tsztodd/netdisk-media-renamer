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

  it("removeTag 删除结尾集数：去掉误加的 .E01", () => {
    expect(
      applyBlock(
        "Married.S01E15.2024.2160p.WEB-DL.H265.DDP2.0.E01",
        block({ type: "removeTag", tag: "episodeTail" })
      )
    ).toBe("Married.S01E15.2024.2160p.WEB-DL.H265.DDP2.0");
  });

  it("removeTag 各预设删除常见发布标记，且不留连续分隔符", () => {
    expect(applyBlock("Show.2160p.x265", block({ type: "removeTag", tag: "resolution" }))).toBe(
      "Show.x265"
    );
    expect(applyBlock("Show.2024.1080p", block({ type: "removeTag", tag: "year" }))).toBe(
      "Show.1080p"
    );
    expect(applyBlock("Show.H265.WEB-DL", block({ type: "removeTag", tag: "source" }))).toBe(
      "Show.H265"
    );
    // 年份不会误伤 H265 / 2160p / DDP2.0
    expect(applyBlock("Show.H265.2160p.DDP2.0", block({ type: "removeTag", tag: "year" }))).toBe(
      "Show.H265.2160p.DDP2.0"
    );
  });

  it("moveText 把年份挪到剧名后", () => {
    expect(
      applyBlock(
        "Married.S01E15.2024.2160p.WEB-DL",
        block({ type: "moveText", text: "2024", moveTo: "afterTitle" })
      )
    ).toBe("Married.2024.S01E15.2160p.WEB-DL");
  });

  it("moveText 支持移到最前 / 最后；找不到则原样返回", () => {
    expect(
      applyBlock("a.b.YEAR.c", block({ type: "moveText", text: "YEAR", moveTo: "start" }))
    ).toBe("YEAR.a.b.c");
    expect(applyBlock("a.b.YEAR.c", block({ type: "moveText", text: "YEAR", moveTo: "end" }))).toBe(
      "a.b.c.YEAR"
    );
    expect(applyBlock("a.b.c", block({ type: "moveText", text: "ZZZ", moveTo: "start" }))).toBe(
      "a.b.c"
    );
  });

  it("误加自动集数后，一条管线还原成想要的命名", () => {
    // 去掉末尾 .E01 + 把 2024 挪到剧名后
    const run = compileBlocks([
      block({ id: "1", type: "removeTag", tag: "episodeTail" }),
      block({ id: "2", type: "moveText", text: "2024", moveTo: "afterTitle" }),
    ]);
    expect(run("Married.S01E15.2024.2160p.WEB-DL.H265.DDP2.0.E01")).toBe(
      "Married.2024.S01E15.2160p.WEB-DL.H265.DDP2.0"
    );
  });

  it("createBlock 新积木带合理默认参数", () => {
    expect(createBlock("removeTag").tag).toBe("resolution");
    expect(createBlock("moveText").moveTo).toBe("afterTitle");
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
