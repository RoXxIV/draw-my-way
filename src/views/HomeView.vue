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
      'Utilisez vos parcours comme matière première : une forme, un mot, une ligne symbolique, ou juste une trace qui raconte quelque chose.',
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
      y: Math.max(12, points[0].y - 170),
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
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const normalX = -deltaY / distance;
    const normalY = deltaX / distance;
    const swing = gsap.utils.clamp(70, 190, distance * 0.34);
    const direction = index % 2 === 0 ? 1 : -1;
    const detours = distance < 240
      ? []
      : [
        { at: 0.3, side: direction },
        { at: 0.72, side: -direction * 0.9 },
      ];

    detours.forEach(({ at, side }) => {
      points.push({
        x: gsap.utils.clamp(12, bounds.width - 12, previous.x + deltaX * at + normalX * swing * side),
        y: previous.y + deltaY * at + normalY * swing * side,
      });
    });

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
            <header class="waypoint-card-top">
              <span class="waypoint-card-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <p class="home-eyebrow">{{ step.eyebrow }}</p>
            </header>
            <h3>{{ step.title }}</h3>
            <p>{{ step.description }}</p>
            <span class="waypoint-card-meta">{{ step.meta }}</span>
          </article>
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
