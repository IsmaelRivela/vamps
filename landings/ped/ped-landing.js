import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PED_SCREEN_HEIGHT = 0.16;
const VAMPS = "/vamps/";
const PORTFOLIO = "/creative/";
const JOG_SPEED = 2.45;
const WANDER_SPEED = 1.65;
const TURN_TIME = 0.66;
const PUNCH_REACH = 0.62;
const PED_BACK = -1.45;
const WALK_X = 1.5;
const WALK_Z_MIN = -2.05;
const WALK_Z_MAX = -0.55;

const canvas = document.getElementById("stage");
const labelVamps = document.getElementById("label-vamps");
const labelWork = document.getElementById("label-work");

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setClearColor(0xf3f3f1, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f3f1);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(90, 90),
  new THREE.MeshBasicMaterial({ color: 0xf3f3f1 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const clickArrow = makeClickArrow();
scene.add(clickArrow.group);
let clickArrowTime = 0;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.42, 28),
  new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.012;
scene.add(shadow);

const root = new THREE.Group();
const actor = new THREE.Group();
const hold = new THREE.Group();
actor.add(hold);
root.add(actor);
scene.add(root);

const clock = new THREE.Clock();
const box = new THREE.Box3();
const size = new THREE.Vector3();
const center = new THREE.Vector3();
const ndc = new THREE.Vector3();
const rayDir = new THREE.Vector3();

const actions = {};
let mixer = null;
let current = null;
let pedModel = null;
let pedReady = false;
let pedHeight = 1.9;
let busy = false;
let scratchTimer = 0;
let nextScratch = 99;
let turn = null;
let trip = null;
let wander = null;
let afterScratchHold = null;
let wantFlip = false;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
  if (pedReady) framePed();
}

function toBasic(mat) {
  const map = mat.map || null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }
  return new THREE.MeshBasicMaterial({
    map,
    transparent: mat.transparent,
    alphaTest: mat.alphaTest || 0.4,
    side: mat.side,
  });
}

const _pt = new THREE.Vector3();

function bodyBox(obj) {
  box.makeEmpty();
  obj.updateWorldMatrix(true, true);
  obj.traverse((child) => {
    if (child.isBone) {
      child.getWorldPosition(_pt);
      box.expandByPoint(_pt);
    }
    if (!child.isMesh || !child.geometry) return;
    if (child.isSkinnedMesh && child.skeleton) {
      child.skeleton.bones.forEach((bone) => {
        bone.getWorldPosition(_pt);
        box.expandByPoint(_pt);
      });
    }
    child.geometry.computeBoundingBox();
    if (!child.geometry.boundingBox) return;
    const b = child.geometry.boundingBox.clone();
    b.applyMatrix4(child.matrixWorld);
    box.union(b);
  });
  return box;
}

function centerPed() {
  hold.position.set(0, 0, 0);
  actor.position.set(0, 0, 0);
  actor.rotation.y = 0;
  root.position.set(0, 0, 0);
  const b = bodyBox(root);
  if (b.isEmpty()) return false;
  b.getSize(size);
  b.getCenter(center);
  const height = Math.max(size.y, 1.89);
  const pivot = pedModel
    ? pedModel.getObjectByName("Pelvis") || pedModel.getObjectByName("Root")
    : null;
  if (pivot) {
    pivot.getWorldPosition(_pt);
    hold.position.set(-_pt.x, 0, -_pt.z);
  } else {
    hold.position.set(-center.x, 0, -center.z);
  }
  const grounded = bodyBox(root);
  hold.position.y -= grounded.min.y;
  actor.position.set(0, 0, PED_BACK);
  pedHeight = height;
  return true;
}

function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

function isMobile() {
  return window.innerWidth < 820 || window.innerHeight < 520;
}

function framePed() {
  const height = Math.max(pedHeight, 1.89);
  const mobile = isMobile();
  const portrait = isPortrait();
  const screenH = mobile ? (portrait ? 0.2 : 0.22) : PED_SCREEN_HEIGHT;
  camera.fov = mobile ? (portrait ? 46 : 42) : 40;
  const fov = (camera.fov * Math.PI) / 180;
  const dist = height / screenH / (2 * Math.tan(fov / 2));
  camera.near = 0.15;
  camera.far = Math.max(90, dist * 8);
  if (portrait && mobile) {
    camera.position.set(0, height * 0.95, dist * 1.08);
    camera.lookAt(0, height * 0.24, PED_BACK * 0.35);
  } else {
    camera.position.set(0, height * 0.78, dist * 0.92);
    camera.lookAt(0, height * 0.28, PED_BACK * 0.25);
  }
  camera.updateProjectionMatrix();
}

