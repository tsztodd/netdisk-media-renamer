<template>
  <div class="pattern-builder">
    <div class="pattern-builder-add">
      <select v-model="addType" class="pattern-builder-select" :disabled="disabled">
        <option v-for="opt in blockTypeOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <button class="pattern-builder-add-btn" :disabled="disabled" @click="onAdd">+ 添加积木</button>
      <span class="pattern-builder-hint">从左到右依次作用于文件名（不含扩展名）</span>
    </div>

    <div v-if="!blocks.length" class="pattern-builder-empty">
      还没有积木，点上面「添加积木」开始拼装，例如：删除括号内容 → 数字补零 → 加前缀。
    </div>

    <ul v-else class="pattern-builder-list">
      <li
        v-for="(block, index) in blocks"
        :key="block.id"
        class="pattern-builder-item"
        :class="{ 'is-disabled': !block.enabled }"
      >
        <div class="pattern-builder-item-head">
          <label class="pattern-builder-item-enable" title="启用/停用此积木">
            <input
              type="checkbox"
              :checked="block.enabled"
              :disabled="disabled"
              @change="onPatch(index, { enabled: !block.enabled })"
            />
          </label>
          <span class="pattern-builder-item-index">{{ index + 1 }}</span>
          <span class="pattern-builder-item-type">{{ labels[block.type] }}</span>
          <span class="pattern-builder-item-spacer"></span>
          <button
            class="pattern-builder-item-op"
            title="上移"
            :disabled="disabled || index === 0"
            @click="onMove(index, -1)"
          >
            <component-icon name="upArrow"></component-icon>
          </button>
          <button
            class="pattern-builder-item-op"
            title="下移"
            :disabled="disabled || index === blocks.length - 1"
            @click="onMove(index, 1)"
          >
            <component-icon name="downArrow"></component-icon>
          </button>
          <button
            class="pattern-builder-item-op delete"
            title="删除"
            :disabled="disabled"
            @click="onRemove(index)"
          >
            <component-icon name="times"></component-icon>
          </button>
        </div>

        <div class="pattern-builder-item-body">
          <template v-if="block.type === 'removeText'">
            <input
              class="pb-input"
              :value="block.text"
              :disabled="disabled"
              placeholder="要删除的文字"
              @input="onPatch(index, { text: ($event.target as HTMLInputElement).value })"
            />
          </template>

          <template v-else-if="block.type === 'replaceText'">
            <input
              class="pb-input"
              :value="block.from"
              :disabled="disabled"
              placeholder="查找"
              @input="onPatch(index, { from: ($event.target as HTMLInputElement).value })"
            />
            <span class="pb-arrow"><component-icon name="rightArrow"></component-icon></span>
            <input
              class="pb-input"
              :value="block.to"
              :disabled="disabled"
              placeholder="替换为"
              @input="onPatch(index, { to: ($event.target as HTMLInputElement).value })"
            />
          </template>

          <template v-else-if="block.type === 'removeBrackets'">
            <select
              class="pb-input"
              :value="block.brackets"
              :disabled="disabled"
              @change="onPatch(index, { brackets: ($event.target as HTMLSelectElement).value as any })"
            >
              <option v-for="(label, value) in bracketLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </template>

          <template v-else-if="block.type === 'removeTag'">
            <span class="pb-label">删除</span>
            <select
              class="pb-input"
              :value="block.tag"
              :disabled="disabled"
              @change="onPatch(index, { tag: ($event.target as HTMLSelectElement).value as any })"
            >
              <option v-for="(label, value) in removeTagLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </template>

          <template v-else-if="block.type === 'moveText'">
            <input
              class="pb-input"
              :value="block.text"
              :disabled="disabled"
              placeholder="要移动的文字，如 2024"
              @input="onPatch(index, { text: ($event.target as HTMLInputElement).value })"
            />
            <select
              class="pb-input"
              :value="block.moveTo"
              :disabled="disabled"
              @change="onPatch(index, { moveTo: ($event.target as HTMLSelectElement).value as any })"
            >
              <option v-for="(label, value) in moveToLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </template>

          <template v-else-if="block.type === 'padNumber'">
            <span class="pb-label">补到</span>
            <input
              class="pb-input pb-input-num"
              type="number"
              min="1"
              max="10"
              :value="block.length"
              :disabled="disabled"
              @input="onPatch(index, { length: Number(($event.target as HTMLInputElement).value) || 2 })"
            />
            <span class="pb-label">位</span>
            <span class="pb-label">偏移</span>
            <input
              class="pb-input pb-input-num"
              type="number"
              :value="getOffsetValue(index)"
              :disabled="disabled"
              placeholder="0"
              @input="onOffsetInput(index, ($event.target as HTMLInputElement).value)"
              @change="onOffsetCommit(index, ($event.target as HTMLInputElement).value)"
            />
            <span class="pb-label">（第1集</span>
            <component-icon name="rightArrow"></component-icon>
            <span class="pb-label">第01集）</span>
          </template>

          <template v-else-if="block.type === 'prefix' || block.type === 'suffix'">
            <input
              class="pb-input"
              :value="block.text"
              :disabled="disabled"
              :placeholder="block.type === 'prefix' ? '前缀文字' : '后缀文字'"
              @input="onPatch(index, { text: ($event.target as HTMLInputElement).value })"
            />
          </template>

          <template v-else-if="block.type === 'regex'">
            <input
              class="pb-input"
              :value="block.pattern"
              :disabled="disabled"
              placeholder="正则表达式，如 \\d+"
              @input="onPatch(index, { pattern: ($event.target as HTMLInputElement).value })"
            />
            <span class="pb-arrow"><component-icon name="rightArrow"></component-icon></span>
            <input
              class="pb-input"
              :value="block.replace"
              :disabled="disabled"
              placeholder="替换为（支持 $1）"
              @input="onPatch(index, { replace: ($event.target as HTMLInputElement).value })"
            />
            <input
              class="pb-input pb-input-flags"
              :value="block.flags"
              :disabled="disabled"
              placeholder="flags"
              title="正则标志，默认 g"
              @input="onPatch(index, { flags: ($event.target as HTMLInputElement).value })"
            />
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import type { Ref } from "vue";
import type { Provider } from "@/provider/interface";
import type { IPatternBlock, TPatternBlockType } from "@/utils/patternBuilder";

