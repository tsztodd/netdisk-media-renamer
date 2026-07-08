<template>
  <div class="tmdb-search">
    <div class="tmdb-search-bar">
      <input
        v-model="query"
        class="tmdb-input"
        placeholder="TMDB 搜索剧名（中/英文均可）"
        :disabled="disabled"
        @keyup.enter="onSearch"
      />
      <button class="tmdb-btn" :disabled="disabled || loading" @click="onSearch">
        {{ loading ? "搜索中…" : "搜索" }}
      </button>
      <select v-model="language" class="tmdb-lang" :disabled="disabled" title="结果语言">
        <option value="en-US">英文名</option>
        <option value="zh-CN">中文名</option>
      </select>
      <button
        class="tmdb-key-toggle"
        :class="{ active: showKey || !hasKey }"
        title="设置 TMDB API Key"
        @click="showKey = !showKey"
      >
        <component-icon name="key"></component-icon>
      </button>
    </div>

    <div v-if="showKey || !hasKey" class="tmdb-key">
      <input
        v-model="apiKeyInput"
        class="tmdb-input"
        type="password"
        placeholder="粘贴你的 TMDB API Key（v3 32位 或 v4 Token）"
        :disabled="disabled"
      />
      <button class="tmdb-btn" :disabled="disabled" @click="onSaveKey">保存</button>
      <a
        class="tmdb-key-help"
        href="https://www.themoviedb.org/settings/api"
        target="_blank"
        rel="noopener"
      >
        免费申请
      </a>
    </div>

    <div v-if="message" class="tmdb-message" :class="messageType">{{ message }}</div>

    <ul v-if="results.length" class="tmdb-results">
      <li
        v-for="item in results"
        :key="item.id"
        class="tmdb-result"
        :title="item.overview"
        @click="onPick(item)"
      >
        <span class="tmdb-result-name">{{ item.name }}</span>
        <span v-if="item.original_name && item.original_name !== item.name" class="tmdb-result-org">
          {{ item.original_name }}
        </span>
        <span class="tmdb-result-year">{{ (item.first_air_date || "").slice(0, 4) || "—" }}</span>
        <span class="tmdb-result-apply">应用 <component-icon name="rightArrow"></component-icon></span>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import type { Ref } from "vue";
import type { Provider } from "@/provider/interface";
import type { ITmdbTv } from "@/utils/tmdb";

import { ref, inject, defineComponent } from "vue";
import {
  searchTv,
  getApiKey,
  setApiKey,
  getLanguage,
  setLanguage,
  formatSeriesTitle,
  TmdbError,
} from "@/utils/tmdb";
import ComponentIcon from "@/components/Component/ComponentIcon.vue";

export default defineComponent({
  name: "TmdbSearch",
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

    const query = ref("");
    const results = ref<ITmdbTv[]>([]);
    const loading = ref(false);
    const message = ref("");
    const messageType = ref<"info" | "error" | "success">("info");

    const apiKeyInput = ref(getApiKey());
    const hasKey = ref(!!getApiKey());
    const showKey = ref(false);
    const language = ref(getLanguage());

    const setMessage = (msg: string, type: "info" | "error" | "success" = "info") => {
      message.value = msg;
      messageType.value = type;
    };

    const onSaveKey = () => {
      setApiKey(apiKeyInput.value);
      hasKey.value = !!getApiKey();
      showKey.value = false;
      setMessage(hasKey.value ? "已保存 API Key" : "已清空 API Key", "success");
    };

    const onSearch = async () => {
      if (loading.value) {
        return;
      }
      setLanguage(language.value);
      if (!getApiKey()) {
        showKey.value = true;
        setMessage("请先填写并保存 TMDB API Key", "error");
        return;
      }
      if (!query.value.trim()) {
        setMessage("请输入剧名", "error");
        return;
      }
      loading.value = true;
      setMessage("");
      results.value = [];
      try {
        const list = await searchTv(query.value);
        results.value = list.slice(0, 8);
        if (!list.length) {
          setMessage("没有找到相关剧集", "info");
        }
      } catch (e) {
        const err = e as TmdbError;
        if (err?.code === "UNAUTHORIZED") {
          showKey.value = true;
          setMessage("API Key 无效（401），请检查后重试", "error");
        } else if (err?.code === "NO_KEY") {
          showKey.value = true;
          setMessage("请先填写并保存 TMDB API Key", "error");
        } else if (err?.code === "NETWORK") {
          setMessage("网络请求失败，请检查网络或 @connect 授权", "error");
        } else {
          setMessage("搜索失败：" + (err?.message || "未知错误"), "error");
        }
      } finally {
        loading.value = false;
      }
    };

    const onPick = (item: ITmdbTv) => {
      const title = formatSeriesTitle(item.name || item.original_name, item.first_air_date);
      if (providerRef?.value) {
        providerRef.value.replaceParams.title = title;
      }
      setMessage(`已应用：${title}（在上方「剧名」可继续微调）`, "success");
    };

    return {
      query,
      results,
      loading,
      message,
      messageType,
      apiKeyInput,
      hasKey,
      showKey,
      language,
      onSaveKey,
      onSearch,
      onPick,
    };
  },
});
</script>

