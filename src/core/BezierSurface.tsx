// BezierSurface.tsx
import * as React from 'react';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';

// Function to generate control points for the Bezier surface
const generateControlPoints = (): THREE.Vector3[][] => {
  const controlPoints: THREE.Vector3[][] = [];
  for (let i = 0; i < 4; i++) {
    controlPoints[i] = [];
    for (let j = 0; j < 4; j++) {
      const z = -((i - 1.5) ** 2) - (j - 1.5) ** 2 + 4;
      controlPoints[i].push(new THREE.Vector3(i - 1.5, j - 1.5, z));
    }
  }
  return controlPoints;
};

// Bernstein polynomial
const B = (i: number, n: number, t: number): number => {
  return binomialCoefficient(n, i) * t ** i * (1 - t) ** (n - i);
};

// Binomial coefficient
const binomialCoefficient = (n: number, k: number) => {
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n + 1 - i) / i;
  }
  return result;
};


// Function to evaluate a point on a Bezier surface given control points and u, v parameters
const evaluateBezierSurface = (
  u: number,
  v: number,
  controlPoints: THREE.Vector3[][]
): THREE.Vector3 => {
  let point = new THREE.Vector3(0, 0, 0);
  const n = controlPoints.length - 1;

  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const bernsteinU = B(i, n, u);
      const bernsteinV = B(j, n, v);
      const controlPoint = controlPoints[i][j];

      point.x += bernsteinU * bernsteinV * controlPoint.x;
      point.y += bernsteinU * bernsteinV * controlPoint.y;
      point.z += bernsteinU * bernsteinV * controlPoint.z;
    }
  }

  return point;
};


// Function to create vertices for a Bezier surface based on control points
const createBezierVertices = (
  accuracy: number,
  controlPoints: THREE.Vector3[][]
): Float32Array => {
  const vertices: any = [];
  for (let i = 0; i <= accuracy; i++) {
    const u = i / accuracy;
    for (let j = 0; j <= accuracy; j++) {
      const v = j / accuracy;
      const point = evaluateBezierSurface(u, v, controlPoints);
      vertices.push(point.x, point.y, point.z);
    }
  }
  return new Float32Array(vertices);
};

// Function to create the geometry of the Bezier surface
const createBezierGeometry = (
    accuracy: number,
    controlPoints: THREE.Vector3[][]
  ): THREE.BufferGeometry => {
    
    const width = 40;
    const height = 40;
    const widthSegments = accuracy - 1;
    const heightSegments = accuracy - 1;

    const vertices = createBezierVertices(accuracy, controlPoints);

    const indices: number[] = [];
    for (let i = 0; i < accuracy; i++) {
      for (let j = 0; j < accuracy; j++) {
        const a = i * (accuracy + 1) + j;
        const b = a + accuracy + 1;
        const c = a + 1;
        const d = b + 1;

        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

  
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
  
    return geometry;
  
    // Correctly named PlaneBufferGeometry is used to create the geometry
    //const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);

  
    // // Get a reference to the position attribute
    // const positionAttribute = geometry.attributes.position;
  
    // // Modify the z component of each vertex
    // for (let i = 0; i < positionAttribute.count; i++) {
    //   // Each vertex is a Vector3, composed of three values (x, y, z)
    //   const u = positionAttribute.getX(i) / width + 0.5;
    //   const v = positionAttribute.getY(i) / height + 0.5;
  
    //   // Here you would use the evaluateBezierSurface function to get the correct z value
    //   // For demonstration, we'll just use a simple function like before
    //   const zValue = Math.sin(u * Math.PI * 2) * Math.cos(v * Math.PI * 2);
  
    //   // Set the z component of the position attribute to the evaluated z value
    //   positionAttribute.setZ(i, zValue);
    // }

  //   const positions = geometry.attributes.position.array;

  //   // Loop through the position array and update the z values
  //   for (let i = 0; i < positions.length; i += 3) {
  //     const u = positions[i] + 0.5;
  //     const v = positions[i + 1] + 0.5;
  //     const point = evaluateBezierSurface(u, v, controlPoints);
  //     positions[i + 2] = point.z; // Update the z component based on the Bezier surface
  //   }
  
  //   // Tell three.js that the position attribute needs to be updated on the GPU
  //  // positionAttribute.needsUpdate = true;
  //   geometry.attributes.position.needsUpdate = true;

  
  //   // Compute vertex normals if necessary
  //   geometry.computeVertexNormals();
  
  //   return geometry;
  };
  
interface BezierSurfaceProps {
  accuracy: number;
  texture?: THREE.Texture;
  normalMap?: THREE.Texture;
  kd: number;
  ks: number;
  specularExponent: number;
  lightColor: string;
}

const BezierSurface: React.FC<BezierSurfaceProps> = ({ accuracy, texture, normalMap, kd, ks, specularExponent, lightColor }) => {
  const meshRef = React.useRef<THREE.Mesh>(null);
  const controlPoints = generateControlPoints();
  const geometry = useMemo(() => createBezierGeometry(accuracy, controlPoints), [
    accuracy,
    controlPoints,
  ]);

  // Define shaders
  const vertexShader = `
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vNormal = normal;
      vUv = uv;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fragmentShader = `
  uniform vec3 uLightColor;
  uniform vec3 uLightPosition;
  uniform vec3 uViewPosition;
  uniform float uKd;
  uniform float uKs;
  uniform float uShininess;
  varying vec3 vNormal;
  varying vec2 vUv;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(uLightPosition - vNormal);
    vec3 viewDir = normalize(uViewPosition - vNormal);
    vec3 reflectDir = reflect(-lightDir, normal);
  
    // Diffuse component
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = uKd * uLightColor * diff;
  
    // Specular component
    float spec = 0.0;
    if(diff > 0.0) { // Only calculate specular if light hits the surface
      spec = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
    }
    vec3 specular = uKs * uLightColor * spec;
  
    // Combine results
    vec3 result = diffuse + specular;
    gl_FragColor = vec4(result, 1.0);
  }
  
  `;

  // Define material
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uLightColor: { value: new THREE.Color(lightColor) }, 
      //uLightColor: { value: new THREE.Color(1, 1, 1) },
      uObjectColor: { value: new THREE.Color(1, 1, 1) }, // Default white, should be changed based on IO
      uLightPosition: { value: new THREE.Vector3(10, 10, 10) }, // Example position, should be animated
      uViewPosition: { value: new THREE.Vector3(0, 0, 10) }, // Camera position
      uKd: { value: kd },
      uKs: { value: ks },
      uShininess: { value: specularExponent }
    },
  }), [kd, ks, specularExponent, lightColor]);

  // const meshRef = React.useRef();
  // const { gl, camera } = useThree();
  // const controlPoints = generateControlPoints();

  // const geometry = useMemo(() => createBezierGeometry(accuracy, controlPoints), [accuracy, controlPoints]);

  // Update the material on frame if necessary
  useFrame(({clock}) => {
    // Update uniforms or perform any animations

    if (meshRef.current) {
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.1;
    }
  });

  return (
    <mesh ref={meshRef}  geometry={geometry} material={material}>
      {/* Add children or additional elements if needed */}
    </mesh>
  );
};

export default BezierSurface;
