<script setup>
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
  'toggle-footprint-mode',
  'update-map-style',
  'update-route-opacity',
  'update-route-render-mode',
  'update:modelValue',
]);

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
  <div class="style-panel">
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
</template>

<style lang="scss">
.style-panel {
  display: grid;
}

.style-section {
  border-top: 1px solid rgba(127, 140, 153, 0.22);
  padding: 10px 0;
}

.style-section:first-child {
  border-top: 0;
  padding-top: 0;
}

.style-section:last-child {
  padding-bottom: 0;
}

.style-section summary {
  cursor: pointer;
  color: $ink;
  font-size: 0.86rem;
  font-weight: 850;
  list-style: none;
}

.style-section summary::-webkit-details-marker {
  display: none;
}

.style-section summary::before {
  display: inline-block;
  margin-right: 7px;
  color: $brand;
  content: "›";
  transform: rotate(0deg);
  transition: transform 0.16s ease;
}

.style-section[open] summary::before {
  transform: rotate(90deg);
}

.style-section > :not(summary) {
  margin-top: 10px;
}

.color-swatches {
  display: grid;
  grid-template-columns: repeat(7, 22px);
  gap: 6px;
}

.route-mode-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 12px;
}

.route-mode-button {
  min-height: 30px;
  border: 1px solid rgba(127, 140, 153, 0.28);
  border-radius: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.96);
  color: $ink;
  font-size: 0.8rem;
  font-weight: 800;
}

.route-mode-button.is-selected {
  background: rgba(23, 33, 43, 0.88);
  color: #ffffff;
}

.route-opacity-control {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 7px 10px;
  margin-top: 12px;
  color: $ink;
  font-size: 0.82rem;
  font-weight: 800;
}

.route-opacity-control input {
  grid-column: 1 / -1;
  width: 100%;
  accent-color: $ink;
}

.route-opacity-control strong {
  font-size: 0.78rem;
}

.map-style-options {
  display: grid;
  grid-template-columns: 1fr;
  gap: 7px;
}

.map-style-button {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 9px;
  border: 1px solid rgba(127, 140, 153, 0.28);
  border-radius: 6px;
  padding: 7px 8px;
  background: rgba(255, 255, 255, 0.96);
  color: $ink;
  font-size: 0.8rem;
  font-weight: 800;
  text-align: left;
}

.map-style-button.is-selected {
  background: rgba(23, 33, 43, 0.88);
  color: #ffffff;
}

.map-style-preview {
  width: 38px;
  height: 24px;
  flex: 0 0 auto;
  border: 1px solid rgba(23, 33, 43, 0.16);
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.32);
}

.footprint-option {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 12px;
  color: $ink;
  font-size: 0.84rem;
  font-weight: 800;
}

.footprint-option input {
  width: 16px;
  height: 16px;
  accent-color: $ink;
}

.color-swatch {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgba(31, 41, 51, 0.2);
}

.color-swatch.is-selected {
  box-shadow:
    0 0 0 2px $ink,
    0 0 0 4px rgba(255, 255, 255, 0.92);
}

@media (max-width: 380px) {
  .map-style-options {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
