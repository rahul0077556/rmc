import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  RotateCcw,
  Eye,
  Lightbulb,
  Gauge,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";

type CameraView = "hero" | "side" | "front" | "drum" | "top";

export function Truck3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drumMode, setDrumMode] = useState<"mix" | "agitate" | "discharge" | "stopped">("mix");
  const [lightsOn, setLightsOn] = useState(true);
  const [currentView, setCurrentView] = useState<CameraView>("hero");
  const [stats, setStats] = useState({
    rpm: 14.5,
    payload: 8.0,
    grade: "M35",
    speed: 38,
  });

  const drumSpeedRef = useRef(1.8);
  const lightsRef = useRef(true);
  const targetCameraPos = useRef(new THREE.Vector3(7.5, 3.8, 8.5));
  const targetLookAt = useRef(new THREE.Vector3(0, 1.2, 0));

  useEffect(() => {
    switch (drumMode) {
      case "mix":
        drumSpeedRef.current = 2.2;
        setStats((s) => ({ ...s, rpm: 14.5, speed: 42 }));
        break;
      case "agitate":
        drumSpeedRef.current = 0.8;
        setStats((s) => ({ ...s, rpm: 4.2, speed: 25 }));
        break;
      case "discharge":
        drumSpeedRef.current = -1.5;
        setStats((s) => ({ ...s, rpm: -8.0, speed: 0 }));
        break;
      case "stopped":
        drumSpeedRef.current = 0;
        setStats((s) => ({ ...s, rpm: 0, speed: 0 }));
        break;
    }
  }, [drumMode]);

  useEffect(() => {
    lightsRef.current = lightsOn;
  }, [lightsOn]);

  useEffect(() => {
    switch (currentView) {
      case "hero":
        targetCameraPos.current.set(7.5, 3.8, 8.5);
        targetLookAt.current.set(0, 1.2, 0);
        break;
      case "side":
        targetCameraPos.current.set(0.5, 2.2, 11.5);
        targetLookAt.current.set(0, 1.5, 0);
        break;
      case "front":
        targetCameraPos.current.set(8.5, 2.0, 0.8);
        targetLookAt.current.set(3, 1.4, 0);
        break;
      case "drum":
        targetCameraPos.current.set(-2.5, 4.2, 5.5);
        targetLookAt.current.set(-0.8, 2.3, 0);
        break;
      case "top":
        targetCameraPos.current.set(3.0, 11.0, 4.0);
        targetLookAt.current.set(0, 1.0, 0);
        break;
    }
  }, [currentView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- SCENE & RENDERER SETUP ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x13131a, 0.035);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(7.5, 3.8, 8.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xdde3f0, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff5ea, 1.8);
    sunLight.position.set(12, 16, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 40;
    sunLight.shadow.camera.left = -8;
    sunLight.shadow.camera.right = 8;
    sunLight.shadow.camera.top = 8;
    sunLight.shadow.camera.bottom = -8;
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight);

    // Neon industrial accent rim light (Purple / Electric Indigo)
    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 2.2);
    rimLight.position.set(-10, 8, -8);
    scene.add(rimLight);

    // Underbody neon glow
    const underLight = new THREE.PointLight(0x6366f1, 1.5, 6);
    underLight.position.set(0, 0.3, 0);
    scene.add(underLight);

    // Headlight cones (spotlights)
    const leftHeadlight = new THREE.SpotLight(0xffffff, 4.0, 15, Math.PI / 6, 0.35, 1);
    leftHeadlight.position.set(4.5, 1.25, 0.85);
    leftHeadlight.target.position.set(14, 0.2, 0.85);
    scene.add(leftHeadlight);
    scene.add(leftHeadlight.target);

    const rightHeadlight = new THREE.SpotLight(0xffffff, 4.0, 15, Math.PI / 6, 0.35, 1);
    rightHeadlight.position.set(4.5, 1.25, -0.85);
    rightHeadlight.target.position.set(14, 0.2, -0.85);
    scene.add(rightHeadlight);
    scene.add(rightHeadlight.target);

    // --- MATERIALS PALETTE ---
    const paintMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d28d9, // RMC Electric Purple Paint
      roughness: 0.25,
      metalness: 0.55,
    });

    const drumMainMaterial = new THREE.MeshStandardMaterial({
      color: 0x242735, // Industrial carbon finish
      roughness: 0.35,
      metalness: 0.45,
    });

    const drumStripeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Safety Amber Warning Stripe
      roughness: 0.3,
      metalness: 0.3,
    });

    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x18181f,
      roughness: 0.6,
      metalness: 0.8,
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.1,
      metalness: 0.95,
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8,
      transparent: true,
      opacity: 0.85,
    });

    const tireMaterial = new THREE.MeshStandardMaterial({
      color: 0x141416,
      roughness: 0.85,
      metalness: 0.1,
    });

    const lightGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    const tailGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xef4444,
    });

    // --- TRUCK ROOT GROUP ---
    const truckGroup = new THREE.Group();
    scene.add(truckGroup);

    // 1. CHASSIS / FRAME
    const chassisGeo = new THREE.BoxGeometry(7.8, 0.32, 1.4);
    const chassis = new THREE.Mesh(chassisGeo, darkMetalMaterial);
    chassis.position.set(0.2, 0.75, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    truckGroup.add(chassis);

    // Secondary subframe beams
    const subframeGeo = new THREE.BoxGeometry(4.8, 0.2, 1.25);
    const subframe = new THREE.Mesh(subframeGeo, darkMetalMaterial);
    subframe.position.set(-0.8, 0.95, 0);
    truckGroup.add(subframe);

    // 2. CABIN
    const cabGroup = new THREE.Group();
    cabGroup.position.set(2.8, 1.7, 0);

    // Lower cab
    const cabLowerGeo = new THREE.BoxGeometry(2.2, 1.2, 2.0);
    const cabLower = new THREE.Mesh(cabLowerGeo, paintMaterial);
    cabLower.castShadow = true;
    cabGroup.add(cabLower);

    // Upper cab / roof
    const cabUpperGeo = new THREE.BoxGeometry(1.7, 0.95, 1.95);
    const cabUpper = new THREE.Mesh(cabUpperGeo, paintMaterial);
    cabUpper.position.set(-0.15, 0.95, 0);
    cabUpper.castShadow = true;
    cabGroup.add(cabUpper);

    // Windshield (front slanted window)
    const windshieldGeo = new THREE.BoxGeometry(0.1, 0.75, 1.75);
    const windshield = new THREE.Mesh(windshieldGeo, glassMaterial);
    windshield.position.set(0.72, 0.95, 0);
    windshield.rotation.z = -0.22;
    cabGroup.add(windshield);

    // Side windows
    const sideWinL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.05), glassMaterial);
    sideWinL.position.set(-0.15, 0.98, 0.98);
    cabGroup.add(sideWinL);

    const sideWinR = sideWinL.clone();
    sideWinR.position.z = -0.98;
    cabGroup.add(sideWinR);

    // Front Grille
    const grilleGeo = new THREE.BoxGeometry(0.08, 0.65, 1.55);
    const grille = new THREE.Mesh(grilleGeo, chromeMaterial);
    grille.position.set(1.12, 0.1, 0);
    cabGroup.add(grille);

    // Bumper
    const bumperGeo = new THREE.BoxGeometry(0.4, 0.35, 2.15);
    const bumper = new THREE.Mesh(bumperGeo, darkMetalMaterial);
    bumper.position.set(1.1, -0.45, 0);
    cabGroup.add(bumper);

    // Headlight Meshes (Front LED)
    const headlightGeo = new THREE.BoxGeometry(0.08, 0.22, 0.32);
    const leftHeadMesh = new THREE.Mesh(headlightGeo, lightGlowMaterial);
    leftHeadMesh.position.set(1.13, -0.2, 0.75);
    cabGroup.add(leftHeadMesh);

    const rightHeadMesh = leftHeadMesh.clone();
    rightHeadMesh.position.z = -0.75;
    cabGroup.add(rightHeadMesh);

    // Side mirrors
    const mirrorBracketL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5), darkMetalMaterial);
    mirrorBracketL.position.set(0.65, 1.1, 1.15);
    mirrorBracketL.rotation.x = Math.PI / 4;
    cabGroup.add(mirrorBracketL);

    const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.18), darkMetalMaterial);
    mirrorL.position.set(0.7, 1.2, 1.25);
    cabGroup.add(mirrorL);

    const mirrorR = mirrorL.clone();
    mirrorR.position.z = -1.25;
    cabGroup.add(mirrorR);

    // Sun visor
    const visorGeo = new THREE.BoxGeometry(0.4, 0.1, 1.95);
    const visor = new THREE.Mesh(visorGeo, darkMetalMaterial);
    visor.position.set(0.7, 1.48, 0);
    visor.rotation.z = -0.15;
    cabGroup.add(visor);

    truckGroup.add(cabGroup);

    // 3. WATER TANK & HYDRAULIC EQUIPMENT BEHIND CAB
    const waterTankGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.85, 20);
    const waterTank = new THREE.Mesh(waterTankGeo, chromeMaterial);
    waterTank.position.set(1.3, 2.3, 0);
    waterTank.rotation.x = Math.PI / 2;
    truckGroup.add(waterTank);

    // Hydraulic pump box
    const pumpBoxGeo = new THREE.BoxGeometry(0.6, 0.5, 0.8);
    const pumpBox = new THREE.Mesh(pumpBoxGeo, darkMetalMaterial);
    pumpBox.position.set(1.2, 1.2, 0);
    truckGroup.add(pumpBox);

    // 4. TRANSIT MIXER DRUM ASSEMBLY (ROTATING)
    // The drum is mounted at an inclination of ~15 degrees
    const drumMount = new THREE.Group();
    drumMount.position.set(-0.8, 1.95, 0);
    drumMount.rotation.z = -0.26; // Inclination angle
    truckGroup.add(drumMount);

    const rotatingDrum = new THREE.Group();
    drumMount.add(rotatingDrum);

    // Front conical taper
    const frontConeGeo = new THREE.ConeGeometry(1.35, 1.7, 32, 1, true);
    const frontCone = new THREE.Mesh(frontConeGeo, drumMainMaterial);
    frontCone.position.set(1.15, 0, 0);
    frontCone.rotation.z = -Math.PI / 2;
    frontCone.castShadow = true;
    rotatingDrum.add(frontCone);

    // Center cylindrical belly
    const centerDrumGeo = new THREE.CylinderGeometry(1.35, 1.35, 1.6, 32);
    const centerDrum = new THREE.Mesh(centerDrumGeo, drumMainMaterial);
    centerDrum.rotation.z = Math.PI / 2;
    centerDrum.castShadow = true;
    rotatingDrum.add(centerDrum);

    // Rear tapering discharge cone
    const rearConeGeo = new THREE.CylinderGeometry(1.35, 0.65, 2.0, 32);
    const rearCone = new THREE.Mesh(rearConeGeo, drumMainMaterial);
    rearCone.position.set(-1.6, 0, 0);
    rearCone.rotation.z = Math.PI / 2;
    rearCone.castShadow = true;
    rotatingDrum.add(rearCone);

    // Discharge mouth ring
    const ringGeo = new THREE.TorusGeometry(0.68, 0.08, 16, 32);
    const mouthRing = new THREE.Mesh(ringGeo, chromeMaterial);
    mouthRing.position.set(-2.6, 0, 0);
    mouthRing.rotation.y = Math.PI / 2;
    rotatingDrum.add(mouthRing);

    // Decorative spiral hazard stripes on the drum
    const stripeCount = 6;
    for (let i = 0; i < stripeCount; i++) {
      const angle = (i * Math.PI * 2) / stripeCount;
      const stripeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.36, 1.36, 0.18, 16, 1, true, angle, Math.PI / 4),
        drumStripeMaterial
      );
      stripeMesh.rotation.z = Math.PI / 2;
      stripeMesh.position.x = (i - 2.5) * 0.35;
      stripeMesh.rotation.x = angle + i * 0.4;
      rotatingDrum.add(stripeMesh);
    }

    // Front bearing mount
    const frontMount = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 1.2), darkMetalMaterial);
    frontMount.position.set(1.9, -0.6, 0);
    drumMount.add(frontMount);

    // Rear drum support rollers
    const rollerMountL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.25, 16), chromeMaterial);
    rollerMountL.position.set(-2.2, -0.7, 0.7);
    rollerMountL.rotation.x = Math.PI / 2;
    drumMount.add(rollerMountL);

    const rollerMountR = rollerMountL.clone();
    rollerMountR.position.z = -0.7;
    drumMount.add(rollerMountR);

    // 5. REAR HOPPER & DISCHARGE CHUTE
    const rearEquipGroup = new THREE.Group();
    rearEquipGroup.position.set(-3.4, 2.3, 0);

    // Inflow hopper funnel
    const hopperGeo = new THREE.ConeGeometry(0.65, 0.8, 16, 1, true);
    const hopper = new THREE.Mesh(hopperGeo, darkMetalMaterial);
    hopper.position.set(0.1, 0.5, 0);
    hopper.rotation.z = Math.PI;
    rearEquipGroup.add(hopper);

    // Discharge main chute (slanted down)
    const chuteGeo = new THREE.CylinderGeometry(0.3, 0.25, 1.5, 16, 1, true, 0, Math.PI);
    const chute = new THREE.Mesh(chuteGeo, chromeMaterial);
    chute.position.set(-0.6, -0.4, 0);
    chute.rotation.z = 0.6;
    chute.rotation.y = Math.PI;
    rearEquipGroup.add(chute);

    // Folded extension chute
    const extChute = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 1.1, 16, 1, true, 0, Math.PI), chromeMaterial);
    extChute.position.set(-0.3, -0.85, 0.45);
    extChute.rotation.z = -0.3;
    rearEquipGroup.add(extChute);

    // Rear ladder
    const ladderSideL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.6, 0.04), darkMetalMaterial);
    ladderSideL.position.set(0.2, -0.2, 0.95);
    rearEquipGroup.add(ladderSideL);

    const ladderSideR = ladderSideL.clone();
    ladderSideR.position.x += 0.35;
    rearEquipGroup.add(ladderSideR);

    truckGroup.add(rearEquipGroup);

    // Rear Taillights
    const tailLightGeo = new THREE.BoxGeometry(0.08, 0.15, 0.35);
    const leftTail = new THREE.Mesh(tailLightGeo, tailGlowMaterial);
    leftTail.position.set(-3.7, 0.85, 0.65);
    truckGroup.add(leftTail);

    const rightTail = leftTail.clone();
    rightTail.position.z = -0.65;
    truckGroup.add(rightTail);

    // 6. WHEELS & AXLES (10 Wheels total)
    const wheels: THREE.Mesh[] = [];
    const wheelPositions = [
      // Front steer axle (single wheels)
      { x: 2.8, z: 0.9 },
      { x: 2.8, z: -0.9 },
      // Drive axle 1 (dual wheels left/right)
      { x: -1.2, z: 0.85 },
      { x: -1.2, z: 1.1 },
      { x: -1.2, z: -0.85 },
      { x: -1.2, z: -1.1 },
      // Drive axle 2 (dual wheels left/right)
      { x: -2.5, z: 0.85 },
      { x: -2.5, z: 1.1 },
      { x: -2.5, z: -0.85 },
      { x: -2.5, z: -1.1 },
    ];

    const tireGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.28, 24);
    const rimGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 16);

    wheelPositions.forEach((pos) => {
      const wheelHub = new THREE.Group();
      wheelHub.position.set(pos.x, 0.55, pos.z);

      const tire = new THREE.Mesh(tireGeo, tireMaterial);
      tire.rotation.x = Math.PI / 2;
      tire.castShadow = true;
      wheelHub.add(tire);

      const rim = new THREE.Mesh(rimGeo, chromeMaterial);
      rim.rotation.x = Math.PI / 2;
      wheelHub.add(rim);

      // Hub cap
      const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 12), darkMetalMaterial);
      hubCap.rotation.x = Math.PI / 2;
      wheelHub.add(hubCap);

      truckGroup.add(wheelHub);
      wheels.push(tire);
    });

    // 7. ROAD WITH MOVING DASHED STRIPES
    const roadGroup = new THREE.Group();
    scene.add(roadGroup);

    const roadGeo = new THREE.PlaneGeometry(38, 7.5);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x161822,
      roughness: 0.75,
      metalness: 0.2,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    road.receiveShadow = true;
    roadGroup.add(road);

    // Moving dashed center road stripes
    const stripes: THREE.Mesh[] = [];
    const stripeGeo = new THREE.PlaneGeometry(1.6, 0.15);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });

    for (let i = -10; i <= 10; i++) {
      const str = new THREE.Mesh(stripeGeo, stripeMat);
      str.rotation.x = -Math.PI / 2;
      str.position.set(i * 3.5, 0.01, 0);
      roadGroup.add(str);
      stripes.push(str);
    }

    // Side safety curb lines (Yellow)
    const curbMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.6 });
    const leftCurb = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.08), curbMat);
    leftCurb.rotation.x = -Math.PI / 2;
    leftCurb.position.set(0, 0.01, 3.2);
    roadGroup.add(leftCurb);

    const rightCurb = leftCurb.clone();
    rightCurb.position.z = -3.2;
    roadGroup.add(rightCurb);

    // Ground shadow disc under truck
    const shadowGeo = new THREE.PlaneGeometry(8.5, 3.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x050508,
      transparent: true,
      opacity: 0.7,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0.2, 0.005, 0);
    roadGroup.add(shadowMesh);

    // Floating particles (Concrete / Industrial dust)
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 24;
      particlePositions[i + 1] = Math.random() * 4;
      particlePositions[i + 2] = (Math.random() - 0.5) * 10;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xa78bfa,
      size: 0.06,
      transparent: true,
      opacity: 0.45,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- INTERACTIVE ORBIT & MOUSE MOVEMENT ---
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let truckYaw = 0;
    let truckPitch = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      truckYaw += deltaX * 0.007;
      truckPitch = Math.max(-0.25, Math.min(0.35, truckPitch + deltaY * 0.005));
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    // Touch support for mobile/tablets
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1 && e.touches[0]) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1 || !e.touches[0]) return;
      const deltaX = e.touches[0].clientX - prevMouseX;
      const deltaY = e.touches[0].clientY - prevMouseY;
      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;

      truckYaw += deltaX * 0.009;
      truckPitch = Math.max(-0.25, Math.min(0.35, truckPitch + deltaY * 0.007));
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    // --- RESIZE HANDLER ---
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // --- ANIMATION LOOP ---
    let reqId = 0;
    let clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // 1. Rotate Concrete Mixing Drum
      rotatingDrum.rotation.x += drumSpeedRef.current * delta;

      // 2. Rotate Wheels & Move Road Stripes based on speed
      const roadSpeed = drumMode === "stopped" ? 0 : 5.5;
      stripes.forEach((s) => {
        s.position.x -= roadSpeed * delta;
        if (s.position.x < -18) s.position.x += 35;
      });

      wheels.forEach((w) => {
        w.rotation.x += roadSpeed * delta * 1.8;
      });

      // 3. Subtle suspension vibration/bounce
      if (drumMode !== "stopped") {
        truckGroup.position.y = Math.sin(clock.getElapsedTime() * 8) * 0.015;
      }

      // 4. Smooth user drag tilt & auto orbit return
      if (!isDragging) {
        truckYaw *= 0.96;
        truckPitch *= 0.96;
      }
      truckGroup.rotation.y = truckYaw;
      truckGroup.rotation.z = truckPitch;

      // 5. Smooth Camera Interpolation
      camera.position.lerp(targetCameraPos.current, 0.04);
      camera.lookAt(targetLookAt.current);

      // 6. Headlights intensity sync
      leftHeadlight.intensity = lightsRef.current ? 4.2 : 0;
      rightHeadlight.intensity = lightsRef.current ? 4.2 : 0;

      // 7. Particle animation
      const posAttr = particles.geometry.attributes["position"];
      if (posAttr && posAttr.array) {
        const positions = posAttr.array as Float32Array;
        for (let i = 0; i < particleCount * 3; i += 3) {
          const currentX = positions[i];
          if (currentX !== undefined) {
            positions[i] = currentX - roadSpeed * delta * 0.4;
            if (positions[i]! < -12) positions[i] = 12;
          }
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative size-full overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-[#13131c] via-[#0d0d15] to-[#07070b] shadow-2xl">
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={containerRef}
        className="size-full cursor-grab active:cursor-grabbing"
        title="Click and drag to rotate the 3D Transit Mixer"
      />

      {/* Top Left: Live 3D Mixer Telemetry HUD */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-surface/85 px-3 py-1.5 shadow-lg backdrop-blur-md">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            3D Mixer Telemetry
          </span>
          <span className="text-[10px] text-muted-foreground">· TM-08</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded-lg border border-border/60 bg-surface/75 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-muted-foreground">Drum RPM:</span>{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {stats.rpm > 0 ? `+${stats.rpm.toFixed(1)}` : stats.rpm.toFixed(1)}
            </span>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface/75 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-muted-foreground">Payload:</span>{" "}
            <span className="font-semibold text-emerald-400 tabular-nums">
              {stats.payload} m³ {stats.grade}
            </span>
          </div>
        </div>
      </div>

      {/* Top Right: Drag Hint & Camera Views */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-surface/80 p-1 shadow-md backdrop-blur-md">
          <span className="px-2 text-[10px] font-medium text-muted-foreground">View:</span>
          {(["hero", "side", "front", "drum", "top"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setCurrentView(view)}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                currentView === view
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
        <p className="pointer-events-none text-[10px] text-muted-foreground/80">
          Tip: Drag mouse or finger to rotate 360°
        </p>
      </div>

      {/* Bottom Bar: Drum Controls & Headlights */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
        {/* Drum Operation Modes */}
        <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-surface/85 p-1.5 shadow-lg backdrop-blur-md">
          <span className="flex items-center gap-1.5 px-2 text-[11px] font-medium text-muted-foreground">
            <RotateCcw className="size-3.5 text-primary" />
            Drum:
          </span>
          {[
            { id: "mix", label: "Mix (14 RPM)", color: "text-primary" },
            { id: "agitate", label: "Agitate (4 RPM)", color: "text-amber-400" },
            { id: "discharge", label: "Discharge", color: "text-info" },
            { id: "stopped", label: "Stop", color: "text-destructive" },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setDrumMode(mode.id as typeof drumMode)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                drumMode === mode.id
                  ? "bg-primary/20 text-primary border border-primary/50 shadow-sm"
                  : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Headlight & Speed Status */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLightsOn(!lightsOn)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all shadow-md backdrop-blur-md ${
              lightsOn
                ? "border-amber-400/50 bg-amber-500/15 text-amber-300"
                : "border-border/80 bg-surface/85 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lightbulb className="size-3.5" />
            {lightsOn ? "Headlights ON" : "Headlights OFF"}
          </button>
        </div>
      </div>
    </div>
  );
}
