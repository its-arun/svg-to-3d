/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push({
      'three/examples/jsm/loaders/SVGLoader': 'THREE.SVGLoader',
      'three/examples/jsm/controls/OrbitControls': 'THREE.OrbitControls',
      'three/examples/jsm/exporters/STLExporter': 'THREE.STLExporter',
    })
    return config
  },
}

export default nextConfig;
