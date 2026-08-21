"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SceneConfig } from "../aug-features/themes";

const PARTICLE_COUNT = 2200;
const SPARK_COUNT = 130;

function createParticles(): { points: THREE.Points; material: THREE.PointsMaterial } {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const r = 3.5 + Math.random() * 6.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 0.05,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  return { points: new THREE.Points(geometry, material), material };
}

function createSparks(color: string): { points: THREE.Points; material: THREE.PointsMaterial } {
  const positions = new Float32Array(SPARK_COUNT * 3);
  for (let i = 0; i < SPARK_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 15;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 0.09,
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  return { points: new THREE.Points(geometry, material), material };
}

function createTrophy(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(2.35, -0.95, -0.4);
  group.scale.setScalar(0.0001);
  group.visible = false;

  const gold = new THREE.MeshStandardMaterial({
    color: "#f0c14b",
    metalness: 0.92,
    roughness: 0.22,
  });
  const cupGold = new THREE.MeshStandardMaterial({
    color: "#f0c14b",
    metalness: 0.92,
    roughness: 0.22,
    side: THREE.DoubleSide,
  });
  const handleGold = new THREE.MeshStandardMaterial({
    color: "#e6b53a",
    metalness: 0.9,
    roughness: 0.28,
  });
  const wood = new THREE.MeshStandardMaterial({
    color: "#3b2a12",
    metalness: 0.25,
    roughness: 0.5,
  });

  const profile = [
    [0.001, 0],
    [0.3, 0],
    [0.33, 0.07],
    [0.17, 0.15],
    [0.135, 0.55],
    [0.23, 0.8],
    [0.3, 1.0],
    [0.285, 1.04],
    [0.21, 0.99],
    [0.165, 0.75],
    [0.085, 0.34],
    [0.001, 0.3],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  const baseTier = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.1, 48), wood);
  baseTier.position.y = 0.05;
  group.add(baseTier);

  const baseTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.07, 48), wood);
  baseTop.position.y = 0.135;
  group.add(baseTop);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.085, 0.36, 32), gold);
  stem.position.y = 0.35;
  group.add(stem);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.165, 0.08, 32), gold);
  collar.position.y = 0.57;
  group.add(collar);

  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), cupGold);
  cup.position.y = 0.6;
  group.add(cup);

  const rightHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.045, 20, 48),
    handleGold,
  );
  rightHandle.position.set(0.44, 1.42, 0);
  group.add(rightHandle);

  const leftHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.045, 20, 48),
    handleGold,
  );
  leftHandle.position.set(-0.44, 1.42, 0);
  group.add(leftHandle);

  return group;
}

export default function StageCanvas({ scene }: { scene: SceneConfig }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(scene);
  configRef.current = scene;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      host.clientWidth / host.clientHeight,
      0.1,
      100,
    );
    camera.position.z = 6.5;

    const { points: particles, material: particleMat } = createParticles();
    const { points: sparks, material: sparkMat } = createSparks(
      configRef.current.sparkleColor ?? "#ffffff",
    );
    const trophy = createTrophy();

    threeScene.add(particles, sparks, trophy);

    threeScene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const keyLight = new THREE.DirectionalLight(0xfff2cf, 2.4);
    keyLight.position.set(4, 6, 4);
    threeScene.add(keyLight);
    const rimLight = new THREE.PointLight(
      new THREE.Color(configRef.current.particleColor),
      60,
      14,
      2,
    );
    rimLight.position.set(-5, 2, -2);
    threeScene.add(rimLight);

    const particleTarget = new THREE.Color(configRef.current.particleColor);
    const rimTarget = new THREE.Color(configRef.current.particleColor);
    const sparkTarget = new THREE.Color(configRef.current.sparkleColor ?? "#ffffff");

    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const config = configRef.current;

      particleTarget.set(config.particleColor);
      particleMat.color.lerp(particleTarget, Math.min(1, dt * 2.5));
      particleMat.opacity = 0.5 + Math.sin(t * 0.7) * 0.14;
      particles.rotation.y += dt * 0.022;

      rimTarget.set(config.particleColor);
      rimLight.color.lerp(rimTarget, Math.min(1, dt * 2.5));

      if (config.sparkleColor) sparkTarget.set(config.sparkleColor);
      sparkMat.color.lerp(sparkTarget, Math.min(1, dt * 2.5));
      const sparkFade = config.sparkleColor ? 0.65 : 0;
      sparkMat.opacity += (sparkFade - sparkMat.opacity) * Math.min(1, dt * 2);
      sparks.visible = sparkMat.opacity > 0.01;
      sparks.rotation.y -= dt * 0.015;

      const targetScale = config.trophy ? 1 : 0.0001;
      const s = THREE.MathUtils.lerp(trophy.scale.x, targetScale, Math.min(1, dt * 3));
      trophy.scale.setScalar(s);
      trophy.visible = s > 0.01;
      trophy.rotation.y += dt * 0.35;
      trophy.position.y = -0.95 + Math.sin(t * 1.4) * 0.08;

      renderer.render(threeScene, camera);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        running = false;
      } else if (!running) {
        running = true;
        clock.getDelta();
        tick();
      }
    };

    const onResize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    tick();

    return () => {
      cancelAnimationFrame(raf);
      running = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      threeScene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="pointer-events-none fixed inset-0 z-[1]"
      aria-hidden
    />
  );
}
