<script setup>
import { ref } from 'vue';
import { MAP_STYLES } from '../config/map';

defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  isFootprintMode: {
    type: Boolean,
    default: false,
  },
  isCaptureMode: {
    type: Boolean,
    default: false,
  },
  mapStyleId: {
    type: String,
    required: true,
  },
  routeRenderMode: {
    type: String,
    required: true,
  },
  routeOpacity: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits([
  'toggle-capture-mode',
  'toggle-footprint-mode',
  'update-map-style',
  'update-route-opacity',
  'update-route-render-mode',
  'update:modelValue',
]);
const isOpen = ref(false);

const colors = ['#d62828', '#ff4f00', '#0077b6', '#2a9d8f', '#6d597a', '#2b9348', '#111827'];
const routeRenderModes = [
  { id: 'solid', label: 'Normal' },
  { id: 'heat', label: 'Chaleur' },
];

function getMapPreviewStyle(style) {
  return {
    background: `linear-gradient(135deg, ${style.preview[0]} 0 48%, ${style.preview[1]} 48% 100%)`,
  };
}
</script>

<template>
  <div class="style-panel" :class="{ 'is-open': isOpen || isCaptureMode }">
    <div v-if="!isCaptureMode" class="tool-buttons">
      <button
        class="style-toggle"
        :class="{ 'is-active': isOpen }"
        type="button"
        :aria-expanded="isOpen"
        aria-label="Personnaliser la carte"
        title="Personnaliser la carte"
        @click="isOpen = !isOpen"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" class="tool-icon">
          <path
            d="M18.4 3.6a2.1 2.1 0 0 1 3 3l-9.1 9.1-3-3 9.1-9.1Z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
          <path
            d="M8.7 13.3c-2.6.5-4.1 2-4.4 4.5-.1.8-.4 1.5-1 2.1 2.1.2 4.4-.2 5.8-1.6 1.1-1.1 1.5-2.7.9-4.1"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </svg>
        <span>Personnaliser</span>
      </button>
      <button
        class="style-toggle capture-toggle"
        :class="{ 'is-active': isCaptureMode }"
        type="button"
        :aria-pressed="isCaptureMode"
        aria-label="Créer un visuel"
        title="Créer un visuel"
        @click="emit('toggle-capture-mode')"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" class="tool-icon">
          <path
            d="M14.5 5 13 3H9L7.5 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4.5Z"
            fill="none"
            stroke="currentColor"
            stroke-linejoin="round"
            stroke-width="2"
          />
          <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
        <span>Mode photo</span>
      </button>
    </div>

    <div v-if="isOpen || isCaptureMode" class="style-popover">
      <p class="style-title">Personnaliser</p>

      <details class="style-section" open>
        <summary>Tracés</summary>
        <div class="color-swatches">
          <button
            v-for="color in colors"
            :key="color"
            class="color-swatch"
            :class="{ 'is-selected': color === modelValue }"
            type="button"
            :style="{ backgroundColor: color }"
            :aria-label="`Choisir ${color}`"
            @click="emit('update:modelValue', color)"
          ></button>
        </div>

        <div class="route-mode-options">
          <button
            v-for="mode in routeRenderModes"
            :key="mode.id"
            class="route-mode-button"
            :class="{ 'is-selected': mode.id === routeRenderMode }"
            type="button"
            @click="emit('update-route-render-mode', mode.id)"
          >
            {{ mode.label }}
          </button>
        </div>

        <label class="route-opacity-control">
          <span>Opacité</span>
          <strong>{{ routeOpacity.toFixed(2) }}</strong>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="routeOpacity"
            @input="emit('update-route-opacity', Number($event.target.value))"
          />
        </label>
      </details>

      <details class="style-section">
        <summary>Fond de carte</summary>
        <div class="map-style-options">
          <button
            v-for="style in MAP_STYLES"
            :key="style.id"
            class="map-style-button"
            :class="{ 'is-selected': style.id === mapStyleId }"
            type="button"
            @click="emit('update-map-style', style.id)"
          >
            <span class="map-style-preview" :style="getMapPreviewStyle(style)"></span>
            <span>{{ style.label }}</span>
          </button>
        </div>
      </details>

      <details class="style-section">
        <summary>Détails de carte</summary>
        <label class="footprint-option">
          <input
            type="checkbox"
            :checked="isFootprintMode"
            @change="emit('toggle-footprint-mode')"
          />
          <span>Masquer les détails de carte</span>
        </label>
      </details>
    </div>
  </div>
</template>
