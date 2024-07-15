'use client';

import React, { useState, useEffect, useRef } from "react";
import Image from 'next/image';
import { Upload, Rotate3D, Download } from 'lucide-react';
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

const SVGTo3DConverter = () => {
  const sampleIcons = ["apple.svg", "drive.svg", "figma.svg", "linear.svg", "messenger.svg", "paypal.svg", "playstation.svg", "github.svg", "slack.svg"];

  const [svgFile, setSvgFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [selectedSVG, setSelectedSVG] = useState<string | null>(null);
  const [svgConverted, setSvgConverted] = useState(false);
  const [extrusionDepth, setExtrusionDepth] = useState(20);
  const [metalness, setMetalness] = useState(0.9);
  const [roughness, setRoughness] = useState(0.1);
  const [exposure, setExposure] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const [originalSize, setOriginalSize] = useState<THREE.Vector3 | null>(null);
  const [rotationSpeed, setRotationSpeed] = useState({ x: 0.000, y: 0.005, z: 0.000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 100);
    
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    scene.background = new THREE.Color(0xffffff); 

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    new RGBELoader()
      .setDataType(THREE.HalfFloatType)
      .load('/quarry_01_1k.hdr', (texture) => {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        scene.environment = envMap;
        // scene.background = envMap;
        texture.dispose();
        pmremGenerator.dispose();
        renderer.render(scene, camera);
      });

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      if (groupRef.current) {
        groupRef.current.rotation.x += rotationSpeed.x;
        groupRef.current.rotation.y += rotationSpeed.y;
        groupRef.current.rotation.z += rotationSpeed.z;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.toneMappingExposure = exposure;
    }
  }, [exposure]);

  useEffect(() => {
    if (groupRef.current && materialRef.current && originalSize) {
      const group = groupRef.current.children[0];
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry = new THREE.ExtrudeGeometry(child.geometry.parameters.shapes, {
            depth: extrusionDepth,
            bevelEnabled: true,
            bevelThickness: 2,
            bevelSize: 1,
            bevelSegments: 5,
          });
          child.material.metalness = metalness;
          child.material.roughness = roughness;
        }
      });

      const box = new THREE.Box3().setFromObject(group);
      const newSize = box.getSize(new THREE.Vector3());

      if (Math.abs(newSize.z - originalSize.z) > 0.1) {
        updateCameraPosition(newSize);
      }
    }
  }, [extrusionDepth, metalness, roughness, originalSize]);

  const convertSVGTo3D = (svgString: string) => {
    svgString = parseAndCleanSVG(svgString);
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;

    if (!scene || !camera || !renderer) {
      console.error("Scene, camera, or renderer not initialized");
      return;
    }

    if (groupRef.current) {
      scene.remove(groupRef.current);
    }

    try {
      const loader = new SVGLoader();
      const svgData = loader.parse(svgString);

      const group = new THREE.Group();

      svgData.paths.forEach((path) => {
        const shapes = path.toShapes(true);

        shapes.forEach((shape) => {
          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: extrusionDepth,
            bevelEnabled: true,
            bevelThickness: 2,
            bevelSize: 1,
            bevelSegments: 5,
          });

          const material = new THREE.MeshPhysicalMaterial({
            color: path.color || 0x6666ff,
            metalness: metalness,
            roughness: roughness,
            envMapIntensity: 1,
            clearcoat: 1,
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide,
          });

          materialRef.current = material;

          const mesh = new THREE.Mesh(geometry, material);
          group.add(mesh);
        });
      });

      const scale = 0.25;
      group.scale.set(scale, -scale, scale);

      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      group.position.sub(center);

      const size = box.getSize(new THREE.Vector3());
      setOriginalSize(size);

      const containerGroup = new THREE.Group();
      containerGroup.add(group);
      scene.add(containerGroup);

      groupRef.current = containerGroup;

      updateCameraPosition(size);

      const controls = controlsRef.current;
      if (controls) {
        controls.target.set(0, 0, 0);
        controls.update();
      }

      setSvgConverted(true);
      setError("");
      console.log("3D logo created successfully");

    } catch (err) {
      console.error("Error converting SVG to 3D:", err);
      setError("Error converting SVG to 3D. Please check your SVG file.");
    }
  };

  const updateCameraPosition = (size: THREE.Vector3) => {
    const camera = cameraRef.current;
    if (!camera) return;

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.tan(fov / 2)) * 1.5;
    camera.position.set(cameraZ, cameraZ, cameraZ);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };

  const parseAndCleanSVG = (svgString: string) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, "image/svg+xml");
      const svgElement = doc.documentElement;

      svgElement.querySelectorAll("path").forEach(path => {
        const d = path.getAttribute("d");
        if (d) {
          const splitPaths = d.match(/M[^MZz]*/g);
          if (splitPaths && splitPaths.length > 1) {
            path.remove();
            splitPaths.forEach(subPath => {
              const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
              newPath.setAttribute("d", subPath);
              newPath.setAttribute("fill", path.getAttribute("fill") || "none");
              newPath.setAttribute("fill-rule", "evenodd");
              svgElement.appendChild(newPath);
            });
          }
        }
      });

      const serializer = new XMLSerializer();
      return serializer.serializeToString(svgElement);
    } catch (error) {
      console.error("Error parsing and cleaning SVG:", error);
      return svgString;
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSvgFile(file);
      setError("");
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target) {
          const svgString = e.target.result as string; // Type assertion here
          readSVGFile(file);
          convertSVGTo3D(svgString); // TypeScript should infer svgString as string
        }
      };
      reader.onerror = () => {
        setError("Error reading the SVG file.");
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === "image/svg+xml") {
      setSvgFile(file);
      setError("");
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target) {
          const svgString = e.target.result as string; // Type assertion here
          readSVGFile(file);
          convertSVGTo3D(svgString); // TypeScript should infer svgString as string
        }
      };
      reader.onerror = () => {
        setError("Error reading the SVG file.");
      };
      reader.readAsText(file);
    } else {
      setError("Please drop a valid SVG file.");
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  };

  const readSVGFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target) {
        const svgContent = e.target.result as string;
        setSelectedSVG(svgContent);
        setError("");
      }
    };
    reader.onerror = () => {
      setError("Error reading the SVG file.");
    };
    reader.readAsDataURL(file);
  };


  const handleExportSTL = () => {
    if (!groupRef.current) {
      setError("No 3D model to export. Please convert an SVG first.");
      return;
    }

    const exporter = new STLExporter();
    const stlString = exporter.parse(groupRef.current);
    const blob = new Blob([stlString], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "3d_model.stl";
    link.click();
  };

  const handleExportGLTF = () => {
    if (!groupRef.current) {
      setError("No 3D model to export. Please convert an SVG first.");
      return;
    }

    const exporter = new GLTFExporter();

    exporter.parse(groupRef.current, (gltf) => {
      const gltfString = JSON.stringify(gltf);
      const blob = new Blob([gltfString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "3d_model.gltf";
      link.click();
      URL.revokeObjectURL(url);
    },function (error) {console.log('An error happened while exporting GLTF');});
  };

  const handleSampleClick = (svgPath: string) => {
    fetch(svgPath)
      .then(response => response.text())
      .then(svgString => {
        setSelectedSVG(svgPath);
        convertSVGTo3D(svgString);
      })
      .catch(err => setError("Error loading sample SVG."));
  };

  return (
    <div className="flex min-h-screen bg-gray-200">
      <div className="w-1/2 p-8 lg:p-14 bg-[#F4F4F4]">
        <div className="flex items-center mb-6">
          <div className="bg-gray-800 p-2 rounded-lg mr-3">
            <Rotate3D className="text-white" size={60} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-gray-700">SVG to 3D</h1>
          </div>
        </div>

        <div className="lg:flex flex-row gap-12 mt-10 mb-10 items-end justify-start hidden">
          <div className="w-full">
            <label 
              htmlFor="svg-upload" 
              className="block border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4 cursor-pointer"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div className="flex flex-col items-center justify-center h-full">
                {selectedSVG ? (
                  <div className="mb-4">
                    <Image 
                      src={selectedSVG} 
                      alt="Selected SVG" 
                      width={96} 
                      height={96}
                    />
                  </div>
                ) : (
                  <div className="mb-4">
                    <Upload className="text-gray-400 mr-2" size={24} />
                  </div>
                )}
                <p className="text-sm text-gray-500">Drag and Drop your SVG or Click to Upload</p>
                <input 
                  id="svg-upload" 
                  type="file" 
                  accept=".svg" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </div>
            </label>
          </div>
          <div className="block">
            <p className="text-sm font-bold mb-2 text-gray-500">Sample Logos</p>
            <div className="grid grid-cols-3 gap-2">
              {sampleIcons.map((icon, index) => (
                <div
                  key={index}
                  className="cursor-pointer bg-gray-100 rounded-lg p-2 text-center hover:bg-gray-200 transition-colors"
                  onClick={() => handleSampleClick(`/sample-svgs/${icon}`)}
                >
                  <Image
                    src={`/sample-svgs/${icon}`}
                    alt={icon}
                    width={50}
                    height={50}
                    className="mx-auto"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="extrusion-depth" className="block text-sm font-medium text-gray-700 mb-2">
            Extrusion Depth: {extrusionDepth}
          </label>
          <input
            type="range"
            id="extrusion-depth"
            min="1"
            max="50"
            value={extrusionDepth}
            onChange={(e) => setExtrusionDepth(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="metalness" className="block text-sm font-medium text-gray-700 mb-2">
            Metalness: {metalness.toFixed(2)}
          </label>
          <input
            type="range"
            id="metalness"
            min="0"
            max="1"
            step="0.01"
            value={metalness}
            onChange={(e) => setMetalness(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="roughness" className="block text-sm font-medium text-gray-700 mb-2">
            Roughness: {roughness.toFixed(2)}
          </label>
          <input
            type="range"
            id="roughness"
            min="0"
            max="1"
            step="0.01"
            value={roughness}
            onChange={(e) => setRoughness(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="exposure" className="block text-sm font-medium text-gray-700 mb-2">
            Exposure: {exposure.toFixed(2)}
          </label>
          <input
            type="range"
            id="exposure"
            min="0"
            max="2"
            step="0.01"
            value={exposure}
            onChange={(e) => setExposure(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="w-1/2 bg-blue-100 p-8 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
        <button
          className="absolute bottom-8 right-8 bg-black text-white rounded-full px-4 py-2 text-sm z-10 flex items-center" 
          onClick={handleExportSTL} 
          style={{ display: svgConverted ? 'flex' : 'none' }}
        >
          <Download className="mr-2" size={18} />
            Download 3D Logo (STL)
        </button>
        <button
          className="absolute bottom-8 left-8 bg-black text-white rounded-full px-4 py-2 text-sm z-10 flex items-center" 
          onClick={handleExportGLTF} 
          style={{ display: svgConverted ? 'flex' : 'none' }}
        >
          <Download className="mr-2" size={18} />
            Download 3D Logo (GLTF)
        </button>
      </div>
    </div>
  );
};

export default SVGTo3DConverter;