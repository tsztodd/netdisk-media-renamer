import type { Component } from "vue";
import type { Change } from "diff";

import Sortable from "sortablejs";
import message from "@/utils/message";
import simpleDiff from "@/utils/simpleDiff";
import { isArray, isNumber } from "@/utils/is";
import querySelector from "@/utils/querySelector";
import complementZero from "@/utils/complementZero";
import extractEpisode from "@/utils/episodeParse";
import compileBlocks, { type IPatternBlock } from "@/utils/patternBuilder";

// 文件数量超过该阈值时，预览列表启用虚拟滚动（仅渲染可视区域行），
// 同时关闭原生拖拽排序（虚拟滚动下 DOM 中不存在全部行，拖拽会错乱）。
// 小列表保持原有行为（含拖拽），不引入回归。
export const VIRTUAL_LIST_THRESHOLD = 50;

export abstract class Provider {
  // 匹配测试
  static test() {
    return false;
  }
  // 类型
  public abstract type: string;
  // 根元素 ID
  public abstract rootElementId: string;
  // 根元素插入目标
  public abstract rootElementInsertTarget: string;
  // 根元素插入方式
  public abstract rootElementInsertMethod: TRootElementInsertMethod;
  // 入口组件
  public abstract EnterComponent: () => Component;

  // 显示加载
  public isLoading: boolean = false;
  // 更新加载中
  public isUpdateLoading: boolean = false;
  // 控制加载中
  public isControlLoading: boolean = false;
  // 预览加载中
  public isPreviewLoading: boolean = false;

  // 主面板显示控制
  public visible: boolean = false;
  public setVisible(val: boolean = false) {
    if (
      !val &&
      (this.isLoading || this.isUpdateLoading || this.isControlLoading || this.isPreviewLoading)
    ) {
      return false;
    }
    this.visible = val;
    if (val) {
      this._updateOriginList().then(() => {
        this._initDragSort();
      });
    } else {
      this._destroyDragSort();
    }
  }

  // 替换参数
  public replaceParams: ReplaceParams = new ReplaceParams({
    onUpdateHandler: () => this._onReplaceParamsUpdate.call(this),
    onChangeHandler: (key: TReplaceParamsKeys, data: ReplaceParams) =>
      this._onReplaceParamsChange.call(this, key, data),
  });
  // 替换参数禁用
  public replaceParamsDisabled: boolean = false;
  // 替换参数更新回调函数
  private _onReplaceParamsUpdate() {
    // 输入框每次按键都会触发本回调；全量重算 + 重渲染较重，
    // 这里做防抖，避免连续输入时反复阻塞主线程导致页面卡死。
    this._scheduleUpdateCurrentList();
  }
  // 防抖调度当前列表更新（仅用于参数变更路径；勾选/排序等需即时更新的路径直接调用 _updateCurrentList）
  private _updateTimer: ReturnType<typeof setTimeout> | null = null;
  private _scheduleUpdateCurrentList(delay = 120) {
    if (this._updateTimer) {
      clearTimeout(this._updateTimer);
    }
    this._updateTimer = setTimeout(() => {
      this._updateTimer = null;
      this._updateCurrentList();
    }, delay);
  }
  private _onReplaceParamsChange(key: TReplaceParamsKeys, data: ReplaceParams) {
    if (key === "sortChecked") {
      this._onSortCheckedChange(data[key]);
    }
  }
  // 重置替换参数
  private _resetReplaceParams() {
    this.replaceParams.reset();
  }

