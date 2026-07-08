<template>
  <teleport to="body">
    <div v-if="providerRef" class="rename-panel">
      <transition name="fade">
        <div v-if="providerRef.visible" class="rename-panel-mask"></div>
      </transition>
      <transition name="fade-scale">
        <div v-if="providerRef.visible" class="rename-panel-container">
          <div class="rename-panel-container-content">
            <div class="rename-panel-container-content-header">
              <rename-control></rename-control>
            </div>
            <div class="rename-panel-container-content-body">
              <div
                class="rename-panel-close-body"
                title="关闭"
                @click="onMaskClick"
              >
                <svg t="1783418274844" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5422" width="20" height="20"><path d="M512 960C264.96 960 64 759.04 64 512S264.96 64 512 64s448 200.96 448 448-200.96 448-448 448z m0-831.713c-211.584 0-383.713 172.129-383.713 383.713 0 211.552 172.129 383.713 383.713 383.713 211.552 0 383.713-172.16 383.713-383.713 0-211.584-172.161-383.713-383.713-383.713z m45.055 385.09l138.368-136.865c12.576-12.416 12.673-32.672 0.256-45.248s-32.704-12.673-45.248-0.256l-138.56 137.024-136.448-136.864c-12.513-12.513-32.735-12.577-45.248-0.064-12.513 12.48-12.544 32.735-0.064 45.248l136.256 136.672L328.99 648.928c-12.577 12.447-12.673 32.672-0.257 45.248a31.886 31.886 0 0 0 22.752 9.504c8.128 0 16.256-3.103 22.497-9.248l137.567-136.064 138.688 139.137c6.24 6.271 14.432 9.407 22.657 9.407a31.937 31.937 0 0 0 22.591-9.344c12.513-12.48 12.544-32.704 0.064-45.248L557.055 513.376z" p-id="5423" fill="#cdcdcd"></path></svg>
              </div>
              <rename-preview></rename-preview>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </teleport>
</template>

<script lang="ts">
import type { Ref } from "vue";
import type { Provider } from "@/provider/interface";

import { inject, defineComponent } from "vue";
import RenameControl from "@/components/RenameControl.vue";
import RenamePreview from "@/components/RenamePreview.vue";
import ComponentIcon from "@/components/Component/ComponentIcon.vue";

export default defineComponent({
  name: "RenamePanel",
  components: {
    RenameControl,
    RenamePreview,
    ComponentIcon,
  },
  setup() {
    const providerRef = inject<Ref<Provider>>("providerRef");

    const onMaskClick = () => {
      if (!providerRef?.value.isLoading) {
        providerRef?.value.setVisible(false);
      }
    };

    return {
      providerRef,
      onMaskClick,
    };
  },
});
</script>

<style scoped>
.rename-panel {
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  display: flex;
  position: fixed;
  font-size: var(--cdp-font-size);
  align-items: center;
  justify-content: center;
}
.rename-panel:has(.rename-panel-container) {
  height: 100dvh;
}
.rename-panel-mask {
  width: 100vw;
  height: 100dvh;
  position: absolute;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.rename-panel-container {
  z-index: 1;
  animation: panel-in 0.25s ease;
}
@keyframes panel-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
.rename-panel-container-content {
  display: flex;
  flex-direction: row;
  overflow: hidden;
  width: min(95vw, 1020px);
  min-width: min(90vw, 780px);
  height: min(90vh, 680px);
  min-height: 60vh;
  box-sizing: border-box;
  border-radius: 12px;
  box-shadow:
    0 8px 30px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease;
  background-color: var(--cdp-color-white);
}
.rename-panel-container-content:hover {
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.08);
}
.rename-panel-container-content-header {
  position: relative;
  flex-shrink: 0;
  width: 360px;
  overflow-y: auto;
  background: var(--cdp-color-blue-50);
  border-radius: 12px 0 0 12px;
}
.rename-panel-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--cdp-color-gray-400);
  font-size: 16px;
  transition: all 0.2s ease;
  z-index: 1;
}
.rename-panel-close:hover {
  background-color: var(--cdp-color-gray-100);
  color: var(--cdp-color-gray-700);
  border-color: var(--cdp-color-gray-200);
}
.rename-panel-container-content-body {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-width: 0;
  background: var(--cdp-color-white);
  border-left: 1px solid var(--cdp-color-gray-200);
  border-radius: 0 12px 12px 0;
}
.rename-panel-close-body {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cdp-color-gray-600);
  transition: all 0.2s ease;
  z-index: 10;
}
.rename-panel-close-body-icon {
  width: 20px;
  height: 20px;
  display: block;
}
</style>
