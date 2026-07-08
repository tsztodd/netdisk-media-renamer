<template>
  <div v-if="providerRef" class="rename-preview">
    <div class="rename-preview-status">
      <span
        v-for="item in providerRef.statusList"
        :key="item.icon && item.title ? item.icon + item.title : item.message"
        class="rename-preview-status-item"
        :class="item.className"
        :title="item.title"
      >
        <component-icon
          v-if="item.icon"
          :name="item.icon"
          fill="currentColor"
          class="rename-preview-status-item-icon"
        ></component-icon>
        {{ item.message }}
      </span>
    </div>
    <div ref="scrollRef" class="rename-preview-content" @scroll="onScroll" @mousedown="onMouseDown">
      <div
        v-if="boxSelect.active"
        class="rename-preview-box-select"
        :style="boxSelectRectStyle"
      ></div>
      <table class="rename-preview-content-table">
        <thead class="rename-preview-content-table-header">
          <tr
            class="rename-preview-content-table-item"
            :class="{
              'is-error': providerRef.hasError,
              'is-change': providerRef.hasChange,
              'is-checked': !providerRef.hasUncheckedAll,
            }"
          >
            <th class="rename-preview-content-table-item-checkbox">
              <component-checkbox
                :model-value="providerRef.hasCheckedAll"
                :indeterminate="!providerRef.hasCheckedAll && !providerRef.hasUncheckedAll"
                @update:model-value="onCheckedAllUpdate"
              ></component-checkbox>
            </th>
            <th class="rename-preview-content-table-item-index">
              <span
                class="rename-preview-content-table-item-index-reset-sort"
                title="重置排序"
                @click="onResetSort"
              >
                <component-icon
                  name="dCaret"
                  class="rename-preview-content-table-item-index-reset-sort-static"
                ></component-icon>
                <component-icon
                  name="sort"
                  class="rename-preview-content-table-item-index-reset-sort-hover"
                ></component-icon>
              </span>
              排序
            </th>
            <th class="rename-preview-content-table-item-old-file-name">原文件名</th>
            <th class="rename-preview-content-table-item-right-arrow">⮕</th>
            <th class="rename-preview-content-table-item-new-file-name">新文件名</th>
            <th class="rename-preview-content-table-item-new-file-status">
              <component-icon
                :name="
                  providerRef.hasError
                    ? 'frown'
                    : !providerRef.hasChange
                      ? 'meh'
                      : providerRef.shouldContinue
                        ? 'smile'
                        : ''
                "
              ></component-icon>
            </th>
          </tr>
        </thead>
        <tbody ref="bodyRef" class="rename-preview-content-table-body">
          <tr v-if="topPad > 0" class="rename-preview-content-table-spacer">
            <td colspan="6" :style="{ height: topPad + 'px', padding: 0 }"></td>
          </tr>
          <tr
            v-for="item in visibleList"
            :key="item.id"
            class="rename-preview-content-table-item"
            :data-item-id="item.id"
            :class="{
              'is-error': item.isError,
              'is-change': item.isChange,
              'is-checked': item.isChecked,
              'allow-drop':
                item.status === 'none' &&
                (!providerRef.replaceParams.sortChecked || item.isChecked),
              'block-drop':
                item.status !== 'none' ||
                (providerRef.replaceParams.sortChecked && !item.isChecked),
            }"
          >
            <td
              class="rename-preview-content-table-item-checkbox"
              @click="onItemCheckboxClick(item, $event)"
            >
              <component-checkbox
                :model-value="item.isChecked"
                :readonly="item.status !== 'none'"
                @update:model-value="onItemIsCheckedUpdate(item, $event)"
              ></component-checkbox>
            </td>
            <td class="rename-preview-content-table-item-index">
              <component-icon
                v-if="!isVirtualized"
                name="rank"
                class="rename-preview-content-table-item-index-handler"
              ></component-icon>
              <span class="rename-preview-content-table-item-index-content">
                {{ item.displayIndex }}
              </span>
            </td>

            <td class="rename-preview-content-table-item-old-file-name" :title="item.oldFileName">
              <component
                v-if="item.diffList"
                :is="oldFileNameDiffRender(item.diffList)"
              ></component>
              <template v-else>
                {{ item.oldFileName }}
              </template>
            </td>
            <td class="rename-preview-content-table-item-right-arrow">⮕</td>
            <td class="rename-preview-content-table-item-new-file-name" :title="item.newFileName">
              <component
                v-if="item.diffList"
                :is="newFileNameDiffRender(item.diffList)"
              ></component>
              <template v-else>
                {{ item.newFileName }}
              </template>
            </td>
            <td class="rename-preview-content-table-item-new-file-status">
              <component-icon :name="getStatusIcon(item.status)"></component-icon>
            </td>
          </tr>
          <tr v-if="bottomPad > 0" class="rename-preview-content-table-spacer">
            <td colspan="6" :style="{ height: bottomPad + 'px', padding: 0 }"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <component-loading v-if="providerRef.isPreviewLoading"></component-loading>
  </div>