  // 原始文件列表数据
  protected originList: IOriginListItem[] = [];
  // 获取原始文件列表数据
  protected abstract getOriginList(): Promise<IOriginListItem[]>;
  // 网盘当前已勾选的文件 id（由各 provider 在 getOriginList 内尽力填充）。
  // 为空表示“无法判断/未勾选”，此时回退为默认全选（与旧版行为一致）。
  protected _selectedIds: string[] = [];
  // 根据网盘已勾选项初始化“未选中列表”：仅预选网盘里勾选的文件。
  private _initUncheckedFromSelection() {
    this._uncheckedList.clear();
    let selectedIds: string[] = [];
    try {
      selectedIds = Array.isArray(this._selectedIds) ? this._selectedIds : [];
    } catch {
      selectedIds = [];
    }
    if (!selectedIds.length) {
      return; // 无勾选 → 全选（保持旧行为）
    }
    const allIds = new Set(this.originList.map((item) => String(item.id)));
    const selectedSet = new Set(selectedIds.map(String).filter((id) => allIds.has(id)));
    // 安全网：识别到的勾选项必须是 originList 的非空真子集，
    // 否则视为“无法可靠判断”，回退为全选，避免误选到错误文件。
    if (selectedSet.size === 0 || selectedSet.size === allIds.size) {
      return;
    }
    this.originList.forEach((item) => {
      if (!selectedSet.has(String(item.id))) {
        this._uncheckedList.add(item.id);
      }
    });
  }
  // 更新原始文件列表数据
  private _updateOriginList(): Promise<IListItem[]> {
    this.isLoading = true;
    this._clearIndexMap();
    this._clearUncheckedList();
    this._selectedIds = [];
    return this.getOriginList()
      .then((res) => {
        this._clearIndexMap();
        this.isLoading = false;
        this.originList = res;
        this._initListItemIndex();
        this._initUncheckedFromSelection();
        return this._updateCurrentList();
      })
      .catch(() => {
        this._clearIndexMap();
        this.isLoading = false;
        this.originList = [];
        this._updateCurrentList();
        return [];
      });
  }

