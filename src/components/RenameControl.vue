<template>
  <div v-if="providerRef" class="rename-control">
    <div class="rename-control-header">
      <span class="rename-control-header-content">批量重命名当前目录下所有文件</span>
      <template v-if="versionVisible">
        <a
          v-if="hasNewVersion"
          :href="updateHref"
          target="_blank"
          class="rename-control-header-remote-version"
        >
          发现新版本：{{ remoteVersion }} 点击更新
        </a>
        <span
          v-else
          class="rename-control-header-local-version"
          title="点击检查更新"
          @click="checkVersion"
        >
          <component-icon v-if="versionLoading" name="loading"></component-icon>
          当前版本：{{ localVersion }}
        </span>
      </template>
    </div>
    <div v-if="providerRef.replaceParams" class="rename-control-body">
      <template v-if="providerRef.replaceParams.renameMode === 'series'">
        <div class="rename-control-body-item">
          <component-input
            v-model="providerRef.replaceParams.title"
            label="剧名"
            :disabled="isDisabled"
          ></component-input>
        </div>
        <div class="rename-control-body-item">
          <component-input
            v-model="providerRef.replaceParams.season"
            label="季数"
            type="number"
            :disabled="isDisabled"
          ></component-input>
        </div>
        <div class="rename-control-body-full">
          <tmdb-search :disabled="isDisabled"></tmdb-search>
        </div>
      </template>
      <template v-if="providerRef.replaceParams.renameMode === 'builder'">
        <div class="rename-control-body-full">
          <pattern-builder :disabled="isDisabled"></pattern-builder>
        </div>
      </template>
      <template v-if="providerRef.replaceParams.renameMode === 'pattern'">
        <div class="rename-control-body-item">
          <component-input
            v-model="providerRef.replaceParams.pattern"
            label="正则"
            :disabled="isDisabled"
          ></component-input>
        </div>
        <div class="rename-control-body-item">
          <component-input
            v-model="providerRef.replaceParams.replace"
            label="替换文本"
            :disabled="isDisabled"
          ></component-input>
        </div>
      </template>
    </div>
    <div class="rename-control-footer">
      <div class="rename-control-footer-option">
        <component-radio
          v-model="providerRef.replaceParams.renameMode"
          label="series"
          :disabled="isDisabled"
        >
          剧集模式
        </component-radio>
        <component-radio
          v-model="providerRef.replaceParams.renameMode"
          label="builder"
          :disabled="isDisabled"
        >
          积木模式
        </component-radio>
        <component-radio
          v-model="providerRef.replaceParams.renameMode"
          label="pattern"
          :disabled="isDisabled"
        >
          正则(高级)
        </component-radio>
        <component-checkbox v-model="providerRef.replaceParams.autoEpisode" :disabled="isDisabled">
          自动集数
        </component-checkbox>
        <select
          v-if="providerRef.replaceParams.autoEpisode"
          v-model="providerRef.replaceParams.episodeSource"
          class="rename-control-episode-source"
          :disabled="isDisabled"
          title="集数从哪里来：优先用文件名里的数字（如 12.mkv→E12），还是按列表顺序"
        >
          <option value="filename">集数源:文件名</option>
          <option value="order">集数源:顺序</option>
        </select>
        <component-checkbox v-model="providerRef.replaceParams.sortChecked" :disabled="isDisabled">
          排序已选
        </component-checkbox>
      </div>
      <button
        class="rename-control-footer-button reset"
        :disabled="isDisabled"
        @click="onResetClick"
      >
        重置
      </button>
      <button
        class="rename-control-footer-button confirm"
        :disabled="!canApply"
        @click="onConfirmClick"
      >
        应用
      </button>
    </div>

    <component-loading v-if="providerRef.isControlLoading"></component-loading>
  </div>
</template>

<script lang="ts">
import type { Ref } from "vue";
import type { Provider } from "@/provider/interface";

import { ref, inject, computed, onMounted, onUnmounted, defineComponent } from "vue";
import useVersion from "@/utils/useVersion";
import TmdbSearch from "@/components/TmdbSearch.vue";
import PatternBuilder from "@/components/PatternBuilder.vue";
import ComponentIcon from "@/components/Component/ComponentIcon.vue";
import ComponentInput from "@/components/Component/ComponentInput.vue";
import ComponentRadio from "@/components/Component/ComponentRadio.vue";
import ComponentLoading from "@/components/Component/ComponentLoading.vue";
import ComponentCheckbox from "@/components/Component/ComponentCheckbox.vue";