function play(name, fade, loopOnce) {
  const next = actions[name];
  if (!next) return;
  if (current && current !== next) current.fadeOut(fade);
  next.reset();
  next.setLoop(loopOnce ? THREE.LoopOnce : THREE.LoopRepeat, loopOnce ? 1 : Infinity);
  next.clampWhenFinished = !!loopOnce;
  next.fadeIn(fade).play();
  current = next;
}

function clipTime(name) {
  const clip = actions[name] && actions[name].getClip();
  return clip ? clip.duration : 0.5;
}

function hitPlaneY(ndcX, ndcY, y) {
  ndc.set(ndcX, ndcY, 0.5).unproject(camera);
  rayDir.copy(ndc).sub(camera.position);
  if (Math.abs(rayDir.y) < 0.0001) return null;
  const t = (y - camera.position.y) / rayDir.y;
  if (t < 0.04) return null;
  return camera.position.clone().add(rayDir.multiplyScalar(t));
}

function shoulderHeight() {
  if (pedModel) {
    const names = ["L UpperArm", "R UpperArm", "Neck", "Bip01 L Clavicle"];
    for (let i = 0; i < names.length; i += 1) {
      const bone = pedModel.getObjectByName(names[i]);
      if (!bone) continue;
      bone.getWorldPosition(_pt);
      if (Number.isFinite(_pt.y)) return _pt.y;
    }
  }
  return Math.max(pedHeight, 1.89) * 0.72;
}

function wordPunchPoint(el) {
  const r = el.getBoundingClientRect();
  const ndcX = ((r.left + r.width * 0.5) / window.innerWidth) * 2 - 1;
  const ndcY = -((r.top + r.height * 0.4) / window.innerHeight) * 2 + 1;
  const y = shoulderHeight();
  const hit = hitPlaneY(ndcX, ndcY, y);
  if (hit && Number.isFinite(hit.x) && Number.isFinite(hit.z)) return hit;
  const left = el === labelVamps;
  return new THREE.Vector3(left ? -1.2 : 1.2, y, actor.position.z + 1.4);
}

function faceYaw(dx, dz) {
  return yawXZ(dx, dz);
}

