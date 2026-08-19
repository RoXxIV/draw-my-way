<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(MotionPathPlugin, ScrollTrigger);

const emit = defineEmits(['open-app']);
const root = ref(null);
const waypointSection = ref(null);
const waypointStage = ref(null);
const waypointCanvas = ref(null);
const routePath = ref(null);
const routeMarker = ref(null);
let animationContext;
let resizeHandler;
let resizeTimer;

const inspirationSteps = [
  {
    eyebrow: 'Historique',
    title: 'Tout votre historique en une image',
    description:
      'Importez vos traces GPS et révélez la carte complète de vos sorties cumulées, sans devoir parcourir activité par activité.',
    meta: 'Accumuler',
  },
  {
    eyebrow: 'Souvenirs',
    title: 'Composez vos souvenirs',
    description:
      'Choisissez quelques traces, ajoutez un titre ou des stats personnalisées, puis créez un visuel autour d’un voyage, d’un défi ou d’une saison.',
    meta: 'Assembler',
  },
  {
    eyebrow: 'Créatif',
    title: 'Dessinez avec vos traces',
    description:
      'Utilisez vos parcours comme matière première : une forme, un mot, une ligne symbolique. Vous pouvez même dessiner un tracé sur mesure avec un outil comme <a href="https://drawmyloop.com/fr" target="_blank" rel="noopener">Draw My Loop</a>, puis l’importer ici en GPX.',
    meta: 'Tracer',
  },
];

function createWaypointAnimation() {
  if (!root.value || !waypointSection.value || !waypointStage.value || !waypointCanvas.value || !routePath.value || !routeMarker.value) {
    return;
  }

  animationContext?.revert();

  animationContext = gsap.context(() => {
    const stageRect = waypointStage.value.getBoundingClientRect();
    const markers = gsap.utils.toArray('.waypoint-target', waypointStage.value);
    const points = markers.map((marker) => {
      const rect = marker.getBoundingClientRect();

      return {
        x: rect.left + rect.width / 2 - stageRect.left,
        y: rect.top + rect.height / 2 - stageRect.top,
      };
    });

    if (points.length < 2) {
      return;
    }

    points.unshift({
      x: points[0].x + 90,
      y: Math.max(12, points[0].y - 120),
    });

    waypointCanvas.value.setAttribute('viewBox', `0 0 ${stageRect.width} ${stageRect.height}`);
    const routeDefinition = createSvgRoute(points, stageRect);
    const guidePath = waypointStage.value.querySelector('.waypoint-guide');

    guidePath?.setAttribute('d', routeDefinition);
    routePath.value.setAttribute('d', routeDefinition);
    const pathLength = routePath.value.getTotalLength();
    const scrollConfig = {
      scroller: root.value,
      trigger: waypointSection.value,
    };

    gsap.set(routePath.value, {
      strokeDasharray: pathLength,
      strokeDashoffset: pathLength,
    });

    gsap.set(routeMarker.value, {
      transformOrigin: '50% 50%',
      scale: 0.75,
    });

    const canScroll = root.value.scrollHeight - root.value.clientHeight > 160;
    const drawEase = canScroll ? 'none' : 'power1.inOut';
    const drawTimeline = gsap.timeline(
      canScroll
        ? {
            scrollTrigger: {
              ...scrollConfig,
              start: 'top 78%',
              end: 'bottom 92%',
              invalidateOnRefresh: true,
              scrub: 0.6,
            },
          }
        : {
            defaults: { duration: 2.6 },
            scrollTrigger: {
              ...scrollConfig,
              start: 'top 85%',
              once: true,
            },
          },
    );

    drawTimeline
      .to(routePath.value, {
        strokeDashoffset: 0,
        ease: drawEase,
      }, 0)
      .to(routeMarker.value, {
        ease: drawEase,
        motionPath: {
          path: routePath.value,
          align: routePath.value,
          alignOrigin: [0.5, 0.5],
          autoRotate: true,
        },
      }, 0)
      .progress(1)
      .progress(0);

    gsap.from('.waypoint-card', {
      y: 40,
      x: (index) => (index % 2 === 0 ? -30 : 30),
      opacity: 0,
      stagger: 0.15,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        ...scrollConfig,
        start: 'top 80%',
      },
    });

    gsap.from('.closing-panel', {
      y: 44,
      opacity: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        scroller: root.value,
        trigger: '.closing-section',
        start: 'top 85%',
      },
    });
  }, root.value);
}

