import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  RotateCcw,
  Eye,
  Lightbulb,
  Gauge,
  Sparkles,
  Sun,
  Moon,
  Sunset,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Droplets,
  Activity,
  Layers,
  ShieldCheck,
} from "lucide-react";

export type CameraView = "hero" | "side" | "front" | "drum" | "top";
export type LightEnv = "day" | "sunset" | "night";

export function Truck3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drumMode, setDrumMode] = useState<"mix" | "agitate" | "discharge" | "stopped">("mix");
  const [lightsOn, setLightsOn] = useState(true);
  const [strobeOn, setStrobeOn] = useState(true);
  const [lightEnv, setLightEnv] = useState<LightEnv>("night");
  const [currentView, setCurrentView] = useState<CameraView>("hero");
  const [autoRotate, setAutoRotate] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Dynamic Telemetry State
  const [stats, setStats] = useState({
    rpm: 14.5,
    payload: 8.0,
    grade: "M35",
    speed: 38,
    slump: 125,
    temp: 28.4,
    pressure: 210,
  });

  // Mutable refs for high-frequency animation loop
  const drumSpeedRef = useRef(2.2);
  const lightsRef = useRef(true);
  const strobeRef = useRef(true);
  const envRef = useRef<LightEnv>("night");
  const autoRotateRef = useRef(true);
  const targetCameraPos = useRef(new THREE.Vector3(7.5, 3.8, 8.5));
  const targetLookAt = useRef(new THREE.Vector3(0, 1.2, 0));
  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineGainRef = useRef<GainNode | null>(null);

  // Sync mode changes to speed & telemetry
  useEffect(() => {
    switch (drumMode) {
      case "mix":
        drumSpeedRef.current = 2.4;
        setStats((s) => ({ ...s, rpm: 14.5, speed: 42, pressure: 220 }));
        break;
      case "agitate":
        drumSpeedRef.current = 0.8;
        setStats((s) => ({ ...s, rpm: 4.2, speed: 20, pressure: 160 }));
        break;
      case "discharge":
        drumSpeedRef.current = -1.8;
        setStats((s) => ({ ...s, rpm: -8.0, speed: 0, pressure: 195 }));
        break;
      case "stopped":
        drumSpeedRef.current = 0;
        setStats((s) => ({ ...s, rpm: 0, speed: 0, pressure: 60 }));
        break;
    }
  }, [drumMode]);

  useEffect(() => {
    lightsRef.current = lightsOn;
  }, [lightsOn]);

  useEffect(() => {
    strobeRef.current = strobeOn;
  }, [strobeOn]);

  useEffect(() => {
    envRef.current = lightEnv;
  }, [lightEnv]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Camera presets
  useEffect(() => {
    switch (currentView) {
      case "hero":
        targetCameraPos.current.set(7.6, 3.6, 8.2);
        targetLookAt.current.set(0, 1.2, 0);
        break;
      case "side":
        targetCameraPos.current.set(0.2, 2.2, 11.2);
        targetLookAt.current.set(0, 1.5, 0);
        break;
      case "front":
        targetCameraPos.current.set(8.2, 2.0, 0.8);
        targetLookAt.current.set(3, 1.4, 0);
        break;
      case "drum":
        targetCameraPos.current.set(-2.8, 3.8, 5.5);
        targetLookAt.current.set(-1.0, 2.1, 0);
        break;
      case "top":
        targetCameraPos.current.set(2.5, 11.5, 3.5);
        targetLookAt.current.set(0, 1.0, 0);
        break;
    }
  }, [currentView]);

  // Procedural Web Audio API Sound Synthesizer (Diesel Engine + Drum Hum)
  const toggleSound = useCallback(() => {
    if (soundEnabled) {
      if (engineGainRef.current) {
        engineGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current?.currentTime || 0, 0.1);
      }
      setSoundEnabled(false);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = audioCtxRef.current || new AudioCtx();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Master gain node
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.12, ctx.currentTime);
      master.connect(ctx.destination);
      engineGainRef.current = master;

      // Low rumble diesel oscillator 1 (48 Hz fundamental)
      const osc1 = ctx.createOscillator();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(48, ctx.currentTime);

      // Low-pass filter for deep muffled diesel engine tone
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(120, ctx.currentTime);

      // Drum gear hydraulic hum oscillator 2
      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(110, ctx.currentTime);

      const osc2Gain = ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.04, ctx.currentTime);

      osc1.connect(filter);
      filter.connect(master);
      osc2.connect(osc2Gain);
      osc2Gain.connect(master);

      osc1.start();
      osc2.start();

      setSoundEnabled(true);
    } catch {
      // Audio not permitted or supported
      setSoundEnabled(false);
    }
  }, [soundEnabled]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- SCENE & RENDERER SETUP ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0b12, 0.032);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(7.6, 3.6, 8.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // --- LIGHTING SYSTEM ---
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    sunLight.position.set(12, 16, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 40;
    sunLight.shadow.camera.left = -9;
    sunLight.shadow.camera.right = 9;
    sunLight.shadow.camera.top = 9;
    sunLight.shadow.camera.bottom = -9;
    sunLight.shadow.bias = -0.001;
    scene.add(sunLight);

    // Dynamic Violet / Indigo rim light
    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 2.4);
    rimLight.position.set(-10, 8, -8);
    scene.add(rimLight);

    // Underbody neon glow
    const underLight = new THREE.PointLight(0x6366f1, 2.0, 7);
    underLight.position.set(0, 0.35, 0);
    scene.add(underLight);

    // Twin LED projector headlights (Spotlights with light cones)
    const leftHeadlight = new THREE.SpotLight(0xffffff, 5.0, 18, Math.PI / 5.5, 0.35, 1.2);
    leftHeadlight.position.set(4.5, 1.25, 0.85);
    leftHeadlight.target.position.set(14, 0.2, 0.85);
    scene.add(leftHeadlight);
    scene.add(leftHeadlight.target);

    const rightHeadlight = new THREE.SpotLight(0xffffff, 5.0, 18, Math.PI / 5.5, 0.35, 1.2);
    rightHeadlight.position.set(4.5, 1.25, -0.85);
    rightHeadlight.target.position.set(14, 0.2, -0.85);
    scene.add(rightHeadlight);
    scene.add(rightHeadlight.target);

    // Rotating Amber Strobe Beacon Lights on Cab Roof
    const leftStrobeLight = new THREE.PointLight(0xf59e0b, 2.5, 6);
    leftStrobeLight.position.set(2.8, 3.2, 0.7);
    scene.add(leftStrobeLight);

    const rightStrobeLight = new THREE.PointLight(0xf59e0b, 2.5, 6);
    rightStrobeLight.position.set(2.8, 3.2, -0.7);
    scene.add(rightStrobeLight);

    // --- MATERIALS PALETTE ---
    const paintMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d28d9, // RMC Electric Purple Corporate Livery
      roughness: 0.22,
      metalness: 0.6,
    });

    const cabAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0x4c1d95, // Deep violet cab skirt
      roughness: 0.3,
      metalness: 0.5,
    });

    const drumMainMaterial = new THREE.MeshStandardMaterial({
      color: 0x222533, // High-grade cast alloy carbon drum
      roughness: 0.35,
      metalness: 0.45,
    });

    const drumStripeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Safety Amber Warning Spiral
      roughness: 0.25,
      metalness: 0.35,
    });

    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x16161c,
      roughness: 0.65,
      metalness: 0.85,
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.08,
      metalness: 0.96,
    });

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.08,
      metalness: 0.15,
      transmission: 0.75,
      transparent: true,
      opacity: 0.88,
    });

    const tireMaterial = new THREE.MeshStandardMaterial({
      color: 0x121214,
      roughness: 0.88,
      metalness: 0.05,
    });

    const lightGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });

    const tailGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xef4444,
    });

    const amberBeaconMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.15,
      metalness: 0.2,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });

    const safetyYellowMaterial = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.4,
      metalness: 0.2,
    });

    const slurryMaterial = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.8,
      metalness: 0.1,
    });

    // --- TRUCK ROOT GROUP ---
    const truckGroup = new THREE.Group();
    scene.add(truckGroup);

    // 1. CHASSIS / FRAME (Heavy C-Channel steel I-beams)
    const chassisGeo = new THREE.BoxGeometry(7.8, 0.34, 1.4);
    const chassis = new THREE.Mesh(chassisGeo, darkMetalMaterial);
    chassis.position.set(0.2, 0.75, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    truckGroup.add(chassis);

    // Secondary subframe beams
    const subframeGeo = new THREE.BoxGeometry(4.8, 0.22, 1.25);
    const subframe = new THREE.Mesh(subframeGeo, darkMetalMaterial);
    subframe.position.set(-0.8, 0.98, 0);
    subframe.castShadow = true;
    truckGroup.add(subframe);

    // Fuel Tank on left chassis side
    const fuelTankGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.6, 20);
    const fuelTank = new THREE.Mesh(fuelTankGeo, chromeMaterial);
    fuelTank.rotation.z = Math.PI / 2;
    fuelTank.position.set(0.8, 0.65, 0.85);
    truckGroup.add(fuelTank);

    // Battery / Air reservoir boxes on right chassis side
    const airBoxGeo = new THREE.BoxGeometry(1.2, 0.45, 0.5);
    const airBox = new THREE.Mesh(airBoxGeo, darkMetalMaterial);
    airBox.position.set(0.8, 0.65, -0.85);
    truckGroup.add(airBox);

    // 2. CABIN
    const cabGroup = new THREE.Group();
    cabGroup.position.set(2.8, 1.7, 0);

    // Lower cab structure
    const cabLowerGeo = new THREE.BoxGeometry(2.2, 1.2, 2.0);
    const cabLower = new THREE.Mesh(cabLowerGeo, paintMaterial);
    cabLower.castShadow = true;
    cabGroup.add(cabLower);

    // Aerodynamic lower skirts
    const skirtGeo = new THREE.BoxGeometry(2.0, 0.3, 2.05);
    const cabSkirt = new THREE.Mesh(skirtGeo, cabAccentMaterial);
    cabSkirt.position.set(0, -0.45, 0);
    cabGroup.add(cabSkirt);

    // Upper cab / roof
    const cabUpperGeo = new THREE.BoxGeometry(1.7, 0.95, 1.95);
    const cabUpper = new THREE.Mesh(cabUpperGeo, paintMaterial);
    cabUpper.position.set(-0.15, 0.95, 0);
    cabUpper.castShadow = true;
    cabGroup.add(cabUpper);

    // Front Windshield (curved slant glass)
    const windshieldGeo = new THREE.BoxGeometry(0.1, 0.78, 1.78);
    const windshield = new THREE.Mesh(windshieldGeo, glassMaterial);
    windshield.position.set(0.72, 0.95, 0);
    windshield.rotation.z = -0.22;
    cabGroup.add(windshield);

    // Side windows
    const sideWinL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.05), glassMaterial);
    sideWinL.position.set(-0.15, 0.98, 0.98);
    cabGroup.add(sideWinL);

    const sideWinR = sideWinL.clone();
    sideWinR.position.z = -0.98;
    cabGroup.add(sideWinR);

    // Driver Silhouette inside cabin (Head + Torso + Steering wheel)
    const driverGroup = new THREE.Group();
    driverGroup.position.set(0.2, 0.85, 0.45);
    const driverHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), darkMetalMaterial);
    driverHead.position.set(0, 0.32, 0);
    driverGroup.add(driverHead);
    const driverTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.45, 12), safetyYellowMaterial);
    driverGroup.add(driverTorso);
    const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 16), darkMetalMaterial);
    steeringWheel.position.set(0.35, 0.15, 0);
    steeringWheel.rotation.y = Math.PI / 2;
    steeringWheel.rotation.z = -Math.PI / 4;
    driverGroup.add(steeringWheel);
    cabGroup.add(driverGroup);

    // Front Chrome Multi-Slat Grille
    const grilleGeo = new THREE.BoxGeometry(0.08, 0.68, 1.58);
    const grille = new THREE.Mesh(grilleGeo, chromeMaterial);
    grille.position.set(1.12, 0.1, 0);
    cabGroup.add(grille);

    // RMC Emblem badge on grille
    const emblemGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16);
    const emblem = new THREE.Mesh(emblemGeo, paintMaterial);
    emblem.position.set(1.17, 0.15, 0);
    emblem.rotation.z = Math.PI / 2;
    cabGroup.add(emblem);

    // Heavy duty Front Steel Bumper
    const bumperGeo = new THREE.BoxGeometry(0.42, 0.38, 2.2);
    const bumper = new THREE.Mesh(bumperGeo, darkMetalMaterial);
    bumper.position.set(1.12, -0.45, 0);
    cabGroup.add(bumper);

    // Front Fog Lamps on bumper
    const fogGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12);
    const fogL = new THREE.Mesh(fogGeo, lightGlowMaterial);
    fogL.position.set(1.32, -0.45, 0.6);
    fogL.rotation.z = Math.PI / 2;
    cabGroup.add(fogL);

    const fogR = fogL.clone();
    fogR.position.z = -0.6;
    cabGroup.add(fogR);

    // Headlight Meshes (Front LED projectors)
    const headlightGeo = new THREE.BoxGeometry(0.08, 0.24, 0.34);
    const leftHeadMesh = new THREE.Mesh(headlightGeo, lightGlowMaterial);
    leftHeadMesh.position.set(1.13, -0.18, 0.75);
    cabGroup.add(leftHeadMesh);

    const rightHeadMesh = leftHeadMesh.clone();
    rightHeadMesh.position.z = -0.75;
    cabGroup.add(rightHeadMesh);

    // Large West-Coast Side Mirrors with chrome brackets
    const mirrorBracketL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55), darkMetalMaterial);
    mirrorBracketL.position.set(0.65, 1.1, 1.15);
    mirrorBracketL.rotation.x = Math.PI / 4;
    cabGroup.add(mirrorBracketL);

    const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.2), darkMetalMaterial);
    mirrorL.position.set(0.7, 1.2, 1.25);
    cabGroup.add(mirrorL);

    const mirrorR = mirrorL.clone();
    mirrorR.position.z = -1.25;
    cabGroup.add(mirrorR);

    // Aerodynamic Sun Visor
    const visorGeo = new THREE.BoxGeometry(0.42, 0.1, 1.98);
    const visor = new THREE.Mesh(visorGeo, darkMetalMaterial);
    visor.position.set(0.72, 1.48, 0);
    visor.rotation.z = -0.15;
    cabGroup.add(visor);

    // Dual Rotating Amber Beacons on Cab Roof
    const beaconBaseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.08, 16);
    const beaconDomeGeo = new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);

    const beaconBaseL = new THREE.Mesh(beaconBaseGeo, darkMetalMaterial);
    beaconBaseL.position.set(0.2, 1.48, 0.7);
    const beaconDomeL = new THREE.Mesh(beaconDomeGeo, amberBeaconMaterial);
    beaconDomeL.position.set(0, 0.04, 0);
    beaconBaseL.add(beaconDomeL);
    cabGroup.add(beaconBaseL);

    const beaconBaseR = new THREE.Mesh(beaconBaseGeo, darkMetalMaterial);
    beaconBaseR.position.set(0.2, 1.48, -0.7);
    const beaconDomeR = new THREE.Mesh(beaconDomeGeo, amberBeaconMaterial);
    beaconDomeR.position.set(0, 0.04, 0);
    beaconBaseR.add(beaconDomeR);
    cabGroup.add(beaconBaseR);

    // Vertical Chrome Exhaust Stack behind cab
    const exhaustStack = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.9, 16), chromeMaterial);
    exhaustStack.position.set(1.4, 2.2, -0.92);
    truckGroup.add(exhaustStack);

    const exhaustCap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 12), chromeMaterial);
    exhaustCap.position.set(1.4, 3.2, -0.92);
    exhaustCap.rotation.z = -0.3;
    truckGroup.add(exhaustCap);

    truckGroup.add(cabGroup);

    // 3. WATER TANK & HYDRAULIC EQUIPMENT BEHIND CAB
    const waterTankGeo = new THREE.CylinderGeometry(0.48, 0.48, 1.88, 24);
    const waterTank = new THREE.Mesh(waterTankGeo, chromeMaterial);
    waterTank.position.set(1.3, 2.3, 0);
    waterTank.rotation.x = Math.PI / 2;
    waterTank.castShadow = true;
    truckGroup.add(waterTank);

    // Hydraulic pump transmission drive box
    const pumpBoxGeo = new THREE.BoxGeometry(0.65, 0.55, 0.85);
    const pumpBox = new THREE.Mesh(pumpBoxGeo, darkMetalMaterial);
    pumpBox.position.set(1.2, 1.2, 0);
    truckGroup.add(pumpBox);

    // 4. TRANSIT MIXER DRUM ASSEMBLY (ROTATING)
    // Mounted at standard ~15 degrees inclination
    const drumMount = new THREE.Group();
    drumMount.position.set(-0.8, 1.95, 0);
    drumMount.rotation.z = -0.26; // Inclination angle
    truckGroup.add(drumMount);

    const rotatingDrum = new THREE.Group();
    drumMount.add(rotatingDrum);

    // Front conical taper
    const frontConeGeo = new THREE.ConeGeometry(1.38, 1.7, 32, 1, true);
    const frontCone = new THREE.Mesh(frontConeGeo, drumMainMaterial);
    frontCone.position.set(1.15, 0, 0);
    frontCone.rotation.z = -Math.PI / 2;
    frontCone.castShadow = true;
    rotatingDrum.add(frontCone);

    // Center cylindrical belly
    const centerDrumGeo = new THREE.CylinderGeometry(1.38, 1.38, 1.6, 32);
    const centerDrum = new THREE.Mesh(centerDrumGeo, drumMainMaterial);
    centerDrum.rotation.z = Math.PI / 2;
    centerDrum.castShadow = true;
    rotatingDrum.add(centerDrum);

    // Rear tapering discharge cone
    const rearConeGeo = new THREE.CylinderGeometry(1.38, 0.65, 2.0, 32);
    const rearCone = new THREE.Mesh(rearConeGeo, drumMainMaterial);
    rearCone.position.set(-1.6, 0, 0);
    rearCone.rotation.z = Math.PI / 2;
    rearCone.castShadow = true;
    rotatingDrum.add(rearCone);

    // Heavy duty discharge mouth ring
    const ringGeo = new THREE.TorusGeometry(0.68, 0.09, 16, 32);
    const mouthRing = new THREE.Mesh(ringGeo, chromeMaterial);
    mouthRing.position.set(-2.6, 0, 0);
    mouthRing.rotation.y = Math.PI / 2;
    rotatingDrum.add(mouthRing);

    // Helical Spiral Hazard Stripes (Dual interlocking spirals)
    const stripeCount = 6;
    for (let i = 0; i < stripeCount; i++) {
      const angle = (i * Math.PI * 2) / stripeCount;
      const stripeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.39, 1.39, 0.18, 16, 1, true, angle, Math.PI / 4),
        drumStripeMaterial
      );
      stripeMesh.rotation.z = Math.PI / 2;
      stripeMesh.position.x = (i - 2.5) * 0.35;
      stripeMesh.rotation.x = angle + i * 0.4;
      rotatingDrum.add(stripeMesh);
    }

    // Heavy Front Bearing Pedestal Mount
    const frontMount = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.95, 1.25), darkMetalMaterial);
    frontMount.position.set(1.9, -0.6, 0);
    drumMount.add(frontMount);

    // Dual Rear Drum Support Trunnion Rollers
    const rollerMountL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 16), chromeMaterial);
    rollerMountL.position.set(-2.2, -0.7, 0.72);
    rollerMountL.rotation.x = Math.PI / 2;
    drumMount.add(rollerMountL);

    const rollerMountR = rollerMountL.clone();
    rollerMountR.position.z = -0.72;
    drumMount.add(rollerMountR);

    // 5. REAR HOPPER & DISCHARGE CHUTE
    const rearEquipGroup = new THREE.Group();
    rearEquipGroup.position.set(-3.4, 2.3, 0);

    // Charging Inflow Hopper Funnel
    const hopperGeo = new THREE.ConeGeometry(0.68, 0.85, 16, 1, true);
    const hopper = new THREE.Mesh(hopperGeo, darkMetalMaterial);
    hopper.position.set(0.1, 0.5, 0);
    hopper.rotation.z = Math.PI;
    hopper.castShadow = true;
    rearEquipGroup.add(hopper);

    // Main Swiveling Concrete Discharge Chute
    const chuteGeo = new THREE.CylinderGeometry(0.32, 0.26, 1.6, 16, 1, true, 0, Math.PI);
    const chute = new THREE.Mesh(chuteGeo, chromeMaterial);
    chute.position.set(-0.65, -0.4, 0);
    chute.rotation.z = 0.65;
    chute.rotation.y = Math.PI;
    chute.castShadow = true;
    rearEquipGroup.add(chute);

    // Folded Extension Chute
    const extChute = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 1.15, 16, 1, true, 0, Math.PI), chromeMaterial);
    extChute.position.set(-0.35, -0.85, 0.45);
    extChute.rotation.z = -0.3;
    rearEquipGroup.add(extChute);

    // Steel Catwalk with Yellow Handrails
    const catwalkGeo = new THREE.BoxGeometry(0.45, 0.05, 1.6);
    const catwalk = new THREE.Mesh(catwalkGeo, darkMetalMaterial);
    catwalk.position.set(0.1, 0.05, 0.95);
    rearEquipGroup.add(catwalk);

    const railGeo = new THREE.BoxGeometry(0.03, 0.8, 0.03);
    const handrail1 = new THREE.Mesh(railGeo, safetyYellowMaterial);
    handrail1.position.set(0.3, 0.45, 1.7);
    rearEquipGroup.add(handrail1);
    const handrail2 = handrail1.clone();
    handrail2.position.z = 0.2;
    rearEquipGroup.add(handrail2);

    // Rear Inspection Ladder
    const ladderSideL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.7, 0.04), darkMetalMaterial);
    ladderSideL.position.set(0.2, -0.2, 0.95);
    rearEquipGroup.add(ladderSideL);

    const ladderSideR = ladderSideL.clone();
    ladderSideR.position.x += 0.35;
    rearEquipGroup.add(ladderSideR);

    // Ladder rungs
    for (let r = 0; r < 5; r++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), darkMetalMaterial);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0.375, -0.7 + r * 0.3, 0.95);
      rearEquipGroup.add(rung);
    }

    truckGroup.add(rearEquipGroup);

    // Rear Chevron Hazard Bumper
    const rearBumperGeo = new THREE.BoxGeometry(0.3, 0.32, 2.2);
    const rearBumper = new THREE.Mesh(rearBumperGeo, safetyYellowMaterial);
    rearBumper.position.set(-3.7, 0.65, 0);
    truckGroup.add(rearBumper);

    // Rear Taillights
    const tailLightGeo = new THREE.BoxGeometry(0.08, 0.16, 0.38);
    const leftTail = new THREE.Mesh(tailLightGeo, tailGlowMaterial);
    leftTail.position.set(-3.72, 0.85, 0.7);
    truckGroup.add(leftTail);

    const rightTail = leftTail.clone();
    rightTail.position.z = -0.7;
    truckGroup.add(rightTail);

    // Heavy Rubber Mud Flaps with Reflectors
    const flapGeo = new THREE.BoxGeometry(0.04, 0.55, 0.65);
    const leftFlap = new THREE.Mesh(flapGeo, darkMetalMaterial);
    leftFlap.position.set(-3.1, 0.45, 1.05);
    truckGroup.add(leftFlap);

    const rightFlap = leftFlap.clone();
    rightFlap.position.z = -1.05;
    truckGroup.add(rightFlap);

    // 6. WHEELS & AXLES (10 Wheels Heavy Duty Tandem Setup)
    const wheels: THREE.Mesh[] = [];
    const wheelPositions = [
      // Front steer axle (single wheels left/right)
      { x: 2.8, z: 0.9 },
      { x: 2.8, z: -0.9 },
      // Drive axle 1 (dual wheels left/right)
      { x: -1.2, z: 0.85 },
      { x: -1.2, z: 1.12 },
      { x: -1.2, z: -0.85 },
      { x: -1.2, z: -1.12 },
      // Drive axle 2 (dual wheels left/right)
      { x: -2.5, z: 0.85 },
      { x: -2.5, z: 1.12 },
      { x: -2.5, z: -0.85 },
      { x: -2.5, z: -1.12 },
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

      // Chrome Lug Nut Hub Cap
      const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.33, 12), darkMetalMaterial);
      hubCap.rotation.x = Math.PI / 2;
      wheelHub.add(hubCap);

      truckGroup.add(wheelHub);
      wheels.push(tire);
    });

    // 7. ROADWAY & TARMAC
    const roadGroup = new THREE.Group();
    scene.add(roadGroup);

    const roadGeo = new THREE.PlaneGeometry(42, 8.5);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x141620,
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
    const stripeGeo = new THREE.PlaneGeometry(1.8, 0.16);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });

    for (let i = -12; i <= 12; i++) {
      const str = new THREE.Mesh(stripeGeo, stripeMat);
      str.rotation.x = -Math.PI / 2;
      str.position.set(i * 3.6, 0.01, 0);
      roadGroup.add(str);
      stripes.push(str);
    }

    // Side safety curb lines (Luminous Indigo)
    const curbMat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.7 });
    const leftCurb = new THREE.Mesh(new THREE.PlaneGeometry(44, 0.08), curbMat);
    leftCurb.rotation.x = -Math.PI / 2;
    leftCurb.position.set(0, 0.01, 3.6);
    roadGroup.add(leftCurb);

    const rightCurb = leftCurb.clone();
    rightCurb.position.z = -3.6;
    roadGroup.add(rightCurb);

    // Ground contact shadow disc
    const shadowGeo = new THREE.PlaneGeometry(9.0, 3.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x030305,
      transparent: true,
      opacity: 0.75,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0.2, 0.005, 0);
    roadGroup.add(shadowMesh);

    // 8. CONCRETE DISCHARGE SLURRY PARTICLE SYSTEM
    const dischargeParticleCount = 80;
    const dischargeGeo = new THREE.BufferGeometry();
    const dischargePositions = new Float32Array(dischargeParticleCount * 3);
    const dischargeVelocities: { x: number; y: number; z: number }[] = [];

    for (let i = 0; i < dischargeParticleCount; i++) {
      dischargePositions[i * 3] = -4.2 + (Math.random() - 0.5) * 0.3;
      dischargePositions[i * 3 + 1] = 1.3 - Math.random() * 1.3;
      dischargePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      dischargeVelocities.push({
        x: -0.8 - Math.random() * 0.5,
        y: -2.5 - Math.random() * 2.0,
        z: (Math.random() - 0.5) * 0.6,
      });
    }
    dischargeGeo.setAttribute("position", new THREE.BufferAttribute(dischargePositions, 3));
    const dischargeMat = new THREE.PointsMaterial({
      color: 0xa8a29e,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
    });
    const dischargeParticles = new THREE.Points(dischargeGeo, dischargeMat);
    dischargeParticles.visible = false;
    scene.add(dischargeParticles);

    // 9. EXHAUST SMOKE BILLOWS
    const smokeCount = 35;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeLifes = new Float32Array(smokeCount);

    for (let i = 0; i < smokeCount; i++) {
      smokePositions[i * 3] = 1.4;
      smokePositions[i * 3 + 1] = 3.2;
      smokePositions[i * 3 + 2] = -0.92;
      smokeLifes[i] = Math.random();
    }
    smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePositions, 3));
    const smokeMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.22,
      transparent: true,
      opacity: 0.25,
    });
    const smokeParticles = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smokeParticles);

    // 10. AIRBORNE AMBIENT DUST
    const dustCount = 140;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
      dustPositions[i] = (Math.random() - 0.5) * 26;
      dustPositions[i + 1] = Math.random() * 5;
      dustPositions[i + 2] = (Math.random() - 0.5) * 12;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xc4b5fd,
      size: 0.05,
      transparent: true,
      opacity: 0.4,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);

    // --- INTERACTIVE MOUSE & TOUCH ORBIT ROTATION ---
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

    // Touch support for mobile & tablet
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
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // 1. Dynamic Lighting Adjustment based on Environment Mode
      switch (envRef.current) {
        case "day":
          scene.fog!.color.set(0x1a202c);
          ambientLight.color.set(0xffffff);
          ambientLight.intensity = 1.2;
          sunLight.color.set(0xfffaed);
          sunLight.intensity = 2.4;
          sunLight.position.set(12, 18, 10);
          rimLight.intensity = 0.8;
          roadMat.color.set(0x282c38);
          break;
        case "sunset":
          scene.fog!.color.set(0x261424);
          ambientLight.color.set(0xfbcfe8);
          ambientLight.intensity = 0.9;
          sunLight.color.set(0xf97316);
          sunLight.intensity = 3.2;
          sunLight.position.set(15, 6, 8);
          rimLight.color.set(0xec4899);
          rimLight.intensity = 2.0;
          roadMat.color.set(0x221822);
          break;
        case "night":
          scene.fog!.color.set(0x0a0b12);
          ambientLight.color.set(0x312e81);
          ambientLight.intensity = 0.65;
          sunLight.color.set(0x60a5fa);
          sunLight.intensity = 0.9;
          sunLight.position.set(10, 15, 8);
          rimLight.color.set(0x8b5cf6);
          rimLight.intensity = 2.8;
          roadMat.color.set(0x12141c);
          break;
      }

      // 2. Rotate Mixing Drum
      rotatingDrum.rotation.x += drumSpeedRef.current * delta;

      // 3. Move Road and Spin Wheels
      const isRoadMoving = drumSpeedRef.current > 0;
      const roadSpeed = isRoadMoving ? 6.0 : 0;

      stripes.forEach((s) => {
        s.position.x -= roadSpeed * delta;
        if (s.position.x < -22) s.position.x += 44;
      });

      wheels.forEach((w) => {
        w.rotation.x += roadSpeed * delta * 1.8;
      });

      // 4. Subtle suspension vibration & road bounce
      if (isRoadMoving) {
        truckGroup.position.y = Math.sin(elapsed * 9) * 0.016;
      } else {
        // Idle engine tremble
        truckGroup.position.y = Math.sin(elapsed * 16) * 0.005;
      }

      // 5. Auto-Rotate Turntable or User Drag
      if (autoRotateRef.current && !isDragging) {
        truckYaw += 0.004;
      } else if (!isDragging) {
        truckYaw *= 0.96;
        truckPitch *= 0.96;
      }
      truckGroup.rotation.y = truckYaw;
      truckGroup.rotation.z = truckPitch;

      // 6. Smooth Camera Transition
      camera.position.lerp(targetCameraPos.current, 0.045);
      camera.lookAt(targetLookAt.current);

      // 7. Headlights & Taillights
      leftHeadlight.intensity = lightsRef.current ? 5.2 : 0;
      rightHeadlight.intensity = lightsRef.current ? 5.2 : 0;
      leftHeadMesh.visible = lightsRef.current;
      rightHeadMesh.visible = lightsRef.current;

      // 8. Revolving Amber Warning Beacon Strobes
      if (strobeRef.current) {
        const strobePulse = Math.sin(elapsed * 14);
        const strobeIntensity = strobePulse > 0.3 ? 3.0 : 0.2;
        leftStrobeLight.intensity = strobeIntensity;
        rightStrobeLight.intensity = strobeIntensity;
        beaconDomeL.rotation.y += delta * 12;
        beaconDomeR.rotation.y -= delta * 12;
      } else {
        leftStrobeLight.intensity = 0;
        rightStrobeLight.intensity = 0;
      }

      // 9. Concrete Slurry Pouring Effect (Discharge Mode)
      if (drumSpeedRef.current < 0) {
        dischargeParticles.visible = true;
        const dPos = dischargeGeo.attributes["position"]?.array as Float32Array | undefined;
        if (dPos) {
          for (let i = 0; i < dischargeParticleCount; i++) {
            const v = dischargeVelocities[i];
            if (!v) continue;
            const idxX = i * 3;
            const idxY = i * 3 + 1;
            const idxZ = i * 3 + 2;

            const currX = dPos[idxX];
            const currY = dPos[idxY];
            const currZ = dPos[idxZ];

            if (currX !== undefined && currY !== undefined && currZ !== undefined) {
              const newY = currY + v.y * delta;
              if (newY < 0.05) {
                // Reset at chute mouth
                dPos[idxX] = -4.2 + (Math.random() - 0.5) * 0.3;
                dPos[idxY] = 1.35;
                dPos[idxZ] = (Math.random() - 0.5) * 0.3;
              } else {
                dPos[idxX] = currX + v.x * delta;
                dPos[idxY] = newY;
                dPos[idxZ] = currZ + v.z * delta;
              }
            }
          }
          dischargeGeo.attributes["position"]!.needsUpdate = true;
        }
      } else {
        dischargeParticles.visible = false;
      }

      // 10. Exhaust Smoke Particles
      const sPos = smokeGeo.attributes["position"]?.array as Float32Array | undefined;
      if (sPos) {
        for (let i = 0; i < smokeCount; i++) {
          smokeLifes[i] = (smokeLifes[i] || 0) + delta * 0.8;
          const idxX = i * 3;
          const idxY = i * 3 + 1;
          const idxZ = i * 3 + 2;

          if (smokeLifes[i]! > 1.0) {
            smokeLifes[i] = 0;
            sPos[idxX] = 1.4;
            sPos[idxY] = 3.2;
            sPos[idxZ] = -0.92;
          } else {
            const currX = sPos[idxX];
            const currY = sPos[idxY];
            const currZ = sPos[idxZ];
            if (currX !== undefined && currY !== undefined && currZ !== undefined) {
              sPos[idxX] = currX - delta * (roadSpeed * 0.6 + 0.3);
              sPos[idxY] = currY + delta * 0.9;
              sPos[idxZ] = currZ + Math.sin(elapsed + i) * 0.005;
            }
          }
        }
        smokeGeo.attributes["position"]!.needsUpdate = true;
      }

      // 11. Ambient Dust Drift
      const dustAttr = dustParticles.geometry.attributes["position"];
      if (dustAttr && dustAttr.array) {
        const dArr = dustAttr.array as Float32Array;
        for (let i = 0; i < dustCount * 3; i += 3) {
          const currentX = dArr[i];
          if (currentX !== undefined) {
            dArr[i] = currentX - (roadSpeed * 0.35 + 0.2) * delta;
            if (dArr[i]! < -14) dArr[i] = 14;
          }
        }
        dustAttr.needsUpdate = true;
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
    <div className="relative size-full overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-[#11121c] via-[#0b0c14] to-[#06060a] shadow-2xl">
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={containerRef}
        className="size-full cursor-grab active:cursor-grabbing"
        title="Click and drag to rotate the 3D Transit Mixer in 360°"
      />

      {/* TOP LEFT: Live 3D Mixer Telemetry HUD */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5 sm:left-4 sm:top-4">
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

        <div className="grid grid-cols-2 gap-1.5 text-[10px] sm:text-[11px]">
          <div className="rounded-lg border border-border/60 bg-surface/80 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-muted-foreground">Drum RPM:</span>{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {stats.rpm > 0 ? `+${stats.rpm.toFixed(1)}` : stats.rpm.toFixed(1)}
            </span>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface/80 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-muted-foreground">Payload:</span>{" "}
            <span className="font-semibold text-emerald-400 tabular-nums">
              {stats.payload} m³ {stats.grade}
            </span>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface/80 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-muted-foreground">Slump:</span>{" "}
            <span className="font-semibold text-indigo-300 tabular-nums">{stats.slump} mm</span>
          </div>
          <div className="rounded-lg border border-border/60 bg-surface/80 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-muted-foreground">Pressure:</span>{" "}
            <span className="font-semibold text-amber-400 tabular-nums">{stats.pressure} bar</span>
          </div>
        </div>
      </div>

      {/* TOP RIGHT: Environment Lighting & Camera Angles */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5 sm:right-4 sm:top-4">
        {/* Environment Lighting Modes */}
        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-surface/85 p-1 shadow-md backdrop-blur-md">
          <span className="px-1.5 text-[10px] font-medium text-muted-foreground">Light:</span>
          <button
            type="button"
            onClick={() => setLightEnv("day")}
            title="Daylight mode"
            className={`rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
              lightEnv === "day"
                ? "bg-amber-500 text-white shadow"
                : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            <Sun className="inline size-3 mr-0.5" /> Day
          </button>
          <button
            type="button"
            onClick={() => setLightEnv("sunset")}
            title="Sunset Golden Hour mode"
            className={`rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
              lightEnv === "sunset"
                ? "bg-rose-500 text-white shadow"
                : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            <Sunset className="inline size-3 mr-0.5" /> Dusk
          </button>
          <button
            type="button"
            onClick={() => setLightEnv("night")}
            title="Cyber Night mode"
            className={`rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
              lightEnv === "night"
                ? "bg-indigo-600 text-white shadow"
                : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            <Moon className="inline size-3 mr-0.5" /> Night
          </button>
        </div>

        {/* Camera Views Preset */}
        <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-surface/85 p-1 shadow-md backdrop-blur-md">
          <span className="px-1.5 text-[10px] font-medium text-muted-foreground">View:</span>
          {(["hero", "side", "front", "drum", "top"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setCurrentView(view)}
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors sm:px-2 sm:py-1 ${
                currentView === view
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>

        <p className="pointer-events-none hidden text-[10px] text-muted-foreground/80 sm:block">
          Drag to rotate 360° · Scroll to inspect
        </p>
      </div>

      {/* BOTTOM BAR: Drum Operations, Lighting & Sound Toggles */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 sm:bottom-4 sm:left-4 sm:right-4">
        {/* Drum Operation Modes */}
        <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-surface/85 p-1 shadow-lg backdrop-blur-md sm:p-1.5">
          <span className="hidden items-center gap-1.5 px-2 text-[11px] font-medium text-muted-foreground md:flex">
            <RotateCcw className="size-3.5 text-primary" />
            Drum:
          </span>
          {[
            { id: "mix", label: "Mix (14 RPM)", color: "text-primary" },
            { id: "agitate", label: "Agitate (4 RPM)", color: "text-amber-400" },
            { id: "discharge", label: "Discharge Slurry", color: "text-info" },
            { id: "stopped", label: "Stop", color: "text-destructive" },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setDrumMode(mode.id as typeof drumMode)}
              className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-all sm:px-2.5 sm:text-xs ${
                drumMode === mode.id
                  ? "bg-primary/20 text-primary border border-primary/50 shadow-sm font-semibold"
                  : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Feature Toggles (Headlights, Warning Strobes, Auto-Rotate, Audio) */}
        <div className="flex items-center gap-1.5">
          {/* Headlights toggle */}
          <button
            type="button"
            onClick={() => setLightsOn(!lightsOn)}
            title="Toggle Truck Headlights"
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-medium shadow-md backdrop-blur-md transition-all sm:px-3 sm:py-1.5 sm:text-xs ${
              lightsOn
                ? "border-amber-400/50 bg-amber-500/15 text-amber-300"
                : "border-border/80 bg-surface/85 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lightbulb className="size-3.5" />
            <span className="hidden sm:inline">{lightsOn ? "LEDs ON" : "LEDs OFF"}</span>
          </button>

          {/* Roof Strobes toggle */}
          <button
            type="button"
            onClick={() => setStrobeOn(!strobeOn)}
            title="Toggle Roof Warning Beacons"
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-medium shadow-md backdrop-blur-md transition-all sm:px-3 sm:py-1.5 sm:text-xs ${
              strobeOn
                ? "border-orange-500/50 bg-orange-500/15 text-orange-400 animate-pulse"
                : "border-border/80 bg-surface/85 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">{strobeOn ? "Strobes ON" : "Strobes OFF"}</span>
          </button>

          {/* Auto-Rotate Turntable Toggle */}
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle 360° Auto Orbit"
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-medium shadow-md backdrop-blur-md transition-all sm:px-3 sm:py-1.5 sm:text-xs ${
              autoRotate
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border/80 bg-surface/85 text-muted-foreground hover:text-foreground"
            }`}
          >
            {autoRotate ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            <span className="hidden sm:inline">Orbit</span>
          </button>

          {/* Sound Synthesizer Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? "Mute Diesel Engine Sound" : "Listen to Diesel Engine Sound"}
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[10px] font-medium shadow-md backdrop-blur-md transition-all sm:px-3 sm:py-1.5 sm:text-xs ${
              soundEnabled
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                : "border-border/80 bg-surface/85 text-muted-foreground hover:text-foreground"
            }`}
          >
            {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? "Sound ON" : "Sound"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
