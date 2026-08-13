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
  mapStyleId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['toggle-footprint-mode', 'update-map-style', 'update:modelValue']);
const isOpen = ref(false);

const colors = ['#d62828', '#fc4c02', '#0077b6', '#2a9d8f', '#6d597a', '#2b9348', '#111827'];
</script>

<template>
  <div class="style-panel" :class="{ 'is-open': isOpen }">
    <div class="tool-buttons">
      <button
        class="style-toggle"
        type="button"
        :aria-expanded="isOpen"
        aria-label="Modifier l'apparence de la carte"
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
      </button>
    </div>

    <div v-if="isOpen" class="style-popover">
      <p class="style-title">Couleur des trajets</p>
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

      <p class="style-title map-style-title">Fond de carte</p>
      <div class="map-style-options">
        <button
          v-for="style in MAP_STYLES"
          :key="style.id"
          class="map-style-button"
          :class="{ 'is-selected': style.id === mapStyleId }"
          type="button"
          @click="emit('update-map-style', style.id)"
        >
          {{ style.label }}
        </button>
      </div>

      <label class="footprint-option">
        <input
          type="checkbox"
          :checked="isFootprintMode"
          @change="emit('toggle-footprint-mode')"
        />
        <span>Masquer les détails de carte</span>
      </label>
    </div>
  </div>
</template>