export default defineComponent({
  name: "RenameControl",
  components: {
    TmdbSearch,
    PatternBuilder,
    ComponentIcon,
    ComponentInput,
    ComponentRadio,
    ComponentLoading,
    ComponentCheckbox,
  },
  setup() {
    const version = useVersion();

    const providerRef = inject<Ref<Provider>>("providerRef");

    // Provider 是普通类实例，其 shouldContinue 等状态非响应式。
    // 控制栏在某些模式（如积木模式）下不会因 blocks 变化而重渲染，
    // 导致「应用」按钮状态不刷新。这里订阅列表重算回调，强制重求值。
    const refresh = ref(0);
    const onCurrentListUpdate = () => {
      refresh.value++;
    };
    onMounted(() => {
      providerRef?.value.onCurrentListUpdate(onCurrentListUpdate);
    });
    onUnmounted(() => {
      providerRef?.value.offCurrentListUpdate(onCurrentListUpdate);
    });

    // 注意：isLoading / replaceParamsDisabled / shouldContinue 都是 Provider 上的
    // 普通（非响应式）属性。computed 若不读取任何响应式依赖，会永久缓存首次结果——
    // 一旦首次求值发生在「列表加载中(isLoading=true)」，就会被冻结成 true，
    // 导致「应用」按钮永远禁用。这里统一读取 refresh（每次列表重算自增）作为依赖，
    // 强制这些状态随列表更新重新求值。
    const isDisabled = computed(() => {
      void refresh.value;
      return !!(providerRef?.value.replaceParamsDisabled || providerRef?.value.isLoading);
    });
    const canApply = computed(() => {
      void refresh.value;
      const p = providerRef?.value;
      return !!(p && p.shouldContinue && !p.replaceParamsDisabled && !p.isLoading);
    });
    const onResetClick = () => {
      providerRef?.value.reset();
    };

    const onConfirmClick = () => {
      providerRef?.value.batchRename();
    };

    return {
      ...version,
      providerRef,
      isDisabled,
      canApply,
      onResetClick,
      onConfirmClick,
    };
  },
});
</script>

<style scoped>
.rename-control {
  padding: var(--cdp-gutter);
  background: linear-gradient(180deg, var(--cdp-color-gray-50) 0%, var(--cdp-color-gray-100) 100%);
  box-shadow: var(--cdp-box-shadow-md);
  transition: box-shadow var(--cdp-transition-default);
  border-radius: var(--cdp-gutter);
}
.rename-control:hover {
  box-shadow: var(--cdp-box-shadow-xl);
}
.rename-control-header {
  display: flex;
  align-items: top;
  justify-content: space-between;
}
.rename-control-header-content {
  font-size: var(--cdp-font-size-lg);
}
.rename-control-header-local-version {
  display: flex;
}
.rename-control-header-local-version,
.rename-control-header-remote-version {
  cursor: pointer;
  font-size: var(--cdp-font-size-xs);
}
.rename-control-header-local-version:hover,
.rename-control-header-remote-version:hover {
  text-decoration: underline;
}
.rename-control-header-remote-version {
  color: var(--cdp-color-red);
}
.rename-control-body {
  display: grid;
  grid-gap: var(--cdp-gutter);
  align-items: end;
  grid-template-columns: 1fr 1fr;
}
.rename-control-body-full {
  grid-column: 1 / -1;
}
.rename-control-footer {
  display: grid;
  grid-gap: var(--cdp-gutter);
  margin-top: var(--cdp-gutter);
  grid-template-columns: 1fr auto auto;
}
.rename-control-footer-option {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.rename-control-episode-source {
  height: 24px;
  margin-left: 2px;
  border: 1px solid var(--cdp-color-gray-300);
  border-radius: 6px;
  font-size: var(--cdp-font-size-xs);
  background-color: var(--cdp-color-white);
  color: var(--cdp-color-gray-900);
}
.rename-control-footer-button {
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: var(--cdp-font-size);
  transition: var(--cdp-transition-all);
  line-height: 1;
  background-color: transparent;
}
.rename-control-footer-button.reset {
  color: var(--cdp-color-gray-900);
}
.rename-control-footer-button.reset:hover {
  color: var(--cdp-color-gray-700);
}
.rename-control-footer-button.confirm {
  color: var(--cdp-color-blue);
}
.rename-control-footer-button.confirm:hover {
  color: var(--cdp-color-blue-700);
}
.rename-control-footer-button[disabled] {
  color: var(--cdp-color-gray-300);
  cursor: not-allowed;
}
.rename-control-footer-button[disabled]:hover {
  color: var(--cdp-color-gray-400);
}
</style>