  // 当前文件列表数据
  private _currentList: IListItem[] = [];
  public get currentList(): IListItem[] {
    return this._currentList;
  }
  // 更新当前文件列表数据
  private _updateCurrentList(): IListItem[] {
    const renameMode = this.replaceParams.renameMode;

    let result: IListItem[] = this.originList.map((item) => {
      return {
        id: item.id,
        ext: item.ext,
        path: item.path,
        index: this._getListItemIndex(item.id),
        status: LIST_ITEM_STATUS_NONE,
        isEmpty: false,
        isError: false,
        isRepeat: false,
        fileName: item.fileName,
        isChange: false,
        isMatched: true,
        isChecked: !this._uncheckedList.has(item.id),
        isLoading: false,
        oldFileName: item.fullFileName,
        newFileName: "",
        displayIndex: this._getListItemDisplayIndex(item.id),
      };
    });

    result = result.sort((a, b) => a.index - b.index);

    const newFileNameSet: Set<string> = new Set();

    if (renameMode === RENAME_MODE_SERIES) {
      if (this.replaceParams.title || this.replaceParams.season) {
        const season = this.replaceParams.season
          ? ".S" + complementZero(this.replaceParams.season)
          : "";
        result.forEach((item) => {
          const fileName = this.replaceParams.title || item.fileName;
          let newFileName = fileName + season;
          const epNum = this._getEpisodeNumber(item);
          if (this.replaceParams.autoEpisode && isNumber(epNum)) {
            const episode = (season ? "" : ".") + "E" + complementZero(epNum);
            newFileName += episode;
          }
          newFileName += "." + item.ext;
          item.newFileName = newFileName.trim();
          this._listItemGeneralMethod(item, newFileNameSet);
        });
      }
    }

    if (renameMode === RENAME_MODE_PATTERN) {
      let regexp: RegExp | undefined;

      if (this.replaceParams.pattern) {
        try {
          regexp = new RegExp(this.replaceParams.pattern, "g");
        } catch (error) {
          console.error("regexp error", error);
        }
        if (regexp) {
          result.forEach((item) => {
            if (this.replaceParams.autoEpisode) {
              // 带 g 标志的正则 .test() 是有状态的（会推进 lastIndex），
              // 在循环中跨文件复用同一个正则会导致匹配结果错乱、大量文件被漏判。
              // 每次匹配前重置 lastIndex 修复此问题。
              regexp!.lastIndex = 0;
              item.isMatched = !!regexp?.test(item.fileName);
              if (item.isMatched) {
                let newFileName = item.fileName.replace(
                  regexp as RegExp,
                  this.replaceParams.replace
                );
                const epNum = this._getEpisodeNumber(item);
                if (isNumber(epNum)) {
                  newFileName += (newFileName ? ".E" : "E") + complementZero(epNum);
                }
                if (newFileName) {
                  newFileName += "." + item.ext;
                }
                item.newFileName = newFileName.trim();
                this._listItemGeneralMethod(item, newFileNameSet);
              }
            } else {
              regexp!.lastIndex = 0;
              item.isMatched = !!regexp?.test(item.oldFileName);
              if (item.isMatched) {
                item.newFileName = item.oldFileName.replace(
                  regexp as RegExp,
                  this.replaceParams.replace
                );
                this._listItemGeneralMethod(item, newFileNameSet);
              }
            }
          });
        }
      }
    }

    if (renameMode === RENAME_MODE_BUILDER) {
      const transform = compileBlocks(this.replaceParams.blocks);
      result.forEach((item) => {
        let newFileName = transform(item.fileName);
        const epNum = this._getEpisodeNumber(item);
        if (this.replaceParams.autoEpisode && isNumber(epNum)) {
          newFileName += (newFileName ? ".E" : "E") + complementZero(epNum);
        }
        if (newFileName) {
          newFileName += "." + item.ext;
        }
        item.newFileName = newFileName.trim();
        this._listItemGeneralMethod(item, newFileNameSet);
      });
    }

    this._currentList = result;
    this._updateStatus();
    this._emitCurrentListUpdateHandler();

    return result;
  }
  // 计算某个文件应使用的集数：
  // - episodeSource = "filename"：从原文件名提取（如 12.mkv → 12），取不到再回退顺序序号
  // - episodeSource = "order"：按列表顺序序号
  private _getEpisodeNumber(item: IListItem): number | undefined {
    if (this.replaceParams.episodeSource === "filename") {
      const ep = extractEpisode(item.fileName);
      if (isNumber(ep)) {
        return ep;
      }
    }
    return isNumber(item.displayIndex) ? item.displayIndex : undefined;
  }
  // 文件列表项通用处理
  private _listItemGeneralMethod(item: IListItem, newFileNameSet: Set<string>) {
    item.isChange = item.oldFileName !== item.newFileName;
    item.isEmpty = item.isChecked && !item.newFileName;
    item.isRepeat = item.isChecked && !!item.newFileName && newFileNameSet.has(item.newFileName);
    item.isError = item.isEmpty || item.isRepeat;
    item.isChecked && newFileNameSet.add(item.newFileName);
    if (item.isChange) {
      item.diffList = simpleDiff(item.oldFileName, item.newFileName);
    } else {
      item.diffList = undefined;
    }
  }