import { ref, inject, computed, defineComponent } from "vue";
import {
  createBlock,
  PATTERN_BLOCK_LABELS,
  BRACKET_LABELS,
  MOVE_TO_LABELS,
  REMOVE_TAG_LABELS,
} from "@/utils/patternBuilder";
import ComponentIcon from "@/components/Component/ComponentIcon.vue";

export default defineComponent({
  name: "PatternBuilder",
  components: {
    ComponentIcon,
  },
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    const providerRef = inject<Ref<Provider>>("providerRef");

    const blocks = computed<IPatternBlock[]>(() => providerRef?.value.replaceParams.blocks || []);

    const labels = PATTERN_BLOCK_LABELS;
    const bracketLabels = BRACKET_LABELS;
    const moveToLabels = MOVE_TO_LABELS;
    const removeTagLabels = REMOVE_TAG_LABELS;
    const blockTypeOptions = (
      Object.keys(PATTERN_BLOCK_LABELS) as TPatternBlockType[]
    ).map((value) => ({ value, label: PATTERN_BLOCK_LABELS[value] }));

    // 下拉选择的「待添加」积木类型
    const addType = ref<TPatternBlockType>("removeBrackets");

    // 所有修改都通过整体替换数组来触发 ReplaceParams.blocks 的 setter（含防抖重算）
    const commit = (next: IPatternBlock[]) => {
      if (providerRef?.value) {
        providerRef.value.replaceParams.blocks = next;
      }
    };

    // 偏移输入的中间值缓存（每个积木独立），避免 @input 提交中间态被覆盖为 0
    const offsetDraft = ref<Record<number, string>>({});
    const getOffsetValue = (index: number): string => {
      if (offsetDraft.value[index] !== undefined) {
        return offsetDraft.value[index];
      }
      return String(blocks.value[index]?.offset ?? 0);
    };
    const onOffsetInput = (index: number, raw: string) => {
      // 仅缓存显示值，不提交，让用户打完负号
      offsetDraft.value = { ...offsetDraft.value, [index]: raw };
    };
    const onOffsetCommit = (index: number, raw: string) => {
      const n = parseInt(raw, 10);
      const offset = isFinite(n) ? n : 0;
      // 清除草稿，让值回归 block
      const draft = { ...offsetDraft.value };
      delete draft[index];
      offsetDraft.value = draft;
      onPatch(index, { offset });
    };

    const onAdd = () => {
      commit([...blocks.value, createBlock(addType.value)]);
    };
    const onRemove = (index: number) => {
      commit(blocks.value.filter((_, i) => i !== index));
    };
    const onPatch = (index: number, patch: Partial<IPatternBlock>) => {
      commit(blocks.value.map((b, i) => (i === index ? { ...b, ...patch } : b)));
    };
    const onMove = (index: number, dir: -1 | 1) => {
      const target = index + dir;
      if (target < 0 || target >= blocks.value.length) {
        return;
      }
      const next = [...blocks.value];
      [next[index], next[target]] = [next[target], next[index]];
      commit(next);
    };

    return {
      blocks,
      labels,
      bracketLabels,
      moveToLabels,
      removeTagLabels,
      blockTypeOptions,
      addType,
      getOffsetValue,
      onOffsetInput,
      onOffsetCommit,
      onAdd,
      onRemove,
      onPatch,
      onMove,
    };
  },
});
</script>