</template>

<script lang="ts">
import type { Ref } from "vue";
import type { Change } from "diff";
import type { Provider, IListItem, TListItemStatus } from "@/provider/interface";

import { h, ref, reactive, computed, inject, nextTick, onMounted, onUnmounted, defineComponent } from "vue";
import {
  LIST_ITEM_STATUS_READY,
  LIST_ITEM_STATUS_PENDING,
  LIST_ITEM_STATUS_SUCCESS,
  LIST_ITEM_STATUS_FAIL,
  VIRTUAL_LIST_THRESHOLD,
} from "@/provider/interface";
import ComponentIcon from "@/components/Component/ComponentIcon.vue";
import ComponentLoading from "@/components/Component/ComponentLoading.vue";
import ComponentCheckbox from "@/components/Component/ComponentCheckbox.vue";

export default defineComponent({
  name: "RenamePreview",
  components: {
    ComponentIcon,
    ComponentLoading,
    ComponentCheckbox,
  },
  setup() {
    const providerRef = inject<Ref<Provider>>("providerRef");

    const currentList = ref<IListItem[]>(providerRef?.value.currentList || []);

    // ------- 虚拟滚动 -------
    // 仅渲染可视区域 + 上下少量缓冲行，使“打开/批量操作”的开销不随文件数增长。
    // 行数 ≤ 阈值时退化为全量渲染（与旧版一致，保留拖拽排序）。
    const OVERSCAN = 6;
    const DEFAULT_ROW_HEIGHT = 30;

    const scrollRef = ref<HTMLElement | null>(null);
    const bodyRef = ref<HTMLElement | null>(null);
    const scrollTop = ref(0);
    const viewportHeight = ref(0);
    const rowHeight = ref(DEFAULT_ROW_HEIGHT);

    // ------- 鼠标拖拽框选 -------
    const boxSelect = reactive({
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      toggle: false,
    });

    const boxSelectRectStyle = computed(() => {
      if (!boxSelect.active) {
        return {};
      }
      const left = Math.min(boxSelect.startX, boxSelect.currentX);
      const top = Math.min(boxSelect.startY, boxSelect.currentY);
      const width = Math.abs(boxSelect.currentX - boxSelect.startX);
      const height = Math.abs(boxSelect.currentY - boxSelect.startY);
      return {
        left: left + "px",
        top: top + "px",
        width: width + "px",
        height: height + "px",
      };
    });

    // 框选自动滚动
    let autoScrollTimer: ReturnType<typeof setInterval> | null = null;
    const AUTO_SCROLL_SPEED = 6;
    const AUTO_SCROLL_ZONE = 30; // 边缘触发区高度

    const stopAutoScroll = () => {
      if (autoScrollTimer !== null) {
        clearInterval(autoScrollTimer);
        autoScrollTimer = null;
      }
    };

    const startAutoScroll = (el: HTMLElement, clientY: number) => {
      stopAutoScroll();
      autoScrollTimer = setInterval(() => {
        const rect = el.getBoundingClientRect();
        const relY = clientY - rect.top;
        if (relY < AUTO_SCROLL_ZONE && el.scrollTop > 0) {
          el.scrollTop = Math.max(0, el.scrollTop - AUTO_SCROLL_SPEED);
        } else if (relY > rect.height - AUTO_SCROLL_ZONE && el.scrollTop < el.scrollHeight - el.clientHeight) {
          el.scrollTop = Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + AUTO_SCROLL_SPEED);
        } else {
          stopAutoScroll();
        }
      }, 16); // ~60fps
    };

    // 获取文件行在列表中的理论 Y 范围（兼容虚拟滚动）
    // HEADER_HEIGHT 是 thead 的大致高度（含 padding）
    const HEADER_HEIGHT = 35;
    const getRowYRange = (listIndex: number): { top: number; bottom: number } | null => {
      const top = listIndex * rowHeight.value + HEADER_HEIGHT;
      const bottom = top + rowHeight.value;
      return { top, bottom };
    };

    // 判断一个矩形是否与选框相交
    const rectsIntersect = (
      selLeft: number, selTop: number, selRight: number, selBottom: number,
      rowLeft: number, rowTop: number, rowRight: number, rowBottom: number,
    ): boolean => {
      return !(selRight < rowLeft || selLeft > rowRight || selBottom < rowTop || selTop > rowBottom);
    };

    const onMouseDown = (event: MouseEvent) => {
      // 只处理鼠标左键
      if (event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement;
      // 不干扰 checkbox / button / input / drag handle 的点击
      if (
        target.closest(".rename-preview-content-table-item-checkbox") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest(".rename-preview-content-table-item-index-handler")
      ) {
        return;
      }
      const scrollEl = scrollRef.value;
      if (!scrollEl) {
        return;
      }
      const scrollRect = scrollEl.getBoundingClientRect();
      boxSelect.active = true;
      boxSelect.startX = event.clientX - scrollRect.left + scrollEl.scrollLeft;
      boxSelect.startY = event.clientY - scrollRect.top + scrollEl.scrollTop;
      boxSelect.currentX = boxSelect.startX;
      boxSelect.currentY = boxSelect.startY;
      boxSelect.toggle = event.ctrlKey || event.metaKey;

      event.preventDefault();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!boxSelect.active) {
        return;
      }
      const scrollEl = scrollRef.value;
      if (!scrollEl) {
        return;
      }
      const scrollRect = scrollEl.getBoundingClientRect();
      boxSelect.currentX = event.clientX - scrollRect.left + scrollEl.scrollLeft;
      boxSelect.currentY = event.clientY - scrollRect.top + scrollEl.scrollTop;

      // 自动滚动
      startAutoScroll(scrollEl, event.clientY);
    };

    const onMouseUp = () => {
      stopAutoScroll();
      if (!boxSelect.active) {
        return;
      }
      const scrollEl = scrollRef.value;
      if (!scrollEl) {
        boxSelect.active = false;
        return;
      }

      const selLeft = Math.min(boxSelect.startX, boxSelect.currentX);
      const selTop = Math.min(boxSelect.startY, boxSelect.currentY);
      const selRight = Math.max(boxSelect.startX, boxSelect.currentX);
      const selBottom = Math.max(boxSelect.startY, boxSelect.currentY);

      // 框选距离太短（< 5px）视为未框选
      const selWidth = selRight - selLeft;
      const selHeight = selBottom - selTop;
      if (selWidth < 5 && selHeight < 5) {
        boxSelect.active = false;
        return;
      }

      const toggle = boxSelect.toggle;
      const rowsToUpdate: { item: IListItem; val: boolean }[] = [];
      const containerRect = scrollEl.getBoundingClientRect();

      // 获取表体区域用于行相交判断
      // 可视行：通过 DOM 判断
      const visibleRows = scrollEl.querySelectorAll<HTMLElement>(
        "tr.rename-preview-content-table-item"
      );
      visibleRows.forEach((row) => {
        const rowRect = row.getBoundingClientRect();
        if (rectsIntersect(selLeft, selTop, selRight, selBottom, 0, rowRect.top - containerRect.top, containerRect.width, rowRect.bottom - containerRect.top)) {
          const itemId = row.getAttribute("data-item-id");
          if (itemId) {
            const item = currentList.value.find((i) => i.id === itemId);
            if (item && item.status === "none") {
              rowsToUpdate.push({
                item,
                val: toggle ? !item.isChecked : true,
              });
            }
          }
        }
      });

      // 虚拟滚动模式下，还需通过数学计算判断非可视行
      if (isVirtualized.value) {
        const allItems = currentList.value;
        for (let i = 0; i < allItems.length; i++) {
          // 跳过已被可视行处理过的索引
          const range = getRowYRange(i);
          if (!range) {
            continue;
          }
          // 检查是否与选框相交
          if (rectsIntersect(selLeft, selTop, selRight, selBottom, 0, range.top, containerRect.width, range.bottom)) {
            const item = allItems[i];
            // 去重：若该 item 已在 rowsToUpdate 中则跳过
            if (item.status !== "none" || rowsToUpdate.some((r) => r.item.id === item.id)) {
              continue;
            }
            rowsToUpdate.push({
              item,
              val: toggle ? !item.isChecked : true,
            });
          }
        }
      }

      if (rowsToUpdate.length) {
        providerRef?.value.batchUpdateItemIsChecked(rowsToUpdate);
      }

      boxSelect.active = false;
    };

    // 全局 mousemove / mouseup 绑定在 window 上，支持拖到列表外部
    const onWindowMouseMove = (event: MouseEvent) => onMouseMove(event);
    const onWindowMouseUp = () => onMouseUp();

    const isVirtualized = computed(() => currentList.value.length > VIRTUAL_LIST_THRESHOLD);

    const startIndex = computed(() => {
      if (!isVirtualized.value) {
        return 0;
      }
      return Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - OVERSCAN);
    });
    const endIndex = computed(() => {
      const total = currentList.value.length;
      if (!isVirtualized.value) {
        return total;
      }
      const visibleCount = Math.ceil(viewportHeight.value / rowHeight.value) + OVERSCAN * 2;
      return Math.min(total, startIndex.value + visibleCount);
    });

    const visibleList = computed(() => {
      if (!isVirtualized.value) {
        return currentList.value;
      }
      return currentList.value.slice(startIndex.value, endIndex.value);
    });

    const topPad = computed(() =>
      isVirtualized.value ? startIndex.value * rowHeight.value : 0
    );
    const bottomPad = computed(() =>
      isVirtualized.value
        ? (currentList.value.length - endIndex.value) * rowHeight.value
        : 0
    );

    // 用首个真实数据行的高度校正 rowHeight（受字号/缩放影响，不能写死）。
    const measureRowHeight = () => {
      const body = bodyRef.value;
      if (!body) {
        return;
      }
      const row = body.querySelector<HTMLElement>(".rename-preview-content-table-item");
      if (row && row.offsetHeight > 0) {
        rowHeight.value = row.offsetHeight;
      }
    };
    const syncViewport = () => {
      const el = scrollRef.value;
      if (el) {
        viewportHeight.value = el.clientHeight;
        scrollTop.value = el.scrollTop;
      }
    };

    let rafId = 0;
    const onScroll = () => {
      if (rafId) {
        return;
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const el = scrollRef.value;
        if (el) {
          scrollTop.value = el.scrollTop;
          viewportHeight.value = el.clientHeight;
        }
      });
    };

    const onCurrentListUpdate = (val: IListItem[]) => {
      currentList.value = val;
      // 列表变更后（如打开面板、切换网盘目录）重新测量并同步视口尺寸。
      nextTick(() => {
        syncViewport();
        measureRowHeight();
      });
    };

    const onResetSort = () => {
      providerRef?.value.resetSort();
    };

    const onCheckedAllUpdate = (val: boolean) => {
      providerRef?.value.updateCheckedAll(val);
    };

    const onItemIsCheckedUpdate = (item: IListItem, val: boolean) => {
      providerRef?.value.updateItemIsChecked(item, val);
    };

    // Shift+区间选择：在 checkbox td 上捕获 click 事件获取 shiftKey
    const onItemCheckboxClick = (item: IListItem, event: MouseEvent) => {
      if (!event.shiftKey) {
        return;
      }
      // 阻止 ComponentCheckbox 的默认 toggle 行为
      event.preventDefault();
      event.stopPropagation();
      if (item.status !== "none") {
        return;
      }
      const idx = currentList.value.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        providerRef?.value.selectRange(idx);
      }
    };

    const oldFileNameDiffRender = (diffList: Change[]) => {
      // same: !item.added && !item.removed,
      return () =>
        diffList
          .filter((item) => !item.added)
          .map((item) => h("span", { class: { removed: item.removed } }, item.value));
    };
    const newFileNameDiffRender = (diffList: Change[]) => {
      return () =>
        diffList
          .filter((item) => !item.removed)
          .map((item) => h("span", { class: { added: item.added } }, item.value));
    };

    const getStatusIcon = (status: TListItemStatus) => {
      switch (status) {
        // LIST_ITEM_STATUS_NONE
        case LIST_ITEM_STATUS_READY:
          return "timeCircle";
        case LIST_ITEM_STATUS_PENDING:
          return "loading";
        case LIST_ITEM_STATUS_SUCCESS:
          return "checkCircle";
        case LIST_ITEM_STATUS_FAIL:
          return "close";
        default:
          return "";
      }
    };

    onMounted(() => {
      window.addEventListener("mousemove", onWindowMouseMove);
      window.addEventListener("mouseup", onWindowMouseUp);
      providerRef?.value.onCurrentListUpdate(onCurrentListUpdate);
      nextTick(() => {
        syncViewport();
        measureRowHeight();
      });
    });

    onUnmounted(() => {
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
      stopAutoScroll();
      providerRef?.value.offCurrentListUpdate(onCurrentListUpdate);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    });

    return {
      providerRef,
      currentList,
      visibleList,
      isVirtualized,
      topPad,
      bottomPad,
      scrollRef,
      bodyRef,
      boxSelect,
      boxSelectRectStyle,
      onScroll,
      onMouseDown,
      onResetSort,
      onCheckedAllUpdate,
      onItemIsCheckedUpdate,
      onItemCheckboxClick,
      oldFileNameDiffRender,
      newFileNameDiffRender,
      getStatusIcon,
    };
  },
});
</script>

