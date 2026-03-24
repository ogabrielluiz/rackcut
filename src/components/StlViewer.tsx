import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

interface StlViewerProps {
  stlData: ArrayBuffer | null;
  color: string;
  className?: string;
}

function parseStlToGeometry(buffer: ArrayBuffer): THREE.BufferGeometry {
  const view = new DataView(buffer);
  const triCount = view.getUint32(80, true);
  const positions = new Float32Array(triCount * 9);
  const normals = new Float32Array(triCount * 9);

  for (let t = 0; t < triCount; t++) {
    const offset = 84 + t * 50;
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);

    for (let v = 0; v < 3; v++) {
      const vOff = offset + 12 + v * 12;
      const idx = t * 9 + v * 3;
      positions[idx] = view.getFloat32(vOff, true);
      positions[idx + 1] = view.getFloat32(vOff + 4, true);
      positions[idx + 2] = view.getFloat32(vOff + 8, true);
      normals[idx] = nx;
      normals[idx + 1] = ny;
      normals[idx + 2] = nz;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.computeVertexNormals(); // smooth normals
  return geometry;
}

export default function StlViewer({ stlData, color, className }: StlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    mesh: THREE.Mesh | null;
    animId: number;
  } | null>(null);

  // Initialize scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      container.innerHTML = '<p style="color:#888;text-align:center;padding:2rem;font-size:0.875rem;">WebGL not available on this device</p>';
      return;
    }
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x1a1917, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      45, container.clientWidth / container.clientHeight, 0.1, 1000
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(50, 100, 80);
    scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-50, -50, 80);
    scene.add(dirLight2);

    sceneRef.current = { renderer, scene, camera, controls, mesh: null, animId: 0 };

    // Animation loop
    function animate() {
      const s = sceneRef.current;
      if (!s) return;
      s.animId = requestAnimationFrame(animate);
      s.controls.update();
      s.renderer.render(s.scene, s.camera);
    }
    animate();

    // Resize handler
    const onResize = () => {
      if (!container || !sceneRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      sceneRef.current.camera.aspect = w / h;
      sceneRef.current.camera.updateProjectionMatrix();
      sceneRef.current.renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animId);
        if (sceneRef.current.mesh) {
          sceneRef.current.mesh.geometry.dispose();
          (sceneRef.current.mesh.material as THREE.Material).dispose();
        }
        sceneRef.current.renderer.dispose();
        sceneRef.current.controls.dispose();
      }
      container.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // Update mesh when STL data changes
  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !stlData) return;

    // Remove old mesh
    if (s.mesh) {
      s.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      (s.mesh.material as THREE.Material).dispose();
    }

    const geometry = parseStlToGeometry(stlData);
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color(color),
      specular: 0x444444,
      shininess: 30,
      flatShading: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    s.mesh = mesh;
    s.scene.add(mesh);

    // Center camera on mesh
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    s.camera.position.set(center.x, center.y - maxDim * 0.8, center.z + maxDim * 1.2);
    s.controls.target.copy(center);
    s.controls.update();
  }, [stlData, color]);

  return (
    <div
      ref={containerRef}
      className={className ?? "w-full h-[400px] rounded-sm overflow-hidden"}
    />
  );
}
