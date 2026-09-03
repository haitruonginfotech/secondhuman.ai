export const INTRO_COPY = Object.freeze({
  label: 'CLIENT_BRIEF_HERO_COPY',
  heading: 'Give Us Your Hardest Problems.',
  supporting: 'We build, deploy and operate AI systems that solve them where outcomes matter most.',
});

export const NEXT_COPY = Object.freeze({
  heading: 'Secondhuman.ai bridges the gap between AI models & business outcomes.',
  supporting: 'We are determined to build radically more profitable businesses with you.',
});

export const SCENE_LIMITS = Object.freeze({
  introEnd: 0.3,
  transitionEnd: 0.75,
  maxTiltX: 8 * Math.PI / 180,
  maxTiltY: 14 * Math.PI / 180,
  damping: 0.085,
  cardAspect: 16 / 9,
  panoramaPanSeconds: 18,
});

function seededRandom(seedValue) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function buildTriangleNetwork() {
  const random = seededRandom(0x5ca1e);
  const nodes = Array.from({ length: 32 }, (_, index) => {
    let x = -0.88 + random() * 1.76;
    let y = -0.55 + random() * 1.1;
    if (Math.abs(x) < 0.14 && Math.abs(y) < 0.12) x += x < 0 ? -0.2 : 0.2;
    return Object.freeze({
      id: `triangle-node-${index + 1}`,
      position: Object.freeze([x, y, 0.16 + random() * 0.025]),
      rotation: -Math.PI + random() * Math.PI * 2,
      size: 0.025 + random() * 0.012,
    });
  });

  const usedPairs = new Set();
  const links = Array.from({ length: 5 }, (_, slotIndex) => {
    const pairs = [];
    while (pairs.length < 8) {
      const fromIndex = Math.floor(random() * nodes.length);
      const toIndex = Math.floor(random() * nodes.length);
      if (fromIndex === toIndex) continue;
      const key = [fromIndex, toIndex].sort((a, b) => a - b).join(':');
      const [fromX, fromY] = nodes[fromIndex].position;
      const [toX, toY] = nodes[toIndex].position;
      const distance = Math.hypot(toX - fromX, toY - fromY);
      if (usedPairs.has(key) || distance < 0.42 || distance > 1.65) continue;
      usedPairs.add(key);
      pairs.push(Object.freeze({
        fromId: nodes[fromIndex].id,
        toId: nodes[toIndex].id,
      }));
    }

    return Object.freeze({
      id: `triangle-link-slot-${slotIndex + 1}`,
      pairs: Object.freeze(pairs),
      amplitude: 0.025 + random() * 0.02,
      waves: 0.8 + random() * 0.45,
      phase: random() * Math.PI * 2,
      speed: 0.45 + random() * 0.55,
      cycleOffset: slotIndex * 0.93,
      holdDuration: 3.35,
      fadeDuration: 0.65,
      gapDuration: 0.75,
    });
  });

  return Object.freeze({
    nodes: Object.freeze(nodes),
    links: Object.freeze(links),
  });
}

const TRIANGLE_NETWORK = buildTriangleNetwork();
export const TRIANGLE_NODES = TRIANGLE_NETWORK.nodes;
export const TRIANGLE_LINKS = TRIANGLE_NETWORK.links;