<style scoped>
.rename-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  box-sizing: border-box;
}

.rename-preview-status {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  font-size: var(--cdp-font-size-sm);
  align-items: center;
  line-height: var(--cdp-line-height-sm);
  padding-bottom: 4px;
}
.rename-preview-status-item {
  margin: calc(var(--cdp-gutter) / 2);
  display: flex;
  align-items: center;
}
.rename-preview-status-item.blue {
  color: var(--cdp-color-blue);
}
.rename-preview-status-item.red {
  color: var(--cdp-color-red);
}
.rename-preview-status-item.gray {
  color: var(--cdp-color-gray);
}
.rename-preview-status-item.green {
  color: var(--cdp-color-green);
}
.rename-preview-status-item.yellow {
  color: var(--cdp-color-yellow);
}
.rename-preview-status-item-icon {
  color: inherit;
  font-size: var(--cdp-font-size);
}

.rename-preview-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
  position: relative;
}
.rename-preview-box-select {
  position: absolute;
  border: 1px dashed var(--cdp-color-blue);
  background-color: var(--cdp-color-blue-100);
  opacity: 0.4;
  pointer-events: none;
  z-index: 10;
}
.rename-preview-content-table {
  width: 100%;
  position: relative;
  font-size: var(--cdp-font-size-sm);
  line-height: var(--cdp-font-size-sm);
  border-collapse: separate;
  border-spacing: 0;
}
.rename-preview-content-table-header {
  top: 0;
  z-index: 2;
  position: sticky;
  background-color: var(--cdp-color-gray-50);
  border-radius: 8px 8px 0 0;
}
.rename-preview-content-table-header th {
  padding: 10px calc(var(--cdp-gutter) / 2);
  text-align: center;
  font-weight: 600;
  color: var(--cdp-color-gray-700);
  border-bottom: 2px solid var(--cdp-color-gray-200);
  box-sizing: border-box;
}
.rename-preview-content-table-body td {
  padding: 6px calc(var(--cdp-gutter) / 2);
  height: 36px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--cdp-color-gray-100);
  vertical-align: middle;
}
.rename-preview-content-table-item {
  color: var(--cdp-color-gray-300);
  transition:
    color var(--cdp-transition-default),
    background-color var(--cdp-transition-default);
  background-color: var(--cdp-color-white);
}
/* 行 hover 效果 */
.rename-preview-content-table-body .rename-preview-content-table-item:hover {
  background-color: var(--cdp-color-gray-50);
}
/* 奇偶行微区分 */
.rename-preview-content-table-body .rename-preview-content-table-item:nth-child(even) {
  background-color: var(--cdp-color-gray-50);
}
.rename-preview-content-table-body .rename-preview-content-table-item:nth-child(even):hover {
  background-color: var(--cdp-color-gray-100);
}
/* 已选中行的高亮底色 */
.rename-preview-content-table-body .rename-preview-content-table-item.is-checked {
  background-color: var(--cdp-color-blue-50);
}
.rename-preview-content-table-body .rename-preview-content-table-item.is-checked:hover {
  background-color: var(--cdp-color-blue-100);
}
/* 虚拟滚动占位行：仅用于撑起滚动高度，不参与交互与样式 */
.rename-preview-content-table-spacer td {
  padding: 0;
  border: none;
  background-color: transparent;
}
.rename-preview-content-table-item.is-checked {
  color: var(--cdp-color-gray-600);
}
.rename-preview-content-table-item.is-checked.is-change {
  color: var(--cdp-color-gray-900);
}
.rename-preview-content-table-item.is-checked.is-error {
  color: var(--cdp-color-red);
}
.rename-preview-content-table-item-placeholder {
  background-color: var(--cdp-color-blue-400);
}
.rename-preview-content-table-item-dragged {
  display: flex;
}
.rename-preview-content-table-item-checkbox {
  width: calc(var(--cdp-gutter) + 1em);
}
.rename-preview-content-table-item-index {
  width: 10rem;
  text-align: center;
  position: relative;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  white-space: nowrap;
}
.rename-preview-content-table-item-index-reset-sort {
  cursor: pointer;
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}
.rename-preview-content-table-item-index-reset-sort:hover
  .rename-preview-content-table-item-index-reset-sort-static {
  display: none;
}
.rename-preview-content-table-item-index-reset-sort-hover {
  display: none;
}
.rename-preview-content-table-item-index-reset-sort:hover
  .rename-preview-content-table-item-index-reset-sort-hover {
  display: inline-block;
}
.rename-preview-content-table-item.allow-drop .rename-preview-content-table-item-index-handler {
  cursor: grab;
      cursor: pointer;
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);

}
.rename-preview-content-table-item.block-drop .rename-preview-content-table-item-index-handler {
  /* cursor: no-drop; */
  display: none;
}
.rename-preview-content-table-item-index-content {
  display: inline-block;
}
.rename-preview-content-table-item-old-file-name,
.rename-preview-content-table-item-new-file-name,
.rename-preview-content-table-item-new-file-status {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: center;
}
.rename-preview-content-table-item.is-checked
  .rename-preview-content-table-item-old-file-name:deep(.removed) {
  color: var(--cdp-color-red);
}
.rename-preview-content-table-item-old-file-name:deep(.removed) {
  background-color: var(--cdp-color-red-100);
}
.rename-preview-content-table-item.is-checked
  .rename-preview-content-table-item-new-file-name:deep(.added) {
  color: var(--cdp-color-green);
}
.rename-preview-content-table-item-new-file-name:deep(.added) {
  background-color: var(--cdp-color-green-100);
}

.rename-preview-content-table-item-right-arrow {
  width: calc(var(--cdp-gutter) + 1em);
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE 10+ */
  user-select: none; /* 标准语法 */
}
.rename-preview-content-table-item-new-file-status {
  width: calc(var(--cdp-gutter) + 1em);
  text-align: right;
}
</style>
