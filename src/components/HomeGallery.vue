<script setup>
defineProps({
  error: {
    type: String,
    default: '',
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  maps: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['open-app', 'refresh']);

function formatDate(value) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function getStat(map, key) {
  return map.stats?.[key]?.value || '';
}
</script>

<template>
  <main class="home-page">
    <section class="home-hero">
      <div class="home-hero-copy">
        <p class="home-eyebrow">TerraTrace</p>
        <h1>La carte de tous vos chemins</h1>
        <p>
          Connectez Strava, créez votre visuel, puis partagez une seule carte publique.
          Chaque nouveau partage remplace l'ancien.
        </p>
      </div>
      <div class="home-actions">
        <button class="home-primary" type="button" @click="emit('open-app')">
          Créer ma carte
        </button>
        <button class="home-secondary" type="button" @click="emit('refresh')">
          Actualiser
        </button>
      </div>
    </section>

    <section class="gallery-section" aria-labelledby="gallery-title">
      <div class="gallery-header">
        <div>
          <p class="home-eyebrow">Galerie publique</p>
          <h2 id="gallery-title">Dernières cartes partagées</h2>
        </div>
        <p>Aucun nom Strava n'est affiché publiquement.</p>
      </div>

      <p v-if="isLoading" class="gallery-state">Chargement de la galerie...</p>
      <p v-else-if="error" class="gallery-state gallery-error">{{ error }}</p>
      <p v-else-if="maps.length === 0" class="gallery-state">
        Aucune carte partagée pour le moment. Soyez le premier à publier votre trace.
      </p>

      <div v-else class="shared-map-grid">
        <article v-for="map in maps" :key="map.id || map.imageUrl" class="shared-map-card">
          <img :src="map.imageUrl" alt="Carte TerraTrace partagée anonymement" loading="lazy" />
          <div class="shared-map-meta">
            <p>Carte anonyme</p>
            <span>{{ formatDate(map.updatedAt) }}</span>
          </div>
          <dl class="shared-map-stats">
            <div v-if="getStat(map, 'distance')">
              <dt>Distance</dt>
              <dd>{{ getStat(map, 'distance') }}</dd>
            </div>
            <div v-if="getStat(map, 'activityCount')">
              <dt>Activités</dt>
              <dd>{{ getStat(map, 'activityCount') }}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  </main>
</template>