function buildDenseNetwork() {
  const paths = [];
  const panels = [];
  // The dense topology is arranged on the front and rear faces of a cuboid.
  // The red box in the visual reference is only an annotation; these anchors
  // make the network itself describe that volume without rendering an outline.
  const cuboidAnchors = [
    [-1.04, 0.84, 1.2], [-0.18, 0.96, -1.2], [0.78, 0.82, 1.2], [1.04, 0.5, -1.2],
    [-1.08, 0.2, -1.2], [-0.64, 0.38, 1.2], [0.48, 0.4, -1.2], [1.08, 0.1, 1.2],
    [-1.06, -0.3, 1.2], [-0.42, -0.18, -1.2], [0.5, -0.22, 1.2], [1.04, -0.36, -1.2],
    [-0.96, -0.84, -1.2], [-0.18, -0.98, 1.2], [0.74, -0.86, -1.2], [1, -0.74, 1.2],
    [-0.7, 0.02, -0.4], [0.72, -0.02, 0.4],
  ];
  const boxX = 1.04;
  const boxY = 0.84;
  const frontZ = 1.2;
  const backZ = -1.2;
  const trunkRoutes = [
    [[-boxX, boxY, frontZ], [0, boxY + 0.09, frontZ], [boxX, boxY, frontZ]],
    [[-boxX, 0, frontZ], [0, -0.06, frontZ], [boxX, 0, frontZ]],
    [[-boxX, -boxY, frontZ], [0, -boxY - 0.08, frontZ], [boxX, -boxY, frontZ]],
    [[-boxX, boxY, frontZ], [-boxX - 0.06, 0, frontZ], [-boxX, -boxY, frontZ]],
    [[boxX, boxY, frontZ], [boxX + 0.06, 0, frontZ], [boxX, -boxY, frontZ]],
    [[-boxX, boxY, backZ], [0, boxY - 0.07, backZ], [boxX, boxY, backZ]],
    [[-boxX, 0, backZ], [0, 0.07, backZ], [boxX, 0, backZ]],
    [[-boxX, -boxY, backZ], [0, -boxY + 0.08, backZ], [boxX, -boxY, backZ]],
    [[-boxX, boxY, backZ], [-boxX + 0.06, 0, backZ], [-boxX, -boxY, backZ]],
    [[boxX, boxY, backZ], [boxX - 0.06, 0, backZ], [boxX, -boxY, backZ]],
  ];

  trunkRoutes.forEach((route, index) => {
    paths.push(Object.freeze({
      id: `dense-major-trunk-${index + 1}`,
      mode: 'expanded',
      motionDelay: 0.24 + index * 0.022,
      points: route,
    }));
  });

  const clusters = [
    [-0.15, 0.25, -0.46, 0.72, -1, 0.2, 0.3, 0.2],
    [-0.46, 0.72, -0.82, 1.02, -1, 0.25, 0.25, 0.18],
    [-0.55, 0.5, -1.06, 0.64, -1, 0, 0.23, 0.25],
    [-0.62, 0.18, -1.15, 0.28, -1, -0.1, 0.2, 0.24],
    [-0.58, -0.12, -1.04, -0.26, -1, -0.2, 0.23, 0.22],
    [-0.52, -0.42, -0.86, -0.72, -0.8, -0.35, 0.24, 0.2],
    [-0.7, -0.72, -1.06, -1.06, -0.5, -0.5, 0.2, 0.17],
    [-0.3, -0.54, -0.55, -1.02, -0.45, -0.65, 0.22, 0.2],
    [0.04, 0.54, 0.34, 0.96, 0.25, 0.75, 0.2, 0.24],
    [0.34, 0.96, 0.72, 1.2, 0.45, 0.45, 0.24, 0.17],
    [0.56, 0.84, 1.04, 0.88, 0.75, 0.1, 0.23, 0.22],
    [0.32, 0.5, 0.66, 0.62, 0.7, 0.1, 0.22, 0.19],
    [0.42, 0.3, 0.98, 0.36, 0.8, -0.1, 0.23, 0.23],
    [0.46, 0.04, 1.08, 0, 0.8, -0.15, 0.2, 0.23],
    [0.3, -0.18, 0.86, -0.42, 0.7, -0.4, 0.22, 0.2],
    [0.42, -0.48, 1.02, -0.78, 0.7, -0.45, 0.22, 0.18],
    [0.08, -0.34, 0.46, -0.72, 0.5, -0.55, 0.22, 0.23],
    [0, -0.52, 0.16, -1, 0.2, -0.65, 0.18, 0.19],
  ];

  clusters.forEach(([, , , , biasX, biasY, spreadX, spreadY], clusterIndex) => {
    const [hubX, hubY, layerZ] = cuboidAnchors[clusterIndex];
    const parentX = hubX + (clusterIndex % 2 === 0 ? 0 : Math.sign(hubX || 1) * -0.24);
    const parentY = hubY + (clusterIndex % 2 === 0 ? Math.sign(hubY || 1) * -0.18 : 0);
    const side = Math.sign(biasX) || Math.sign(hubX) || 1;
    const branchId = `dense-branch-${clusterIndex + 1}`;
    const branchDelay = 0.34 + (clusterIndex % 7) * 0.032;
    const verticalFirst = clusterIndex % 3 === 0;

    paths.push(Object.freeze({
      id: branchId,
      mode: 'expanded',
      motionDelay: branchDelay,
      points: verticalFirst
        ? [[parentX, parentY, layerZ * 0.72], [parentX, parentY, layerZ], [parentX, hubY, layerZ], [hubX, hubY, layerZ]]
        : [[parentX, parentY, layerZ * 0.72], [parentX, parentY, layerZ], [hubX, parentY, layerZ], [hubX, hubY, layerZ]],
    }));

    for (let nodeIndex = 0; nodeIndex < 5; nodeIndex += 1) {
      const seed = clusterIndex * 29 + nodeIndex * 13 + 5;
      const waveX = Math.sin(seed * 1.113);
      const waveY = Math.cos(seed * 1.731);
      const nodeX = Math.max(-1.2, Math.min(1.2, hubX + biasX * (0.04 + nodeIndex * 0.018) + waveX * spreadX * 0.72));
      const nodeY = Math.max(-1.16, Math.min(1.16, hubY + biasY * (0.04 + nodeIndex * 0.018) + waveY * spreadY * 0.82));
      const elbowX = clusterIndex % 2 === 0 ? hubX : nodeX * 0.72 + hubX * 0.28;
      const elbowY = clusterIndex % 2 === 0 ? nodeY * 0.72 + hubY * 0.28 : hubY;
      const id = `dense-node-${clusterIndex + 1}-${nodeIndex + 1}`;
      const pathId = `${id}-connector`;
      const motionDelay = branchDelay + nodeIndex * 0.022;

      paths.push(Object.freeze({
        id: pathId,
        mode: 'expanded',
        motionDelay,
        points: clusterIndex % 2 === 0
          ? [[hubX, hubY, layerZ], [hubX, elbowY, layerZ], [nodeX, elbowY, layerZ], [nodeX, nodeY, layerZ]]
          : [[hubX, hubY, layerZ], [elbowX, hubY, layerZ], [elbowX, nodeY, layerZ], [nodeX, nodeY, layerZ]],
      }));

      panels.push(Object.freeze({
        id,
        pathId,
        t: 0.97,
        width: 0.068 + (seed % 5) * 0.015,
        height: 0.043 + (seed % 4) * 0.011,
        rotation: waveY * 0.08,
        motionDelay,
      }));
    }
  });

  const crossLinks = [
    [0, 8], [2, 11], [3, 12], [4, 13], [5, 14], [6, 16], [7, 17],
  ];

  crossLinks.forEach(([fromIndex, toIndex], index) => {
    const [fromX, fromY, fromZ] = cuboidAnchors[fromIndex];
    const [toX, toY, toZ] = cuboidAnchors[toIndex];
    const bendY = (fromY + toY) * 0.5 + (index % 2 ? -0.1 : 0.09);

    paths.push(Object.freeze({
      id: `dense-cross-link-${index + 1}`,
      mode: 'expanded',
      motionDelay: 0.42 + index * 0.024,
      points: [
        [fromX, fromY, fromZ],
        [fromX, bendY, fromZ],
        [fromX, bendY, toZ],
        [toX, bendY, toZ],
        [toX, toY, toZ],
      ],
    }));
  });

  // Four gently curved depth bridges close the two distributed faces into a
  // readable cuboid without turning the network into a rigid wireframe.
  const depthBridges = [
    [[-boxX, boxY, frontZ], [-boxX - 0.08, boxY + 0.04, 0], [-boxX, boxY, backZ]],
    [[boxX, boxY, frontZ], [boxX + 0.08, boxY - 0.04, 0], [boxX, boxY, backZ]],
    [[-boxX, -boxY, frontZ], [-boxX + 0.07, -boxY - 0.04, 0], [-boxX, -boxY, backZ]],
    [[boxX, -boxY, frontZ], [boxX - 0.07, -boxY + 0.04, 0], [boxX, -boxY, backZ]],
  ];

  depthBridges.forEach((points, index) => {
    paths.push(Object.freeze({
      id: `dense-depth-bridge-${index + 1}`,
      mode: 'expanded',
      motionDelay: 0.38 + index * 0.025,
      points,
    }));
  });

  return Object.freeze({
    paths: Object.freeze(paths),
    panels: Object.freeze(panels),
  });
}