  // 空名计数
  private _emptyCount: number = 0;
  // 错误计数
  private _errorCount: number = 0;
  // 重复计数
  private _repeatCount: number = 0;
  // 变更计数
  private _changeCount: number = 0;
  // 匹配计数
  private _matchedCount: number = 0;
  // 状态计数
  private _failStatusCount: number = 0;
  private _readyStatusCount: number = 0;
  private _pendingStatusCount: number = 0;
  private _successStatusCount: number = 0;
  // 是否有错误
  public hasError: boolean = false;
  // 是否有变更
  public hasChange: boolean = false;
  // 是否全选
  public hasCheckedAll: boolean = false;
  // 是否全不选
  public hasUncheckedAll: boolean = false;
  // 是否可继续
  public shouldContinue: boolean = false;
  // 状态列表
  public statusList: IStatusList[] = [];
  protected _updateStatus(): void {
    let emptyCount = 0;
    let errorCount = 0;
    let repeatCount = 0;
    let changeCount = 0;
    let matchedCount = 0;
    let failStatusCount = 0;
    let readyStatusCount = 0;
    let pendingStatusCount = 0;
    let successStatusCount = 0;

    this._currentList.forEach((item) => {
      if (item.isChecked) {
        item.isEmpty && emptyCount++;
        item.isError && errorCount++;
        item.isRepeat && repeatCount++;
        item.isChange && changeCount++;
        item.isMatched && matchedCount++;
      }
      if (item.status === LIST_ITEM_STATUS_PENDING) {
        pendingStatusCount++;
      } else if (item.status === LIST_ITEM_STATUS_SUCCESS) {
        successStatusCount++;
      } else if (item.status === LIST_ITEM_STATUS_READY) {
        readyStatusCount++;
      } else if (item.status === LIST_ITEM_STATUS_FAIL) {
        failStatusCount++;
      }
    });
    this._emptyCount = emptyCount;
    this._errorCount = errorCount;
    this._repeatCount = repeatCount;
    this._changeCount = changeCount;
    this._matchedCount = matchedCount;
    this._failStatusCount = failStatusCount;
    this._readyStatusCount = readyStatusCount;
    this._pendingStatusCount = pendingStatusCount;
    this._successStatusCount = successStatusCount;

    this.hasError = this._errorCount > 0;
    this.hasChange = this._changeCount > 0;

    this.shouldContinue = !this.hasError && this.hasChange;

    this.hasCheckedAll = this._uncheckedList.size === 0;
    this.hasUncheckedAll = this._uncheckedList.size === this._currentList.length;

    this._updateStatusList();
  }
  private _updateStatusList() {
    const result: IStatusList[] = [];
    if (!this._currentList.length) {
      const title = "无文件";
      result.push({ icon: "closeCircleFilled", title, className: "red" }, { message: title });
    } else {
      if (this.isUpdateLoading) {
        if (this._successStatusCount) {
          result.push({
            message: `已成功(${this._successStatusCount})`,
            className: "green",
          });
        }
        if (this._pendingStatusCount) {
          result.push({
            message: `加载中(${this._pendingStatusCount})`,
            className: "blue",
          });
        }
        if (this._readyStatusCount) {
          result.push({
            message: `准备中(${this._readyStatusCount})`,
            className: "blue",
          });
        }
        if (this._failStatusCount) {
          result.push({
            message: `已失败(${this._failStatusCount})`,
            className: "red",
          });
        }
      } else if (this.shouldContinue) {
        const title = "准备就绪";
        result.push(
          { icon: "checkCircleFilled", title, className: "green" },
          { message: title, className: "green" }
        );
      }
      if (!this.hasChange) {
        const title = "暂无改动";
        result.push(
          { icon: "infoCircleFilled", title, className: "yellow" },
          { message: title, className: "yellow" }
        );
      }
      if (this._emptyCount) {
        const title = `文件名为空(${this._emptyCount})`;
        result.push(
          { icon: "closeCircleFilled", title, className: "red" },
          { message: title, className: "red" }
        );
      }
      if (this._repeatCount) {
        const title = `文件名重复(${this._repeatCount})`;
        result.push(
          { icon: "closeCircleFilled", title, className: "red" },
          { message: title, className: "red" }
        );
      }
      const checked = this._currentList.length - this._uncheckedList.size;
      if (checked > 0) {
        result.push({ message: `已选中(${checked})`, className: "blue" });
      }
      if (this._uncheckedList.size > 0) {
        result.push({
          message: `未选中(${this._uncheckedList.size})`,
          className: "yellow",
        });
      }
      // if (this._uncheckedList.size && checked) {
      //   if (this._uncheckedList.size > checked) {
      //     result.push({ message: `已选中(${checked})`, className: "blue" });
      //   } else {
      //     result.push({
      //       message: `未选中(${this._uncheckedList.size})`,
      //       className: "yellow",
      //     });
      //   }
      // }
      const unmatchedCount = checked - this._matchedCount;
      if (unmatchedCount && this._matchedCount) {
        if (unmatchedCount > this._matchedCount) {
          result.push({
            message: `已匹配(${this._matchedCount})`,
            className: "blue",
          });
        } else {
          result.push({
            message: `未匹配(${unmatchedCount})`,
            className: "yellow",
          });
        }
      }
    }
    this.statusList = result;
  }