<style scoped>
.tmdb-search {
  display: flex;
  flex-direction: column;
  gap: calc(var(--cdp-gutter) / 2);
}
.tmdb-search-bar,
.tmdb-key {
  display: flex;
  align-items: center;
  gap: 6px;
}
.tmdb-input {
  flex: 1;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--cdp-color-gray-300);
  border-radius: 6px;
  font-size: var(--cdp-font-size-sm);
  background-color: var(--cdp-color-white);
  color: var(--cdp-color-gray-900);
  box-sizing: border-box;
}
.tmdb-btn {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--cdp-color-blue);
  color: var(--cdp-color-white);
  background-color: var(--cdp-color-blue);
  border-radius: 6px;
  cursor: pointer;
  font-size: var(--cdp-font-size-sm);
  white-space: nowrap;
}
.tmdb-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.tmdb-lang {
  height: 28px;
  border: 1px solid var(--cdp-color-gray-300);
  border-radius: 6px;
  font-size: var(--cdp-font-size-sm);
  background-color: var(--cdp-color-white);
}
.tmdb-key-toggle {
  height: 28px;
  width: 32px;
  border: 1px solid var(--cdp-color-gray-300);
  border-radius: 6px;
  background-color: var(--cdp-color-white);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}
.tmdb-key-toggle.active {
  border-color: var(--cdp-color-blue);
  background-color: var(--cdp-color-blue-50);
}
.tmdb-key-help {
  font-size: var(--cdp-font-size-xs);
  color: var(--cdp-color-blue);
  white-space: nowrap;
}
.tmdb-message {
  font-size: var(--cdp-font-size-xs);
}
.tmdb-message.error {
  color: var(--cdp-color-red);
}
.tmdb-message.success {
  color: var(--cdp-color-green);
}
.tmdb-message.info {
  color: var(--cdp-color-gray-600);
}
.tmdb-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 24vh;
  overflow: auto;
}
.tmdb-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 1px solid var(--cdp-color-gray-200);
  border-radius: 6px;
  cursor: pointer;
  font-size: var(--cdp-font-size-sm);
  background-color: var(--cdp-color-gray-50);
  transition: var(--cdp-transition-all);
}
.tmdb-result:hover {
  border-color: var(--cdp-color-blue);
  background-color: var(--cdp-color-blue-50);
}
.tmdb-result-name {
  font-weight: 600;
  color: var(--cdp-color-gray-900);
}
.tmdb-result-org {
  color: var(--cdp-color-gray-500);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tmdb-result-year {
  margin-left: auto;
  color: var(--cdp-color-gray-600);
}
.tmdb-result-apply {
  color: var(--cdp-color-blue);
  white-space: nowrap;
}
</style>