const DENSE_NETWORK = buildDenseNetwork();

// These are the first structural strokes visible while the hero card pulls
// apart. They draw from the card centre before the dense network joins in.
export const PRIMARY_EXPANDED_PATH_IDS = Object.freeze([
  'expanded-west',
  'expanded-east',
  'expanded-north',
  'expanded-south',
  'expanded-northwest',
]);

export const BASE_EXPANDED_PATH_IDS = Object.freeze([
  ...PRIMARY_EXPANDED_PATH_IDS,
  'expanded-northeast',
  'expanded-southwest',
  'expanded-southeast',
]);

export const PATHS = Object.freeze([
  { id: 'compact-orbit-top', mode: 'compact', points: [[-0.64, 0.18, 0.08], [-0.52, 0.58, 0.05], [0.05, 0.62, 0.02], [0.58, 0.45, 0.04], [0.28, 0.08, 0.08]] },
  { id: 'compact-orbit-left', mode: 'compact', points: [[-0.52, 0.55, 0.04], [-0.82, 0.25, 0.05], [-0.68, -0.02, 0.08], [-0.08, -0.08, 0.1], [0.34, 0.15, 0.06]] },
  { id: 'compact-orbit-bottom', mode: 'compact', points: [[-0.62, -0.2, 0.05], [-0.35, -0.58, 0.08], [0.16, -0.42, 0.09], [0.52, -0.05, 0.06], [0.7, -0.18, 0.05]] },
  { id: 'compact-loop-center', mode: 'compact', points: [[-0.12, 0.48, 0.12], [0.2, 0.32, 0.14], [0.05, -0.24, 0.14], [-0.25, -0.38, 0.12], [-0.42, 0.02, 0.1], [0.16, 0.08, 0.13]] },
  { id: 'expanded-west', mode: 'expanded', points: [[0, 0, 0.08], [-0.35, 0, 0.08], [-0.72, 0, 0.08], [-1.08, 0, 0.08], [-1.38, 0, 0.08]] },
  { id: 'expanded-east', mode: 'expanded', points: [[0, 0, 0.08], [0.35, 0, 0.08], [0.72, 0, 0.08], [1.08, 0, 0.08], [1.38, 0, 0.08]] },
  { id: 'expanded-north', mode: 'expanded', points: [[0, 0, 0.08], [0, 0.3, 0.08], [0, 0.62, 0.08], [0, 0.94, 0.08], [0, 1.22, 0.08]] },
  { id: 'expanded-south', mode: 'expanded', points: [[0, 0, 0.08], [0, -0.3, 0.08], [0, -0.62, 0.08], [0, -0.94, 0.08], [0, -1.22, 0.08]] },
  { id: 'expanded-northwest', mode: 'expanded', points: [[0, 0, 0.08], [-0.42, 0, 0.08], [-0.82, 0, 0.08], [-0.82, 0.42, 0.08], [-0.82, 0.76, 0.08]] },
  { id: 'expanded-northeast', mode: 'expanded', points: [[0, 0, 0.08], [0.42, 0, 0.08], [0.82, 0, 0.08], [0.82, 0.42, 0.08], [0.82, 0.76, 0.08]] },
  { id: 'expanded-southwest', mode: 'expanded', points: [[0, 0, 0.08], [-0.42, 0, 0.08], [-0.82, 0, 0.08], [-0.82, -0.42, 0.08], [-0.82, -0.76, 0.08]] },
  { id: 'expanded-southeast', mode: 'expanded', points: [[0, 0, 0.08], [0.42, 0, 0.08], [0.82, 0, 0.08], [0.82, -0.42, 0.08], [0.82, -0.76, 0.08]] },
  ...DENSE_NETWORK.paths,
]);