function facingXZ(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

function stanceForPunch(aim) {
  const away = new THREE.Vector3(
    aim.x - camera.position.x,
    0,
    aim.z - camera.position.z
  );
  if (away.lengthSq() < 0.0001) away.set(0, 0, -1);
  away.normalize();
  const dest = new THREE.Vector3(
    aim.x + away.x * PUNCH_REACH,
    0,
    aim.z + away.z * PUNCH_REACH
  );
  const yaw = faceYaw(aim.x - dest.x, aim.z - dest.z);
  const face = facingXZ(yaw);
  const rightX = face.z;
  const rightZ = -face.x;
  dest.x -= rightX * 0.18;
  dest.z -= rightZ * 0.18;
  return { dest, punchFace: yaw };
}

function aimFistAt(target, label, correctHand) {
  actor.rotation.y = shortest(
    actor.rotation.y,
    faceYaw(target.x - actor.position.x, target.z - actor.position.z)
  );
  if (!correctHand || !pedModel || !label) return;
  const hand = pedModel.getObjectByName("R Hand") || pedModel.getObjectByName("R Finger");
  if (!hand) return;
  hand.getWorldPosition(_pt);
  _pt.project(camera);
  const r = label.getBoundingClientRect();
  const wantX = ((r.left + r.width * 0.5) / window.innerWidth) * 2 - 1;
  actor.rotation.y += (wantX - _pt.x) * 0.7;
}

function shortest(from, to) {
  let d = to - from;
  d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return from + d;
}

function yawXZ(dx, dz) {
  return Math.atan2(-dx, -dz);
}

function makeClickArrow() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.13, 0.18);
  shape.lineTo(0.05, 0.18);
  shape.lineTo(0.05, 0.42);
  shape.lineTo(-0.05, 0.42);
  shape.lineTo(-0.05, 0.18);
  shape.lineTo(-0.13, 0.18);
  shape.closePath();

  const arrow = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color: 0xff1a1a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    })
  );

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.13, 28),
    new THREE.MeshBasicMaterial({
      color: 0xff1a1a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;

  const group = new THREE.Group();
  group.add(ring);
  group.add(arrow);
  group.visible = false;
  return { group, arrow, ring };
}

function markClick(point) {
  clickArrow.group.position.set(point.x, 0, point.z);
  clickArrow.group.visible = true;
  clickArrow.arrow.material.opacity = 1;
  clickArrow.ring.material.opacity = 0.4;
  clickArrowTime = 0;
}

function hideClick() {
  clickArrow.group.visible = false;
}

function updateClickArrow(dt) {
  if (!clickArrow.group.visible) return;
  clickArrowTime += dt;
  const bob = 0.22 + Math.sin(clickArrowTime * 7.2) * 0.075;
  clickArrow.arrow.position.y = bob;
  clickArrow.arrow.rotation.y = Math.atan2(
    camera.position.x - clickArrow.group.position.x,
    camera.position.z - clickArrow.group.position.z
  );
  const pulse = 1 + (Math.sin(clickArrowTime * 5.4) * 0.5 + 0.5) * 0.55;
  clickArrow.ring.scale.set(pulse, pulse, 1);
  clickArrow.ring.material.opacity = 0.42 * (1.15 - (pulse - 1));
}

function hitGround(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(floor);
  if (!hits.length) return null;
  const p = hits[0].point.clone();
  p.y = 0;
  return p;
}

function easeToward(from, to, dt, speed) {
  const target = shortest(from, to);
  const k = 1 - Math.exp(-speed * dt);
  return from + (target - from) * k;
}

function isScratching() {
  return !!(
    actions.XPRESSscratch &&
    current === actions.XPRESSscratch &&
    actions.XPRESSscratch.isRunning()
  );
}

function startTurn() {
  if (busy || !actions.turn_180 || isScratching()) return;
  afterScratchHold = null;
  wander = null;
  play("turn_180", 0.1, true);
  turn = {
    from: actor.rotation.y,
    to: actor.rotation.y + Math.PI,
    t: 0,
    dur: Math.max(clipTime("turn_180"), TURN_TIME),
  };
}

function pickWanderPoint() {
  const bx = isPortrait() ? 1.05 : WALK_X;
  let x = actor.position.x;
  let z = actor.position.z;
  for (let i = 0; i < 10; i += 1) {
    x = (Math.random() * 2 - 1) * bx;
    z = WALK_Z_MIN + Math.random() * (WALK_Z_MAX - WALK_Z_MIN);
    if (Math.hypot(x - actor.position.x, z - actor.position.z) > 0.7) break;
  }
  return { x, z };
}

function startWander() {
  if (busy || isScratching()) return;
  afterScratchHold = null;
  const p = pickWanderPoint();
  const dx = p.x - actor.position.x;
  const dz = p.z - actor.position.z;
  const face = shortest(actor.rotation.y, yawXZ(dx, dz));
  play("run_player", 0.14, false);
  wander = { x: p.x, z: p.z, face };
}

function startIdleMove() {
  if (wantFlip && actions.turn_180) {
    wantFlip = false;
    startTurn();
    return;
  }
  wantFlip = true;
  startWander();
}

function startTrip(side) {
  if (reduced) {
    window.location.href = side === "left" ? VAMPS : PORTFOLIO;
    return;
  }
  labelVamps.classList.toggle("is-locked", side === "left");
  labelWork.classList.toggle("is-locked", side === "right");
  const label = side === "left" ? labelVamps : labelWork;
  const aim = wordPunchPoint(label);
  const stance = stanceForPunch(aim);
  goTo(stance.dest, {
    label,
    url: side === "left" ? VAMPS : PORTFOLIO,
    punchFace: shortest(actor.rotation.y, stance.punchFace),
    aim,
    showMark: false,
  });
}

function goTo(dest, opts = {}) {
  if (trip && trip.phase === "leave") return;
  turn = null;
  wander = null;
  afterScratchHold = null;
  busy = true;
  if (opts.showMark === false) hideClick();
  else markClick(dest);
  const dx = dest.x - actor.position.x;
  const dz = dest.z - actor.position.z;
  if (Math.hypot(dx, dz) < 0.12) {
    if (opts.url) {
      const face = opts.punchFace != null ? opts.punchFace : actor.rotation.y;
      actor.rotation.y = face;
      play("FightA_1", 0.08, true);
      trip = {
        dest,
        label: opts.label || null,
        url: opts.url,
        punchFace: face,
        aim: opts.aim || null,
        face,
        faceFrom: face,
        t: 0,
        hit: false,
        phase: "punch",
        turnDur: 0,
      };
      return;
    }
    busy = false;
    return;
  }
  const face = shortest(actor.rotation.y, yawXZ(dx, dz));
  const delta = face - actor.rotation.y;
  const tripBase = {
    dest,
    label: opts.label || null,
    url: opts.url || null,
    punchFace: opts.punchFace,
    aim: opts.aim || null,
    faceFrom: actor.rotation.y,
    face,
    t: 0,
    hit: false,
  };
  if (Math.abs(delta) < 0.22) {
    actor.rotation.y = face;
    play("run_player", 0.12, false);
    trip = { ...tripBase, phase: "run", turnDur: 0 };
    return;
  }
  const turnName =
    Math.abs(delta) > 2.2 ? "turn_180" : delta > 0 ? "Turn_R" : "Turn_L";
  const clip = actions[turnName];
  if (clip) {
    clip.timeScale = 1.15;
    play(turnName, 0.06, true);
  }
  trip = {
    ...tripBase,
    phase: "face",
    turnDur: clipTime(turnName) / 1.15,
  };
}

function updateTurn(dt) {
  if (!turn || busy) return;
  turn.t += dt;
  const u = Math.min(1, turn.t / turn.dur);
  const s = u * u * (3 - 2 * u);
  actor.rotation.y = turn.from + (turn.to - turn.from) * s;
  if (u >= 1) {
    actor.rotation.y = turn.to;
    turn = null;
    if (actions.XPRESSscratch) {
      play("XPRESSscratch", 0.18, true);
      scratchTimer = 0;
      nextScratch = 99;
    } else {
      play("IDLE_stance", 0.2, false);
    }
  }
}

function updateWander(dt) {
  if (!wander || busy || turn) return;
  const dx = wander.x - actor.position.x;
  const dz = wander.z - actor.position.z;
  const dist = Math.hypot(dx, dz);
  actor.rotation.y = easeToward(actor.rotation.y, wander.face, dt, 8);
  if (dist < 0.14) {
    actor.position.x = wander.x;
    actor.position.z = wander.z;
    wander = null;
    if (actions.XPRESSscratch) {
      play("XPRESSscratch", 0.18, true);
      scratchTimer = 0;
      nextScratch = 99;
    } else {
      play("IDLE_stance", 0.2, false);
      afterScratchHold = 1.2;
    }
    return;
  }
  actor.position.x += (dx / dist) * WANDER_SPEED * dt;
  actor.position.z += (dz / dist) * WANDER_SPEED * dt;
}

function updateTrip(dt) {
  if (!trip) return;
  if (trip.phase === "face") {
    trip.t += dt;
    const u = Math.min(1, trip.t / Math.max(trip.turnDur, 0.35));
    const s = u * u * (3 - 2 * u);
    actor.rotation.y = trip.faceFrom + (trip.face - trip.faceFrom) * s;
    if (u > 0.72) {
      stepToward(trip.dest, JOG_SPEED * 0.4 * dt);
    }
    if (u >= 0.88) {
      actor.rotation.y = trip.face;
      play("run_player", 0.14, false);
      trip.phase = "run";
    }
    return;
  }
  if (trip.phase === "run") {
    actor.rotation.y = trip.face;
    const reached = stepToward(trip.dest, JOG_SPEED * dt);
    if (reached) {
      if (trip.url && trip.punchFace != null) {
        const aim = shortest(actor.rotation.y, trip.punchFace);
        if (Math.abs(aim - actor.rotation.y) > 0.28) {
          trip.phase = "aim";
          trip.faceFrom = actor.rotation.y;
          trip.face = aim;
          trip.t = 0;
          const delta = aim - actor.rotation.y;
          const turnName =
            Math.abs(delta) > 2.2 ? "turn_180" : delta > 0 ? "Turn_R" : "Turn_L";
          if (actions[turnName]) {
            actions[turnName].timeScale = 1.2;
            play(turnName, 0.06, true);
          }
          trip.turnDur = clipTime(turnName) / 1.2;
          return;
        }
        actor.rotation.y = aim;
        play("FightA_1", 0.08, true);
        trip.phase = "punch";
        trip.t = 0;
        return;
      }
      if (trip.url) {
        play("FightA_1", 0.08, true);
        trip.phase = "punch";
        trip.t = 0;
        return;
      }
      trip = null;
      busy = false;
      hideClick();
      play("IDLE_stance", 0.16, false);
      afterScratchHold = 1.1;
    }
    return;
  }
  if (trip.phase === "aim") {
    trip.t += dt;
    const u = Math.min(1, trip.t / Math.max(trip.turnDur, 0.28));
    const s = u * u * (3 - 2 * u);
    actor.rotation.y = trip.faceFrom + (trip.face - trip.faceFrom) * s;
    if (u >= 1) {
      actor.rotation.y = trip.face;
      play("FightA_1", 0.08, true);
      trip.phase = "punch";
      trip.t = 0;
    }
    return;
  }
  if (trip.phase === "punch") {
    if (trip.aim) aimFistAt(trip.aim, trip.label, trip.t > 0.1);
    else if (trip.punchFace != null) actor.rotation.y = trip.punchFace;
    else actor.rotation.y = trip.face;
    trip.t += dt;
    if (!trip.hit && trip.t > 0.16) {
      trip.hit = true;
      if (trip.label) trip.label.classList.add("is-hit");
    }
    if (trip.t > clipTime("FightA_1") * 0.92) {
      window.location.href = trip.url;
      trip.phase = "leave";
    }
  }
}

function stepToward(dest, step) {
  const dx = dest.x - actor.position.x;
  const dz = dest.z - actor.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= step || dist < 0.16) {
    actor.position.x = dest.x;
    actor.position.z = dest.z;
    return true;
  }
  actor.position.x += (dx / dist) * step;
  actor.position.z += (dz / dist) * step;
  return false;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (mixer) mixer.update(dt);

  actor.position.y = 0;
  shadow.position.x = actor.position.x;
  shadow.position.z = actor.position.z;

  if (!busy && !reduced && !turn && !wander) {
    scratchTimer += dt;
    if (afterScratchHold != null && !isScratching()) {
      afterScratchHold -= dt;
      if (afterScratchHold <= 0) startIdleMove();
    } else if (
      actions.XPRESSscratch &&
      scratchTimer > nextScratch &&
      !isScratching()
    ) {
      play("XPRESSscratch", 0.2, true);
      scratchTimer = 0;
      nextScratch = 99;
    }
  }

  updateTurn(dt);
  updateWander(dt);
  updateTrip(dt);
  updateClickArrow(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function setupPed(gltf) {
  const model = gltf.scene;
  pedModel = model;
  model.rotation.y = Math.PI / 2;
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.material = Array.isArray(obj.material)
      ? obj.material.map(toBasic)
      : toBasic(obj.material);
  });
  hold.add(model);
  if (centerPed()) {
    pedReady = true;
    framePed();
  }

  mixer = new THREE.AnimationMixer(model);
  gltf.animations.forEach((clip) => {
    actions[clip.name] = mixer.clipAction(clip);
  });

  if (actions.XPRESSscratch) {
    play("XPRESSscratch", 0.01, true);
    scratchTimer = 0;
    nextScratch = 99;
  } else if (actions.IDLE_stance) {
    play("IDLE_stance", 0.01, false);
    afterScratchHold = 1.1;
  }

  mixer.addEventListener("finished", (e) => {
    if (busy || turn || wander) return;
    if (e.action === actions.XPRESSscratch) {
      play("IDLE_stance", 0.22, false);
      scratchTimer = 0;
      nextScratch = 99;
      afterScratchHold = 0.9;
    }
  });
}

function onHit(side, e) {
  e.preventDefault();
  startTrip(side);
}

function onPlaneClick(e) {
  const point = hitGround(e.clientX, e.clientY);
  if (!point) return;
  goTo(point);
}

window.addEventListener("pageshow", (e) => {
  if (e.persisted) window.location.reload();
});

resize();
window.addEventListener("resize", resize);
canvas.addEventListener("pointerdown", onPlaneClick);
labelVamps.addEventListener("click", (e) => onHit("left", e));
labelWork.addEventListener("click", (e) => onHit("right", e));

new GLTFLoader().load("/models/ped.glb", setupPed, undefined, (err) => {
  console.error(err);
});

tick();