<style scoped>
.pattern-builder {
  display: flex;
  flex-direction: column;
  gap: calc(var(--cdp-gutter) / 2);
}
.pattern-builder-add {
  display: flex;
  align-items: center;
  gap: calc(var(--cdp-gutter) / 2);
  flex-wrap: wrap;
}
.pattern-builder-select,
.pb-input {
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--cdp-color-gray-300);
  border-radius: 6px;
  font-size: var(--cdp-font-size-sm);
  background-color: var(--cdp-color-white);
  color: var(--cdp-color-gray-900);
  box-sizing: border-box;
}
.pattern-builder-add-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--cdp-color-blue);
  color: var(--cdp-color-blue);
  background-color: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: var(--cdp-font-size-sm);
}
.pattern-builder-add-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.pattern-builder-hint,
.pattern-builder-empty {
  font-size: var(--cdp-font-size-xs);
  color: var(--cdp-color-gray-500);
}
.pattern-builder-empty {
  padding: calc(var(--cdp-gutter) / 2) 0;
}
.pattern-builder-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: calc(var(--cdp-gutter) / 2);
  max-height: 30vh;
  overflow: auto;
}
.pattern-builder-item {
  border: 1px solid var(--cdp-color-gray-200);
  border-radius: 8px;
  padding: 6px 8px;
  background-color: var(--cdp-color-gray-50);
}
.pattern-builder-item.is-disabled {
  opacity: 0.55;
}
.pattern-builder-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pattern-builder-item-enable {
  display: flex;
  align-items: center;
  cursor: pointer;
}
.pattern-builder-item-index {
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 50%;
  font-size: var(--cdp-font-size-xs);
  background-color: var(--cdp-color-blue);
  color: var(--cdp-color-white);
}
.pattern-builder-item-type {
  font-size: var(--cdp-font-size-sm);
  font-weight: 600;
  color: var(--cdp-color-gray-900);
}
.pattern-builder-item-spacer {
  flex: 1;
}
.pattern-builder-item-op {
  width: 24px;
  height: 24px;
  border: 1px solid var(--cdp-color-gray-300);
  background-color: var(--cdp-color-white);
  border-radius: 6px;
  cursor: pointer;
  color: var(--cdp-color-gray-700);
  font-size: var(--cdp-font-size-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}
.pattern-builder-item-op:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.pattern-builder-item-op.delete {
  color: var(--cdp-color-red);
  border-color: var(--cdp-color-red-200);
}
.pattern-builder-item-body {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.pb-input {
  flex: 1;
  min-width: 80px;
}
.pb-input-num {
  flex: 0 0 60px;
  min-width: 60px;
}
.pb-input-flags {
  flex: 0 0 60px;
  min-width: 50px;
}
.pb-arrow,
.pb-label {
  font-size: var(--cdp-font-size-sm);
  color: var(--cdp-color-gray-600);
  white-space: nowrap;
}
</style>