  // 文件列表更新回调函数集合
  private _currentListUpdateHandlerSet: Set<(currentList: IListItem[]) => void> = new Set();
  // 绑定文件列表更新回调函数
  public onCurrentListUpdate(handler: (currentList: IListItem[]) => void): void {
    if (!this._currentListUpdateHandlerSet.has(handler)) {
      this._currentListUpdateHandlerSet.add(handler);
    }
  }
  // 解绑文件列表更新回调函数
  public offCurrentListUpdate(handler: (currentList: IListItem[]) => void): void {
    if (this._currentListUpdateHandlerSet.has(handler)) {
      this._currentListUpdateHandlerSet.delete(handler);
    }
  }
  // 触发文件列表更新回调函数
  private _emitCurrentListUpdateHandler(): void {
    this._currentListUpdateHandlerSet.forEach((handler) => {
      handler(this._currentList);
    });
  }

  // 未选中的文件列表
  private _uncheckedList: Set<string> = new Set();
  // 上次点击的文件在 currentList 中的索引，用于 Shift+区间选择
  private _lastClickedIndex: number = -1;
  // 更新是否选中文件列表
  public updateItemIsChecked(item: IListItem, val: boolean): void {
    item.isChecked = val;
    if (val) {
      this._uncheckedList.delete(item.id);
    } else {
      this._uncheckedList.add(item.id);
    }
    this._updateItemSortByIsChecked();
    // 记录当前点击位置供 Shift+区间选择使用
    this._lastClickedIndex = this._currentList.findIndex((i) => i.id === item.id);
    this._updateCurrentList();
  }
  // Shift+区间选择：选中 _lastClickedIndex 到 currentIndex 之间的所有可操作文件
  public selectRange(currentIndex: number): void {
    if (this._lastClickedIndex < 0 || this._lastClickedIndex >= this._currentList.length) {
      this._lastClickedIndex = currentIndex;
      return;
    }
    const min = Math.min(this._lastClickedIndex, currentIndex);
    const max = Math.max(this._lastClickedIndex, currentIndex);
    for (let i = min; i <= max; i++) {
      const item = this._currentList[i];
      // 跳过不可操作的文件（已提交或正在处理的）
      if (item.status !== LIST_ITEM_STATUS_NONE) {
        continue;
      }
      item.isChecked = true;
      this._uncheckedList.delete(item.id);
    }
    this._lastClickedIndex = currentIndex;
    this._updateItemSortByIsChecked();
    this._updateCurrentList();
  }
  // 批量更新选中状态：一次批量更新，只触发一次 _updateCurrentList
  public batchUpdateItemIsChecked(items: { item: IListItem; val: boolean }[]): void {
    if (!items.length) {
      return;
    }
    for (const { item, val } of items) {
      if (item.status !== LIST_ITEM_STATUS_NONE) {
        continue;
      }
      item.isChecked = val;
      if (val) {
        this._uncheckedList.delete(item.id);
      } else {
        this._uncheckedList.add(item.id);
      }
    }
    this._updateItemSortByIsChecked();
    this._updateCurrentList();
  }
  // 更新是否全选
  public updateCheckedAll(val: boolean): void {
    this.hasCheckedAll = val;
    this.hasUncheckedAll = !val;
    if (val) {
      this._uncheckedList = new Set();
    } else {
      this._currentList.forEach((item) => {
        this._uncheckedList.add(item.id);
      });
    }
    this._updateItemSortByCheckedAll(val);
    this._updateCurrentList();
  }
  private _clearUncheckedList() {
    this._lastClickedIndex = -1;
    this._uncheckedList.clear();
  }

  // 当前列表是否启用虚拟滚动（行数过多）。
  // 预览组件据此决定是否只渲染可视区域，并隐藏拖拽手柄。
  public get isVirtualized(): boolean {
    return this._currentList.length > VIRTUAL_LIST_THRESHOLD;
  }