export const PANELS = Object.freeze([
  { id: 'panel-west-upper', pathId: 'expanded-northwest', t: 0.64, width: 0.26, height: 0.14, rotation: -0.08, motionDelay: 0.02 },
  { id: 'panel-west-middle', pathId: 'expanded-west', t: 0.63, width: 0.24, height: 0.13, rotation: 0.02, motionDelay: 0 },
  { id: 'panel-west-lower', pathId: 'expanded-southwest', t: 0.66, width: 0.25, height: 0.14, rotation: -0.05, motionDelay: 0.13 },
  { id: 'panel-north', pathId: 'expanded-north', t: 0.68, width: 0.18, height: 0.11, rotation: 0.03, motionDelay: 0.06 },
  { id: 'panel-east-upper', pathId: 'expanded-northeast', t: 0.62, width: 0.22, height: 0.13, rotation: 0.04, motionDelay: 0.08 },
  { id: 'panel-east-middle', pathId: 'expanded-east', t: 0.56, width: 0.2, height: 0.12, rotation: -0.02, motionDelay: 0.04 },
  { id: 'panel-east-lower', pathId: 'expanded-southeast', t: 0.58, width: 0.27, height: 0.15, rotation: 0.04, motionDelay: 0.15 },
  ...DENSE_NETWORK.panels,
]);

