/**
 * 「正则积木」编译器。
 *
 * 面向不懂正则的用户：把一组可视化「积木」按顺序编译成一个
 * `(fileName: string) => string` 的转换管线，作用于不含扩展名的文件名。
 * 同时保留一个「高级正则」积木，懂正则的用户可直接使用。
 *
 * 每个积木相互独立、可启用/停用、可调整顺序；单个积木出错（例如非法正则）
 * 不会影响其它积木，只是原样返回该步输入。
 */

export type TPatternBlockType =
  | "removeText" // 删除文字
  | "replaceText" // 查找替换
  | "removeBrackets" // 删除括号及其内容
  | "padNumber" // 数字补零（第1集 → 第01集）
  | "prefix" // 加前缀
  | "suffix" // 加后缀
  | "regex"; // 高级正则

export type TBracketKind = "square" | "round" | "curly" | "cn" | "all";

export interface IPatternBlock {
  id: string;
  type: TPatternBlockType;
  enabled: boolean;
  // 各类型用到的参数（按需取用，保持松散）
  text?: string; // removeText / prefix / suffix
  from?: string; // replaceText
  to?: string; // replaceText
  brackets?: TBracketKind; // removeBrackets
  length?: number; // padNumber
  pattern?: string; // regex
  flags?: string; // regex
  replace?: string; // regex
}

export const PATTERN_BLOCK_LABELS: Record<TPatternBlockType, string> = {
  removeText: "删除文字",
  replaceText: "查找替换",
  removeBrackets: "删除括号内容",
  padNumber: "数字补零",
  prefix: "加前缀",
  suffix: "加后缀",
  regex: "高级正则",
};

export const BRACKET_LABELS: Record<TBracketKind, string> = {
  square: "[ 方括号 ]",
  round: "( 圆括号 )",
  curly: "{ 花括号 }",
  cn: "【 中文括号 】",
  all: "全部括号",
};

const BRACKET_REGEXPS: Record<TBracketKind, RegExp[]> = {
  square: [/\[[^\]]*\]/g],
  round: [/\([^)]*\)/g],
  curly: [/\{[^}]*\}/g],
  cn: [/【[^】]*】/g, /（[^）]*）/g],
  all: [/\[[^\]]*\]/g, /\([^)]*\)/g, /\{[^}]*\}/g, /【[^】]*】/g, /（[^）]*）/g],
};

// 字面量全局替换（不走正则，避免特殊字符问题）
const replaceAllLiteral = (input: string, search: string, replace: string): string => {
  if (!search) {
    return input;
  }
  return input.split(search).join(replace);
};

export const applyBlock = (input: string, block: IPatternBlock): string => {
  if (!block.enabled) {
    return input;
  }
  try {
    switch (block.type) {
      case "removeText":
        return block.text ? replaceAllLiteral(input, block.text, "") : input;
      case "replaceText":
        return block.from ? replaceAllLiteral(input, block.from, block.to || "") : input;
      case "removeBrackets": {
        const kind = block.brackets || "all";
        let out = input;
        BRACKET_REGEXPS[kind].forEach((re) => {
          out = out.replace(re, "");
        });
        // 删除括号后常残留多余空格，收敛并去除首尾空白，避免出现 “..” 这类结果
        return out.replace(/\s{2,}/g, " ").trim();
      }
      case "padNumber": {
        const length = Math.max(1, Math.min(10, block.length || 2));
        return input.replace(/\d+/g, (digits) => digits.padStart(length, "0"));
      }
      case "prefix":
        return (block.text || "") + input;
      case "suffix":
        return input + (block.text || "");
      case "regex": {
        if (!block.pattern) {
          return input;
        }
        const flags = block.flags && /^[gimsuy]*$/.test(block.flags) ? block.flags : "g";
        const re = new RegExp(block.pattern, flags);
        return input.replace(re, block.replace || "");
      }
      default:
        return input;
    }
  } catch {
    // 单个积木出错（如非法正则）不影响整体，原样返回
    return input;
  }
};

export const compileBlocks = (blocks: IPatternBlock[]): ((fileName: string) => string) => {
  const list = Array.isArray(blocks) ? blocks : [];
  return (fileName: string) => list.reduce((acc, block) => applyBlock(acc, block), fileName);
};

// 工厂：创建一个带默认参数的新积木
let _seed = 0;
export const createBlock = (type: TPatternBlockType): IPatternBlock => {
  _seed += 1;
  const base: IPatternBlock = { id: `block-${_seed}`, type, enabled: true };
  switch (type) {
    case "removeBrackets":
      return { ...base, brackets: "all" };
    case "padNumber":
      return { ...base, length: 2 };
    case "regex":
      return { ...base, pattern: "", flags: "g", replace: "" };
    default:
      return base;
  }
};

export default compileBlocks;