  // 初始化拖动排序
  private _sortableInstance: Sortable | null = null;
  private _initDragSort() {
    // 虚拟滚动模式下 DOM 不包含全部行，原生拖拽会破坏顺序，直接跳过。
    // 用户仍可通过“重置排序 / 勾选顺序”调整。
    if (this.isVirtualized) {
      return;
    }
    querySelector(".rename-preview-content-table-body", 10).then((res) => {
      this._sortableInstance = Sortable.create(res, {
        handle: ".rename-preview-content-table-item-index-handler",
        filter: ".rename-preview-content-table-item.block-drop",
        draggable: ".rename-preview-content-table-item",
        ghostClass: "rename-preview-content-table-item-placeholder",
        fallbackClass: "rename-preview-content-table-item-dragged",
        forceFallback: true,
        onSort: (event) => {
          if (isNumber(event.newIndex) && isNumber(event.oldIndex)) {
            this._sortListItem(event.newIndex, event.oldIndex);
          }
        },
      });
    });
  }
  private _destroyDragSort() {
    if (this._sortableInstance) {
      this._sortableInstance.destroy();
      this._sortableInstance = null;
    }
  }
  // 排序
  private _indexMap: Map<string, { index: number; displayIndex?: number }> = new Map();
  private _clearIndexMap(): void {
    this._indexMap.clear();
  }
  private _initListItemIndex() {
    this.originList.forEach((item, index) => {
      this._setListItemIndex(item.id, index);
    });
  }
  private _setListItemIndex(id: string, index: number): number {
    const temp = this._indexMap.get(id);
    if (!temp) {
      this._indexMap.set(id, { index, displayIndex: index + 1 });
    } else if (temp.index !== index) {
      temp.index = index;
    }
    return index;
  }
  private _setListItemDisplayIndex(id: string, displayIndex?: number): number | undefined {
    const temp = this._indexMap.get(id);
    if (!temp) {
      if (displayIndex) {
        this._indexMap.set(id, { index: displayIndex - 1, displayIndex });
      } else {
        this._indexMap.set(id, { index: this._findListItemIndex(id) });
      }
    } else if (temp.displayIndex !== displayIndex) {
      temp.displayIndex = displayIndex;
    }
    return displayIndex;
  }
  private _getListItemIndex(id: string): number {
    const temp = this._indexMap.get(id);
    if (temp) {
      return temp.index;
    }
    return this._findListItemIndex(id);
  }
  private _getListItemDisplayIndex(id: string): number | undefined {
    const temp = this._indexMap.get(id);
    if (temp) {
      return temp.displayIndex;
    }
    return this._findListItemIndex(id) + 1;
  }
  private _findListItemIndex(id: string): number {
    let index = this.originList.findIndex((item) => item.id === id);
    if (index !== -1) {
      index = this.originList.length;
    }
    this._setListItemIndex(id, index);
    return index;
  }
  private _sortListItem(newIndex: number, oldIndex: number): void {
    if (newIndex === oldIndex) {
      return;
    }
    const currentList = [...this._currentList];
    currentList.splice(newIndex, 0, currentList.splice(oldIndex, 1)[0]);
    const start = newIndex > oldIndex ? oldIndex : newIndex;
    const end = newIndex > oldIndex ? newIndex : oldIndex;
    for (let index = start; index <= end; index++) {
      this._setListItemIndex(currentList[index].id, index);
      if (!this.replaceParams.sortChecked) {
        this._setListItemDisplayIndex(currentList[index].id, index + 1);
      }
    }
    if (this.replaceParams.sortChecked) {
      let index = 1;
      currentList.forEach((item) => {
        this._setListItemDisplayIndex(item.id, item.isChecked ? index++ : undefined);
      });
    }
    this._updateCurrentList();
  }
  private _updateItemSortByIsChecked() {
    if (this.replaceParams.sortChecked) {
      let index = 1;
      this._currentList.forEach((item) => {
        this._setListItemDisplayIndex(item.id, item.isChecked ? index++ : undefined);
      });
    }
  }
  private _updateItemSortByCheckedAll(val: boolean) {
    if (this.replaceParams.sortChecked) {
      if (val) {
        this._currentList.forEach((item, index) => {
          this._setListItemDisplayIndex(item.id, index + 1);
        });
      } else {
        this._currentList.forEach((item) => {
          this._setListItemDisplayIndex(item.id);
        });
      }
    }
  }
  private _onSortCheckedChange(val: boolean) {
    if (val) {
      let index = 1;
      this._currentList.forEach((item) => {
        this._setListItemDisplayIndex(item.id, item.isChecked ? index++ : undefined);
      });
    } else {
      this._currentList.forEach((item, index) => {
        this._setListItemDisplayIndex(item.id, index + 1);
      });
    }
  }