function createSvgRoute(anchors, bounds) {
  return toSmoothPath(buildWindingPoints(anchors, bounds));
}

function buildWindingPoints(anchors, bounds) {
  const points = [anchors[0]];

  anchors.slice(1).forEach((anchor, index) => {
    const previous = anchors[index];
    const deltaX = anchor.x - previous.x;
    const deltaY = anchor.y - previous.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance >= 220) {
      const sideX = Math.abs(deltaX) > 80 ? Math.sign(deltaX) : (index % 2 === 0 ? -1 : 1);
      const swing = gsap.utils.clamp(120, 240, bounds.width * 0.18);

      points.push({
        x: gsap.utils.clamp(30, bounds.width - 30, (previous.x + anchor.x) / 2 + sideX * swing),
        y: previous.y + deltaY * 0.5,
      });
    }

    points.push(anchor);
  });

  return points;
}

function toSmoothPath(points) {
  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }

    const p0 = points[index - 2] ?? points[index - 1];
    const p1 = points[index - 1];
    const p3 = points[index + 1] ?? point;
    const firstControlX = p1.x + (point.x - p0.x) / 6;
    const firstControlY = p1.y + (point.y - p0.y) / 6;
    const secondControlX = point.x - (p3.x - p1.x) / 6;
    const secondControlY = point.y - (p3.y - p1.y) / 6;

    return `${path} C ${firstControlX.toFixed(1)} ${firstControlY.toFixed(1)}, ${secondControlX.toFixed(1)} ${secondControlY.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  }, '');
}

onMounted(async () => {
  await nextTick();

  createWaypointAnimation();
  resizeHandler = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      createWaypointAnimation();
      ScrollTrigger.refresh();
    }, 150);
  };
  window.addEventListener('resize', resizeHandler);
  ScrollTrigger.refresh();

  document.fonts?.ready?.then(() => {
    createWaypointAnimation();
    ScrollTrigger.refresh();
  });
});

onBeforeUnmount(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }

  clearTimeout(resizeTimer);
  animationContext?.revert();
});
</script>

<template>
  <main ref="root" class="home-page">
    <div class="home-shell">
      <section class="home-hero">
        <div class="home-hero-copy">
          <p class="home-eyebrow">DrawMyWay</p>
          <h1>La carte de tous vos chemins</h1>
          <p>
            Connectez une source GPS ou importez vos fichiers GPX pour révéler
            une carte unique de vos sorties cumulées. Explorez, personnalisez,
            capturez et partagez votre trace.
          </p>
          <div class="home-actions">
            <button
              class="home-primary"
              type="button"
              @click="emit('open-app')"
            >
              Créer ma carte
            </button>
          </div>
        </div>
      </section>

      <section ref="waypointSection" class="waypoint-section" aria-labelledby="inspiration-title">
        <div class="section-heading">
          <p class="home-eyebrow">Inspirations</p>
          <h2 id="inspiration-title">Trois façons de raconter vos traces</h2>
        </div>

        <div ref="waypointStage" class="waypoint-stage">
          <svg ref="waypointCanvas" class="waypoint-canvas" aria-hidden="true">
            <path
              class="waypoint-guide"
            />
            <path
              ref="routePath"
              class="waypoint-route"
            />
            <g ref="routeMarker" class="waypoint-marker">
              <path d="M0 -13 L18 0 L0 13 L4 3 L-16 3 L-16 -3 L4 -3 Z" />
            </g>
          </svg>

          <article
            v-for="(step, index) in inspirationSteps"
            :key="step.title"
            class="waypoint-card"
            :class="`is-step-${index + 1}`"
          >
            <span class="waypoint-target" aria-hidden="true"></span>
            <p class="home-eyebrow">{{ step.eyebrow }}</p>
            <h3>{{ step.title }}</h3>
            <p v-html="step.description"></p>
            <span class="waypoint-card-meta">{{ step.meta }}</span>
          </article>
        </div>
      </section>

      <section class="closing-section" aria-labelledby="closing-title">
        <div class="closing-panel">
          <p class="home-eyebrow">Prêt à partir ?</p>
          <h2 id="closing-title">Votre carte du monde commence ici</h2>
          <p>
            Connectez Strava et importez toutes vos activités d’un coup,
            sélectionnez quelques traces ou déposez vos fichiers GPX. On ne
            conserve que l’essentiel — vos tracés et vos kilomètres cumulés,
            rien d’autre.
          </p>
          <ul class="closing-points">
            <li>Tout Strava en un clic</li>
            <li>Traces choisies ou fichiers GPX</li>
            <li>Léger par design : aucune stat détaillée stockée</li>
          </ul>
          <button class="home-primary" type="button" @click="emit('open-app')">
            Créer ma carte
          </button>
        </div>
      </section>

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

<style lang="scss">
.home-hero {
  position: relative;
  z-index: 0;
  display: flex;
  min-height: 430px;
  align-items: center;
  width: 100%;
  margin: 0 0 56px;
  padding: 58px 0 46px;
  isolation: isolate;
}

.home-hero::before {
  position: absolute;
  inset: 0 0 -110px;
  z-index: -1;
  background:
    radial-gradient(ellipse at center, rgba(249, 249, 246, 0.04) 0%, rgba(249, 249, 246, 0.38) 44%, rgba(249, 249, 246, 0.96) 100%),
    linear-gradient(90deg, rgba(249, 249, 246, 0.98) 0%, rgba(249, 249, 246, 0.78) 34%, rgba(249, 249, 246, 0.28) 72%, rgba(249, 249, 246, 0.08) 100%),
    url("/img/hero_img.jpg");
  background-position: center;
  background-size: cover;
  content: "";
  mask-image: radial-gradient(ellipse 70% 62% at 50% 34%, #000 0%, #000 38%, rgba(0, 0, 0, 0.55) 60%, transparent 88%);
  -webkit-mask-image: radial-gradient(ellipse 70% 62% at 50% 34%, #000 0%, #000 38%, rgba(0, 0, 0, 0.55) 60%, transparent 88%);
}

.home-hero-copy {
  max-width: 680px;
}

.home-hero h1 {
  margin: 0;
  color: $ink-deep;
  font-size: clamp(2.4rem, 6vw, 5rem);
  line-height: 0.96;
}

.home-hero-copy > p:last-child {
  max-width: 580px;
  margin: 20px 0 0;
  color: $slate;
  font-size: 1.04rem;
  font-weight: 650;
  line-height: 1.55;
}

.home-actions {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 24px;
}

.home-primary {
  min-height: 44px;
  border-radius: 8px;
  padding: 11px 15px;
  font-size: 0.92rem;
  font-weight: 850;
  background: $brand;
  color: #ffffff;
  box-shadow: 0 16px 38px rgba(252, 76, 2, 0.28);
}

.waypoint-section {
  position: relative;
  z-index: 1;
  width: 100%;
  margin: 0;
  padding: 0 0 54px;
}

.section-heading {
  padding-top: 24px;
  margin-bottom: 44px;
}

.section-heading h2 {
  display: inline-block;
  margin: 0;
  border-bottom: 3px solid $brand;
  padding-bottom: 8px;
  color: $ink-deep;
  font-size: 1.35rem;
}

.waypoint-stage {
  position: relative;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: 24px;
  row-gap: 90px;
  margin-top: 20px;
  padding-bottom: 20px;
}

.waypoint-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.waypoint-guide,
.waypoint-route {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.waypoint-guide {
  stroke: rgba(127, 140, 153, 0.3);
  stroke-dasharray: 0.1 12;
  stroke-width: 2.5;
}

.waypoint-route {
  stroke: $brand;
  stroke-width: 4;
}

.waypoint-marker {
  fill: $brand;
  filter: drop-shadow(0 10px 18px rgba(252, 76, 2, 0.28));
}

.waypoint-card {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  border: 1px solid rgba(127, 140, 153, 0.18);
  border-radius: 16px;
  padding: 26px 28px 24px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 24px 52px rgba(31, 41, 51, 0.1);
  backdrop-filter: blur(12px) saturate(130%);
  -webkit-backdrop-filter: blur(12px) saturate(130%);
}

.waypoint-card::before {
  position: absolute;
  top: 0;
  left: 28px;
  width: 52px;
  height: 4px;
  border-radius: 0 0 4px 4px;
  background: $brand;
  content: "";
}

.waypoint-target {
  position: absolute;
  width: 18px;
  height: 18px;
  visibility: hidden;
  pointer-events: none;
}

.waypoint-card.is-step-1 {
  grid-row: 1;
  grid-column: 2 / 7;
}

.waypoint-card.is-step-1 .waypoint-target {
  top: 50%;
  right: -9px;
  left: auto;
  transform: translateY(-50%);
}

.waypoint-card.is-step-2 {
  grid-row: 2;
  grid-column: 7 / 12;
}

.waypoint-card.is-step-2 .waypoint-target {
  top: 50%;
  left: -9px;
  transform: translateY(-50%);
}

.waypoint-card.is-step-3 {
  grid-row: 3;
  grid-column: 4 / 9;
}

.waypoint-card.is-step-3 .waypoint-target {
  top: -9px;
  left: 50%;
  right: auto;
  transform: translateX(-50%);
}

.waypoint-card .home-eyebrow {
  margin: 0;
}

.waypoint-card h3 {
  margin: 0;
  color: $ink-deep;
  font-size: clamp(1.3rem, 2vw, 1.75rem);
  line-height: 1.12;
}

.waypoint-card p:not(.home-eyebrow) {
  margin: 0;
  color: $slate;
  font-size: 0.95rem;
  font-weight: 650;
  line-height: 1.55;
}

.waypoint-card p a {
  color: $brand;
  font-weight: 750;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.waypoint-card p a:hover {
  color: $brand-dark;
}

.waypoint-card-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  color: $brand;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.waypoint-card-meta::after {
  content: "→";
  font-size: 0.9rem;
}

.closing-section {
  padding: 20px 0 64px;
}

.closing-panel {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  padding: 46px 48px;
  background: linear-gradient(135deg, #1b2733, #101820);
  color: #f4f6f8;
  box-shadow: 0 30px 60px rgba(16, 24, 32, 0.28);
}

.closing-panel::before,
.closing-panel::after {
  position: absolute;
  width: 360px;
  height: 360px;
  border-radius: 999px;
  content: "";
  pointer-events: none;
}

.closing-panel::before {
  top: -160px;
  right: -120px;
  background: radial-gradient(circle, rgba(255, 79, 0, 0.32), transparent 70%);
}

.closing-panel::after {
  bottom: -220px;
  left: -140px;
  background: radial-gradient(circle, rgba(255, 79, 0, 0.16), transparent 70%);
}

.closing-panel > * {
  position: relative;
  z-index: 1;
}

.closing-panel h2 {
  margin: 0 0 14px;
  color: #ffffff;
  font-size: clamp(1.6rem, 3vw, 2.3rem);
  line-height: 1.08;
}

.closing-panel > p:not(.home-eyebrow) {
  max-width: 560px;
  margin: 0 0 24px;
  color: rgba(244, 246, 248, 0.76);
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.6;
}

.closing-points {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 0 28px;
  padding: 0;
  list-style: none;
}

.closing-points li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(244, 246, 248, 0.92);
  font-size: 0.85rem;
  font-weight: 700;
}

.closing-points li::before {
  content: "✓";
  color: $brand;
  font-weight: 900;
}

@media (max-width: 980px) {
  .waypoint-stage {
    row-gap: 80px;
  }

  .waypoint-card.is-step-1 {
    grid-column: 1 / 8;
  }

  .waypoint-card.is-step-2 {
    grid-column: 6 / 13;
  }

  .waypoint-card.is-step-3 {
    grid-column: 3 / 10;
  }
}

@media (max-width: 760px) {
  .home-hero {
    grid-template-columns: 1fr;
    gap: 22px;
    padding: 36px 0 30px;
  }

  .home-hero h1 {
    font-size: clamp(2.15rem, 14vw, 3.6rem);
  }

  .home-hero-copy > p:last-child {
    margin-top: 16px;
    font-size: 0.94rem;
  }

  .home-actions {
    align-items: stretch;
  }

  .home-primary {
    flex: 1 1 0;
  }

  .waypoint-section {
    padding-bottom: 36px;
  }

  .section-heading {
    margin-bottom: 10px;
  }

  .waypoint-stage {
    grid-template-columns: 1fr;
    row-gap: 14px;
    margin-top: 18px;
    padding-top: 14px;
    padding-bottom: 0;
  }

  .waypoint-canvas {
    inset: 0;
    opacity: 0.28;
  }

  .waypoint-card.is-step-1,
  .waypoint-card.is-step-2,
  .waypoint-card.is-step-3 {
    grid-row: auto;
    grid-column: 1;
  }

  .closing-section {
    padding-bottom: 44px;
  }

  .closing-panel {
    padding: 30px 24px;
  }
}
</style>
