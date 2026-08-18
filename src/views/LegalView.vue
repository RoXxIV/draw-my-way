<script setup>
import { computed } from 'vue';

const props = defineProps({
  pageId: {
    type: String,
    required: true,
  },
});

const pages = {
  'mentions-legales': {
    eyebrow: 'Légal',
    title: 'Mentions générales',
    sections: [
      {
        title: 'Éditeur',
        body: 'DrawMyWay est un projet applicatif indépendant en cours de construction. Les informations d’éditeur, d’hébergement et de contact seront complétées avant toute mise en production publique.',
      },
      {
        title: 'Objet',
        body: 'L’application permet de visualiser des traces GPS, de composer une carte personnelle et de générer une image exportable.',
      },
      {
        title: 'Services tiers',
        body: 'DrawMyWay peut s’appuyer sur des fonds de carte MapLibre/OpenMapTiles et sur des connexions à des services sportifs comme Strava lorsque l’utilisateur les active.',
      },
    ],
  },
  confidentialite: {
    eyebrow: 'Données',
    title: 'Confidentialité',
    sections: [
      {
        title: 'Stockage local',
        body: 'Les traces importées, les statistiques calculées et les préférences d’affichage sont conservées dans le navigateur, via IndexedDB et localStorage.',
      },
      {
        title: 'Connexion Strava',
        body: 'La connexion Strava sert à récupérer les activités autorisées par l’utilisateur. La déconnexion vide les activités stockées localement pour repartir d’un compte ou d’une composition propre.',
      },
      {
        title: 'Images exportées',
        body: 'En V1, les visuels sont générés localement pour téléchargement. Aucune galerie publique d’images utilisateur n’est active.',
      },
    ],
  },
  conditions: {
    eyebrow: 'Usage',
    title: 'Conditions d’utilisation',
    sections: [
      {
        title: 'Responsabilité',
        body: 'L’utilisateur reste responsable des traces et images qu’il importe, compose, télécharge ou partage en dehors de l’application.',
      },
      {
        title: 'Prudence géographique',
        body: 'Une trace GPS peut révéler des lieux sensibles. Il est recommandé d’éviter de partager publiquement une image qui expose un domicile, un lieu de travail ou une routine identifiable.',
      },
      {
        title: 'Disponibilité',
        body: 'Le projet est en phase de développement. Certaines fonctionnalités peuvent évoluer, être modifiées ou retirées avant une version publique stable.',
      },
    ],
  },
};

const page = computed(() => pages[props.pageId] || pages['mentions-legales']);
</script>

<template>
  <main class="home-page legal-page">
    <div class="home-shell legal-shell">
      <a class="legal-back" href="#">DrawMyWay</a>
      <article class="legal-card">
        <p class="home-eyebrow">{{ page.eyebrow }}</p>
        <h1>{{ page.title }}</h1>
        <section v-for="section in page.sections" :key="section.title">
          <h2>{{ section.title }}</h2>
          <p>{{ section.body }}</p>
        </section>
      </article>

      <footer class="site-footer">
        <div>
          <strong>DrawMyWay</strong>
          <p>Créez des visuels à partir de vos traces GPS.</p>
        </div>
        <nav aria-label="Liens légaux">
          <a href="#mentions-legales">Mentions générales</a>
          <a href="#confidentialite">Confidentialité</a>
          <a href="#conditions">Conditions</a>
        </nav>
      </footer>
    </div>
  </main>
</template>
