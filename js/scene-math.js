/* scene-math.js — script thường (không phải module). Sinh từ scene-math.mjs. */
(() => {
'use strict';
const clamp01 = (value) => Math.min(1, Math.max(0, value));

function getPanoramaOffset(elapsedSeconds, durationSeconds) {
  if (durationSeconds <= 0) return 0;
  const cycle = ((elapsedSeconds % durationSeconds) + durationSeconds) % durationSeconds / durationSeconds;

  // A normal photo cannot wrap cleanly like an equirectangular panorama.
  // Ease left-to-right and back so neither the image seam nor a speed snap is visible.
  return 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

const phaseProgress = (progress, start, end) =>
  clamp01((progress - start) / (end - start));

function interpolatePoint3(collapsed, expanded, progress) {
  const t = clamp01(progress);
  return [
    collapsed[0] + (expanded[0] - collapsed[0]) * t,
    collapsed[1] + (expanded[1] - collapsed[1]) * t,
    collapsed[2] + (expanded[2] - collapsed[2]) * t,
  ];
}

function getWavyLinkPoint(from, to, t, link, elapsedSeconds) {
  if (t <= 0) return [from.x, from.y, from.z];
  if (t >= 1) return [to.x, to.y, to.z];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(0.0001, Math.hypot(dx, dy));
  const envelope = Math.sin(Math.PI * t);
  const wave = Math.sin(t * Math.PI * 2 * link.waves + link.phase + elapsedSeconds * link.speed)
    * link.amplitude * envelope;
  return [
    from.x + dx * t + (-dy / length) * wave,
    from.y + dy * t + (dx / length) * wave,
    from.z + (to.z - from.z) * t + 0.01 * envelope,
  ];
}

function getResponsiveMode(width, reducedMotion, webglAvailable) {
  // 27/8: mobile chạy canvas luôn — 'static' (orbit) chỉ còn cho
  // reduced-motion hoặc khi WebGL/three không có.
  if (reducedMotion || !webglAvailable) return 'static';
  if (width <= 767) return 'mobile';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

function getPointerTarget(clientX, clientY, rect) {
  const nx = clamp01((clientX - rect.left) / rect.width) * 2 - 1;
  const ny = clamp01((clientY - rect.top) / rect.height) * 2 - 1;
  const x = -ny * 4.5 * Math.PI / 180;
  return {
    x: Object.is(x, -0) ? 0 : x,
    y: nx * 7 * Math.PI / 180,
  };
}

function mapSceneState(progress, viewportWidth) {
  const normalized = clamp01(progress);
  // With a 450vh section, ~0.14 progress is roughly five standard wheel
  // notches. Card pull and the first structural lines start together there.
  const firstPull = smoothstep(0.12, 0.18, normalized);
  const secondPull = smoothstep(0.18, 0.35, normalized);
  const finalPull = smoothstep(0.35, 0.45, normalized);
  const cardScale = 1
    + (0.78 - 1) * firstPull
    + (0.38 - 0.78) * secondPull
    + (0.2 - 0.38) * finalPull;
  const pull = clamp01((1 - cardScale) / 0.8);
  const primaryNetworkMorph = smoothstep(0.12, 0.24, normalized);
  const networkMorph = smoothstep(0.2, 0.35, normalized);
  const primaryConnectorReveal = smoothstep(0.12, 0.24, normalized);
  const connectorReveal = smoothstep(0.22, 0.35, normalized);
  const networkEnter = smoothstep(0.12, 0.18, normalized);
  const panelReveal = smoothstep(0.24, 0.34, normalized);
  const denseNetworkMorph = smoothstep(0.38, 0.6, normalized);
  const denseConnectorReveal = smoothstep(0.38, 0.52, normalized);
  const densePanelReveal = smoothstep(0.42, 0.56, normalized);
  const denseProgress = smoothstep(0.42, 0.72, normalized);
  const boxMix = smoothstep(0.4, 0.62, normalized);
  const flowDotOpacity = smoothstep(0.38, 0.45, normalized);
  const nextCopyOpacity = smoothstep(0.38, 0.44, normalized);
  const copyExit = smoothstep(0.18, 0.29, normalized);
  const tabletFactor = viewportWidth <= 1024 ? 0.9 : 1;
  // Mobile: the intro heading stays visible for the whole scroll so the
  // section never reads as an unlabeled animation.
  const keepCopy = viewportWidth <= 767;

  return {
    cardScale,
    cameraZ: (7.2 + (11.5 - 7.2) * pull) / tabletFactor,
    compactPathMix: 1 - smoothstep(0.18, 0.28, normalized),
    expandedPathMix: networkEnter,
    primaryNetworkMorph,
    networkMorph,
    denseNetworkMorph,
    denseConnectorReveal,
    densePanelReveal,
    primaryConnectorReveal,
    connectorReveal,
    panelReveal,
    flowDotOpacity,
    denseProgress,
    boxMix,
    rootLift: panelReveal * 0.28 + denseProgress * 0.47,
    nextCopyOpacity,
    nextCopyY: 20 * (1 - nextCopyOpacity),
    panelScale: 0.2 + networkMorph * 0.8,
    copyOpacity: keepCopy ? 1 : (normalized >= 0.27 ? 0 : 1 - copyExit),
    copyY: keepCopy ? 0 : -32 * copyExit,
    networkOpacity: 0.86 + 0.14 * pull,
  };
}

window.SH = Object.assign(window.SH || {}, { clamp01, smoothstep, getPanoramaOffset, phaseProgress, interpolatePoint3, getWavyLinkPoint, getResponsiveMode, getPointerTarget, mapSceneState });
})();