  // 刷新数据
  protected abstract refresh(): Promise<any>;
  // 发起重命名请求
  protected abstract renameRequest(data?: IListItem[]): Promise<any>;
  // 批量重命名
  public batchRename(): void {
    if (!this.shouldContinue) {
      return;
    }
    this.isUpdateLoading = true;
    this.replaceParamsDisabled = true;
    this._updateStatusList();
    const data = this.currentList.filter(
      (item) => item.isChecked && item.isChange && !item.isError
    );
    this.renameRequest(data)
      .then(() => {
        message.success("批量重命名成功");
        this.visible = false;
        this._resetReplaceParams();
      })
      .catch(() => {
        message.error("重命名失败");
        this.refresh().then(() => {
          this._updateOriginList();
        });
      })
      .finally(() => {
        this.isUpdateLoading = false;
        this.replaceParamsDisabled = false;
        this._updateStatusList();
      });
  }
  // 重置
  public reset(): void {
    this._resetReplaceParams();
    this._updateOriginList();
  }
  // 重置排序
  public resetSort(): void {
    this._clearIndexMap();
    this._initListItemIndex();
    this._updateCurrentList();
  }
}

export class ReplaceParams {
  // 剧名
  private _title: string = "";
  public get title() {
    return this._title;
  }
  public set title(val) {
    this._title = val;
    this._onUpdate("title");
  }
  // 季数
  private _season: string = "";
  public get season() {
    return this._season;
  }
  public set season(val) {
    this._season = val;
    this._onUpdate("season");
  }
  // 正则
  private _pattern: string = "";
  public get pattern() {
    return this._pattern;
  }
  public set pattern(val) {
    this._pattern = val;
    this._onUpdate("pattern");
  }
  // 替换文本
  private _replace: string = "";
  public get replace() {
    return this._replace;
  }
  public set replace(val) {
    this._replace = val;
    this._onUpdate("replace");
  }
  // 自动集数
  public _autoEpisode: boolean = true;
  public get autoEpisode() {
    return this._autoEpisode;
  }
  public set autoEpisode(val) {
    this._autoEpisode = val;
    this._onUpdate("autoEpisode");
  }
  // 排序已选
  public _sortChecked: boolean = false;
  public get sortChecked() {
    return this._sortChecked;
  }
  public set sortChecked(val) {
    this._sortChecked = val;
    this._onUpdate("sortChecked");
  }
  // 集数来源：filename=从原文件名提取（默认），order=按列表顺序序号
  private _episodeSource: TEpisodeSource = EPISODE_SOURCE_FILENAME;
  public get episodeSource() {
    return this._episodeSource;
  }
  public set episodeSource(val) {
    this._episodeSource = val;
    this._onUpdate("episodeSource");
  }

  // 正则积木
  private _blocks: IPatternBlock[] = [];
  public get blocks() {
    return this._blocks;
  }
  public set blocks(val) {
    this._blocks = Array.isArray(val) ? val : [];
    this._onUpdate("blocks");
  }

  // 重命名模式
  private _renameMode: TRenameMode = RENAME_MODE_SERIES;
  public get renameMode() {
    return this._renameMode;
  }
  public set renameMode(val) {
    this._renameMode = val;
    this._onUpdate("renameMode");
  }

