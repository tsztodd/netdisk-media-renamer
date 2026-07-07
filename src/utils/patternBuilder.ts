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
  | "removeTag" // 删除标记（画质/编码/来源/音轨/年份/结尾集数等预设）
  | "moveText" // 移动文字（把某段文字挪到 最前/剧名后/最后）
  | "padNumber" // 数字补零（第1集 → 第01集）
  | "prefix" // 加前缀
  | "suffix" // 加后缀
  | "regex"; // 高级正则

export type TBracketKind = "square" | "round" | "curly" | "cn" | "all";

// 「移动文字」的目标位置
export type TMoveTo = "start" | "afterTitle" | "end";

// 「删除标记」的预设种类——面向影视文件名里常见的发布标记
export type TRemoveTag =
  | "resolution" // 画质：1080p / 2160p ...
  | "codec" // 编码：H265 / x264 ...
  | "source" // 来源：WEB-DL / BluRay ...
  | "audio" // 音轨：DDP2.0 / DTS ...
  | "year" // 年份：2024
  | "episodeTail"; // 结尾集数：末尾多出来的 .E01

export interface IPatternBlock {
  id: string;
  type: TPatternBlockType;
  enabled: boolean;
  // 各类型用到的参数（按需取用，保持松散）
  text?: string; // removeText / prefix / suffix / moveText
  from?: string; // replaceText
  to?: string; // replaceText
  brackets?: TBracketKind; // removeBrackets
  tag?: TRemoveTag; // removeTag
  moveTo?: TMoveTo; // moveText
  length?: number; // padNumber
  offset?: number; // padNumber：数字偏移（补零后对每个数字加此值，可为负数）
  pattern?: string; // regex
  flags?: string; // regex
  replace?: string; // regex
}

export const PATTERN_BLOCK_LABELS: Record<TPatternBlockType, string> = {
  removeText: "删除文字",
  replaceText: "查找替换",
  removeBrackets: "删除括号内容",
  removeTag: "删除标记",
  moveText: "移动文字",
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

export const MOVE_TO_LABELS: Record<TMoveTo, string> = {
  start: "移到最前",
  afterTitle: "移到剧名后",
  end: "移到最后",
};

export const REMOVE_TAG_LABELS: Record<TRemoveTag, string> = {
  resolution: "画质 (1080p/2160p)",
  codec: "编码 (H265/x264)",
  source: "来源 (WEB-DL/BluRay)",
  audio: "音轨 (DDP2.0/DTS)",
  year: "年份 (2024)",
  episodeTail: "结尾集数 (.E01)",
};

// 每个预设对应的匹配规则。前置 [.\s_]? 把紧邻的一个分隔符一起带走，避免删完留下「..」。
const REMOVE_TAG_REGEXPS: Record<TRemoveTag, RegExp[]> = {
  resolution: [/[.\s_]?\b(480p|576p|720p|1080p|1440p|2160p|4k|8k|uhd)\b/gi],
  codec: [/[.\s_]?\b(x264|x265|h\.?264|h\.?265|hevc|avc|av1)\b/gi],
  source: [/[.\s_]?\b(web-?dl|web-?rip|blu-?ray|bd-?rip|hd-?tv|dvd-?rip|hd-?rip|remux)\b/gi],
  audio: [/[.\s_]?\b(ddp?5\.1|ddp?2\.0|ddp|dd\+?|e?ac-?3|aac|dts(?:-hd)?|truehd|atmos|flac|2\.0|5\.1|7\.1)\b/gi],
  year: [/[.\s_]?\b(?:19|20)\d{2}\b/g],
  episodeTail: [/[.\s_]E\d{1,3}$/gi],
};

// 猜测文件名使用的分隔符：取出现次数最多的那个，默认用「.」
const detectSeparator = (input: string): string => {
  let best = ".";
  let bestCount = 0;
  for (const sep of [".", "_", " "]) {
    const count = input.split(sep).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = sep;
    }
  }
  return best;
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
      case "removeTag": {
        const tag = block.tag || "resolution";
        let out = input;
        (REMOVE_TAG_REGEXPS[tag] || []).forEach((re) => {
          out = out.replace(re, "");
        });
        // 删完可能留下连续分隔符或首尾残留，收敛一下
        return out
          .replace(/\.{2,}/g, ".")
          .replace(/_{2,}/g, "_")
          .replace(/\s{2,}/g, " ")
          .replace(/^[.\s_-]+|[.\s_-]+$/g, "")
          .trim();
      }
      case "moveText": {
        const text = (block.text || "").trim();
        if (!text || !input.includes(text)) {
          return input;
        }
        const sep = detectSeparator(input);
        // 先把要移动的文字抠出来：优先按「整段」匹配（如分隔符之间的 2024），
        // 整段取不到再退化为去掉第一处出现的子串。
        const tokens = input.split(sep);
        const tokenIndex = tokens.indexOf(text);
        let rest: string;
        if (tokenIndex !== -1) {
          tokens.splice(tokenIndex, 1);
          rest = tokens.join(sep);
        } else {
          rest = input.replace(text, "");
        }
        // split + 过滤空串，顺便把抠完残留的连续分隔符吃掉
        const parts = rest.split(sep).filter((t) => t !== "");
        const moveTo = block.moveTo || "afterTitle";
        if (moveTo === "start") {
          parts.unshift(text);
        } else if (moveTo === "end") {
          parts.push(text);
        } else {
          // 剧名后 = 第一段（剧名）之后
          parts.splice(Math.min(1, parts.length), 0, text);
        }
        return parts.join(sep);
      }
      case "padNumber": {
        const length = Math.max(1, Math.min(10, block.length || 2));
        const offset = isFinite(block.offset as number) ? (block.offset as number) : 0;
        return input.replace(/\d+/g, (digits) => {
          const num = parseInt(digits, 10);
          const shifted = num + offset;
          if (shifted < 0) {
            // 负数直接保留原数字（偏移不应产生负数集数）
            return digits.padStart(length, "0");
          }
          return String(shifted).padStart(length, "0");
        });
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
    case "removeTag":
      return { ...base, tag: "resolution" };
    case "moveText":
      return { ...base, text: "", moveTo: "afterTitle" };
    case "padNumber":
      return { ...base, length: 2, offset: 0 };
    case "regex":
      return { ...base, pattern: "", flags: "g", replace: "" };
    default:
      return base;
  }
};

export default compileBlocks;
