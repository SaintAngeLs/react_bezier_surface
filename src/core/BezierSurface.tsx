// BezierSurface.tsx
import * as React from 'react';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { LineSegments, EdgesGeometry, LineBasicMaterial } from 'three';


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

    const uvs = new Float32Array((accuracy + 1) * (accuracy + 1) * 2);

    const indices: number[] = [];
    for (let i = 0; i < accuracy; i++) 
    {
      for (let j = 0; j < accuracy; j++) 
      {
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
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); 
    geometry.computeVertexNormals();
  
    return geometry;

  };
  
interface BezierSurfaceProps {
  accuracy: number;
  texture?: THREE.Texture;
  normalMap?: THREE.Texture;
  kd: number;
  ks: number;
  specularExponent: number;
  lightColor: string;
  animateLight: boolean;
  objectColor: string | THREE.Color;
  showGrid?: boolean;
  
}

const BezierSurface: React.FC<BezierSurfaceProps> = ({ 
  accuracy, 
  texture: textureProp, 
  normalMap, 
  kd, 
  ks, 
  specularExponent, 
  objectColor,
  lightColor, 
  animateLight, 
  showGrid = true,
}) => {
  const meshRef = React.useRef<THREE.Mesh>(null);
  const controlPoints = generateControlPoints();
  const geometry = useMemo(() => createBezierGeometry(accuracy, controlPoints), [
    accuracy,
    controlPoints,
  ]);

  const lightRef = React.useRef<THREE.PointLight>(null);

  
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
  uniform vec3 uObjectColor;
  uniform float uKd;
  uniform float uKs;
  uniform float uShininess;
  varying vec3 vNormal;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform bool uUseTexture;
  

  uniform sampler2D uNormalMap;
  uniform bool uUseNormalMap;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(uLightPosition - vNormal);
    vec3 viewDir = normalize(uViewPosition - vNormal);
    vec3 reflectDir = reflect(-lightDir, normal);
   
  
    // Lambertian reflectance
    float lambertian = max(dot(normal, lightDir), 0.0);
    // Specular reflectance
    float spec = 0.0;
    if (lambertian > 0.0) {
      float specular = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
      spec = uKs * specular;
    }
    vec3 lighting = uKd * uLightColor * lambertian + spec;

    // Apply normal mapping
    if (uUseNormalMap) {
      vec3 normalTexture = texture2D(uNormalMap, vUv).rgb;
      normalTexture = normalTexture * 2.0 - 1.0; // Remap from [0, 1] to [-1, 1]
      // Transform the normal from tangent to world space
      normal = normalize(normal + normalTexture);
    }

    // Texture color
    vec4 texelColor = vec4(1.0);
    if (uUseTexture) {
      texelColor = texture2D(uTexture, vUv);
    }

       if (uUseTexture) {
      vec4 texelColor = texture2D(uTexture, vUv);
      gl_FragColor = vec4(texelColor.rgb * lighting, texelColor.a);
    } else {
      gl_FragColor = vec4(uObjectColor * lighting, 1.0);
    }
       
  }
  
  `;
  const [sometexture, setTexture] = React.useState<THREE.Texture | null>(null);
  const [edgesGeometry, setEdgesGeometry] = React.useState<THREE.EdgesGeometry | null>(null);

  const texture = useMemo(() => {
    if (textureProp instanceof THREE.Texture) {
      return textureProp;
    }  else if (typeof textureProp === 'string' && textureProp !== '') {
      return new THREE.TextureLoader().load(textureProp, setTexture);
    }
    return null; // Return undefined or a default texture if no path is provided
  }, [textureProp]);


  React.useEffect(() => {
    if (showGrid) {
      // Create edges geometry from the main geometry
      const edges = new THREE.EdgesGeometry(geometry);
      setEdgesGeometry(edges);
    } else {
      // Dispose of edges geometry when not shown
      if (edgesGeometry) {
        edgesGeometry.dispose();
      }
      setEdgesGeometry(null);
    }

    // Cleanup function to dispose of geometry on unmount or when showGrid turns false
    return () => {
      if (edgesGeometry) {
        edgesGeometry.dispose();
      }
    };
  }, [showGrid, geometry]);


  const [loadedTexture, setLoadedTexture] = React.useState<THREE.Texture | null>(null);

  // Load the texture when the textureProp changes
  React.useEffect(() => {
    if (textureProp instanceof File) {
      const reader = new FileReader();
      reader.onload = (event: any) => {
        const dataUrl = event.target.result;
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(dataUrl, (loadedTexture) => {
          setLoadedTexture(loadedTexture);
          if (meshRef.current) {
            const material = meshRef.current.material as THREE.ShaderMaterial;
            material.uniforms.uTexture.value = loadedTexture;
            material.uniforms.uUseTexture.value = true;
            material.needsUpdate = true;
          }
        }, undefined, (error) => {
          console.error('Texture loading error:', error);
        });
      };
      reader.readAsDataURL(textureProp);
    }
  }, [textureProp]);
  
  const defaultObjectColor = new THREE.Color('#ffffff');

  // Define material
  const material = useMemo(() => {
    // Define uniforms for the ShaderMaterial
    const uniforms = {
      uLightColor: { value: new THREE.Color(lightColor) },
      uLightPosition: { value: new THREE.Vector3(10, 10, 10) },
      uViewPosition: { value: new THREE.Vector3(0, 0, 10) },
      uKd: { value: kd },
      uKs: { value: ks },
      uShininess: { value: specularExponent },
      uTexture: { value: loadedTexture || new THREE.Texture() }, // Add this line to pass the texture to the shader
      uUseTexture: { value: !!loadedTexture },
      uObjectColor: { value: new THREE.Color(objectColor) },

      uNormalMap: { value: normalMap || new THREE.Texture() }, // Add this line to pass the normal map to the shader
      uUseNormalMap: { value: normalMap instanceof THREE.Texture },
    };

    // Create the ShaderMaterial
    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: uniforms,
    });

    // If a texture is provided, set the map to the texture
    if (texture instanceof THREE.Texture) {
      shaderMaterial.uniforms.uTexture.value = texture;
    }

    return shaderMaterial;
  }, [kd, ks, specularExponent, lightColor, loadedTexture, normalMap]); // Include 'texture' in the dependency array


  // Update the material on frame if necessary
  useFrame(({clock}) => {
    // Update uniforms or perform any animations

    if (meshRef.current) {
      meshRef.current.rotation.z = clock.getElapsedTime() * 0.1;
    }
    if (animateLight && lightRef.current) {
      // Animate the light around the z-axis
      const elapsedTime = clock.getElapsedTime();
      const radius = 5; // Adjust as necessary
      lightRef.current.position.x = Math.sin(elapsedTime) * radius;
      lightRef.current.position.y = Math.cos(elapsedTime) * radius;
      
      // Update the shader uniform for light position
      material.uniforms.uLightPosition.value.copy(lightRef.current.position);

       // Spiral light animation
      //  const elapsedTime = clock.getElapsedTime();
      //  const a = 5; // Spiral radius
      //  const b = 0.2; // Spiral tightness
      //  lightRef.current.position.x = a * Math.cos(b * elapsedTime) * Math.sin(elapsedTime);
      //  lightRef.current.position.y = a * Math.sin(b * elapsedTime) * Math.sin(elapsedTime);
      //  lightRef.current.position.z = a * Math.cos(elapsedTime); // This will create a spiral in the z=const plane
 
      //  // Update the shader uniform for light position
      //  material.uniforms.uLightPosition.value.copy(lightRef.current.position);
    }
  });

  // const wireframeMaterial = useMemo(() => new LineBasicMaterial({ color: 0x000000 }), []);
  // const edgesGeometry = useMemo(() => new EdgesGeometry(geometry), [geometry]);

  const wireframeGeometry = useMemo(() => new THREE.WireframeGeometry(geometry), [geometry]);

  return (
    <>
      <mesh ref={meshRef} geometry={geometry} material={material}>
        {/* Add children or additional elements if needed */}
      </mesh>
      {showGrid && (
        <lineSegments
          geometry={wireframeGeometry}
          material={new THREE.LineBasicMaterial({ color: 0x000000 })}
        />
      )}
      <pointLight ref={lightRef} color={lightColor} position={new THREE.Vector3(10, 10, 10)} />
    </>
  );
};

export default BezierSurface;
