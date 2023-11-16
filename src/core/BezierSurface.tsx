// BezierSurface.tsx
import * as React from 'react';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';

// Function to generate control points for the Bezier surface
const generateControlPoints = (size: number): THREE.Vector3[] => {
    const controlPoints: THREE.Vector3[] = [];
    for (let i = 0; i < size; i++) {
      // Push new Vector3 with random coordinates into the array
      controlPoints.push(new THREE.Vector3(Math.random(), Math.random(), Math.random()));
    }
    return controlPoints;
  };
  

// Function to evaluate a point on a Bezier surface given control points and u, v parameters
const evaluateBezierSurface = (
    u: number,
    v: number,
    controlPoints: THREE.Vector3[]
  ): THREE.Vector3 => {
    // Implement the actual Bezier surface point calculation here
    // Placeholder for demonstration
    return new THREE.Vector3(u, v, Math.sin(u) * Math.cos(v));
  };

  
// Function to create the geometry of the Bezier surface
const createBezierGeometry = (
    accuracy: number,
    controlPoints: THREE.Vector3[]
  ): THREE.BufferGeometry => {
    
    const width = 1;
    const height = 1;
    const widthSegments = accuracy - 1;
    const heightSegments = accuracy - 1;
  
    // Correctly named PlaneBufferGeometry is used to create the geometry
    const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);

  
    // Get a reference to the position attribute
    const positionAttribute = geometry.attributes.position;
  
    // Modify the z component of each vertex
    for (let i = 0; i < positionAttribute.count; i++) {
      // Each vertex is a Vector3, composed of three values (x, y, z)
      const u = positionAttribute.getX(i) / width + 0.5;
      const v = positionAttribute.getY(i) / height + 0.5;
  
      // Here you would use the evaluateBezierSurface function to get the correct z value
      // For demonstration, we'll just use a simple function like before
      const zValue = Math.sin(u * Math.PI * 2) * Math.cos(v * Math.PI * 2);
  
      // Set the z component of the position attribute to the evaluated z value
      positionAttribute.setZ(i, zValue);
    }
  
    // Tell three.js that the position attribute needs to be updated on the GPU
    positionAttribute.needsUpdate = true;
  
    // Compute vertex normals if necessary
    geometry.computeVertexNormals();
  
    return geometry;
  };
  

const BezierSurface = ({ accuracy, texture, normalMap, kd, ks, specularExponent }) => {
  const { gl } = useThree();
  const controlPoints = generateControlPoints(16); // Assuming a 4x4 grid of control points

  // Create the geometry
  const geometry = useMemo(() => createBezierGeometry(accuracy, controlPoints), [accuracy, controlPoints]);

  // Define shaders
  const vertexShader = `
    varying vec3 vNormal;
    void main() {
      vNormal = normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fragmentShader = `
    uniform vec3 uLightColor;
    uniform vec3 uKd;
    uniform vec3 uKs;
    varying vec3 vNormal;
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0)); // Simple directional light
      float diff = max(dot(normal, lightDir), 0.0);
      vec3 diffuse = uKd * diff * uLightColor;
      gl_FragColor = vec4(diffuse, 1.0);
    }
  `;

  // Define material
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uLightColor: { value: new THREE.Color(1, 1, 1) },
      uKd: { value: new THREE.Vector3(kd, kd, kd) },
      uKs: { value: new THREE.Vector3(ks, ks, ks) },
      // Add more uniforms as needed
    },
  }), [kd, ks]);

  // Update the material on frame if necessary
  useFrame(() => {
    // Update uniforms or perform any animations
  });

  return (
    <mesh geometry={geometry} material={material}>
      {/* Add children or additional elements if needed */}
    </mesh>
  );
};

export default BezierSurface;