const markerSeeds = [
  ['compact-orbit-top', 0.12], ['compact-orbit-top', 0.32], ['compact-orbit-top', 0.55],
  ['compact-orbit-left', 0.18], ['compact-orbit-left', 0.46], ['compact-orbit-bottom', 0.22],
  ['compact-orbit-bottom', 0.5], ['compact-loop-center', 0.16], ['compact-loop-center', 0.68],
  ['expanded-west', 0.22], ['expanded-west', 0.55], ['expanded-east', 0.24],
  ['expanded-east', 0.6], ['expanded-north', 0.3], ['expanded-north', 0.7],
  ['expanded-south', 0.32], ['expanded-south', 0.72], ['expanded-northwest', 0.36],
  ['expanded-northwest', 0.76], ['expanded-northeast', 0.42], ['expanded-northeast', 0.78],
  ['expanded-southwest', 0.44], ['expanded-southeast', 0.38], ['expanded-southeast', 0.78],
];

export const MARKERS = Object.freeze(markerSeeds.map(([pathId, t], index) => Object.freeze({
  id: `marker-${String(index + 1).padStart(2, '0')}`,
  pathId,
  t,
  speed: 0.006 + (index % 5) * 0.0015,
  size: index % 3 === 0 ? 0.045 : 0.035,
})));

export function validateSceneModel(paths, panels, markers) {
  const pathIds = new Set(paths.map((path) => path.id));
  const errors = [];

  panels.forEach((panel) => {
    if (!pathIds.has(panel.pathId)) {
      errors.push(`Panel ${panel.id} references missing path ${panel.pathId}`);
    }
  });

  markers.forEach((marker) => {
    if (!pathIds.has(marker.pathId)) {
      errors.push(`Marker ${marker.id} references missing path ${marker.pathId}`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export const PROBLEM_LABELS = Object.freeze([
  'Rising Costs', 'Declining Sales', 'Shrinking Margins', 'Manpower Shortages',
  'Cashflow Issues', 'Overworked Teams', 'Leads Going Cold', 'Overdue Receivables',
  'Lost Customers', 'Poor Sales Conversion', 'Capital Inefficiency', 'Low Productivity',
  'Operational Bottlenecks', 'Overdue Payments', 'Inventory Buildup', 'Decision Delays',
  'Data Errors', 'System Silos', 'Talent Shortage', 'Information Gaps',
  'Quality Issues', 'Cost Leakage',
]);