  private _stopUpdate = false;
  private _onUpdate = (key: TReplaceParamsKeys | TReplaceParamsKeys[]) => {
    if (!this._stopUpdate) {
      if (this._onChangeHandler) {
        if (isArray(key)) {
          for (let index = 0; index < key.length; index++) {
            this._onChangeHandler(key[index], this);
          }
        } else {
          this._onChangeHandler(key, this);
        }
      }
      this._onUpdateHandler && this._onUpdateHandler(this);
    }
  };
  private _onUpdateHandler?: (replaceParams: ReplaceParams) => void;
  private _onChangeHandler?: (key: TReplaceParamsKeys, replaceParams: ReplaceParams) => void;

  public reset(val?: any) {
    this._stopUpdate = true;
    this.title = val?.title || "";
    this.season = val?.season || "";
    this.pattern = val?.pattern || "";
    this.replace = val?.replace || "";
    this.autoEpisode = val ? !!val.autoEpisode : true;
    this.sortChecked = val ? !!val.sortChecked : false;
    this.episodeSource = val?.episodeSource || EPISODE_SOURCE_FILENAME;
    this.blocks = Array.isArray(val?.blocks) ? val.blocks : [];
    this.renameMode = val?.renameMode || RENAME_MODE_SERIES;
    this._stopUpdate = false;
    const keys: TReplaceParamsKeys[] = [
      "title",
      "season",
      "pattern",
      "replace",
      "autoEpisode",
      "sortChecked",
      "episodeSource",
      "blocks",
      "renameMode",
    ];
    this._onUpdate(keys);
  }

  constructor(
    options: {
      onUpdateHandler?: (replaceParams: ReplaceParams) => void;
      onChangeHandler?: (key: TReplaceParamsKeys, replaceParams: ReplaceParams) => void;
    } = {}
  ) {
    if (options.onUpdateHandler) {
      this._onUpdateHandler = options.onUpdateHandler;
    }
    if (options.onChangeHandler) {
      this._onChangeHandler = options.onChangeHandler;
    }
  }
}

export type TReplaceParamsKeys =
  | "title"
  | "season"
  | "pattern"
  | "replace"
  | "autoEpisode"
  | "sortChecked"
  | "episodeSource"
  | "blocks"
  | "renameMode";

export type TRenameMode = "series" | "pattern" | "builder";
export const RENAME_MODE_SERIES: TRenameMode = "series";
export const RENAME_MODE_PATTERN: TRenameMode = "pattern";
export const RENAME_MODE_BUILDER: TRenameMode = "builder";

export type TEpisodeSource = "filename" | "order";
export const EPISODE_SOURCE_FILENAME: TEpisodeSource = "filename";
export const EPISODE_SOURCE_ORDER: TEpisodeSource = "order";

export type TRootElementInsertMethod = "append" | "prepend";
export const ROOT_ELEMENT_INSERT_METHOD_APPEND: TRootElementInsertMethod = "append";
export const ROOT_ELEMENT_INSERT_METHOD_PREPEND: TRootElementInsertMethod = "prepend";

export interface IOriginListItem {
  id: string;
  ext: string;
  path?: string;
  index: number;
  fileName: string;
  fullFileName: string;
}

export type TListItemStatus = "none" | "ready" | "pending" | "success" | "fail";
export const LIST_ITEM_STATUS_NONE: TListItemStatus = "none";
export const LIST_ITEM_STATUS_READY: TListItemStatus = "ready";
export const LIST_ITEM_STATUS_PENDING: TListItemStatus = "pending";
export const LIST_ITEM_STATUS_SUCCESS: TListItemStatus = "success";
export const LIST_ITEM_STATUS_FAIL: TListItemStatus = "fail";

export interface IListItem {
  id: string;
  ext: string;
  path?: string;
  index: number;
  status: TListItemStatus;
  isEmpty: boolean;
  isError: boolean;
  isRepeat: boolean;
  fileName: string;
  isChange: boolean;
  diffList?: Change[];
  isMatched: boolean;
  isChecked: boolean;
  isLoading: boolean;
  oldFileName: string;
  newFileName: string;
  displayIndex?: number;
}

export interface IStatusList {
  icon?: string;
  color?: string;
  title?: string;
  message?: string;
  className?: string;
}

export default Provider;
