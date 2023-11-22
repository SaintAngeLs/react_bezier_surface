// BezierSurface.tsx
import * as React from 'react';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { useLoader, extend } from '@react-three/fiber';
import { LineSegments, EdgesGeometry, LineBasicMaterial } from 'three';
import { OrthographicCamera } from 'three';
extend({ OrthographicCamera });


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

    const barycentric: number[] = []; // This array will store the barycentric coordinates

    // Loop through each triangle to assign barycentric coordinates
    for (let i = 0; i < indices.length; i += 3) {
      barycentric.push(
        1, 0, 0, 
        0, 1, 0, 
        0, 0, 1 
      );
    }

    const barycentricAttribute = new Float32Array(barycentric);
    geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentricAttribute, 3));
      
    return geometry;

};

// Function to create the wireframe geometry of the Bezier surface
const createBezierWireframeGeometry = (
  accuracy: number,
  controlPoints: THREE.Vector3[][]
): THREE.BufferGeometry => {
  // First, create the vertices for the Bezier surface
  const vertices3D = createBezierVertices(accuracy, controlPoints);

  // Flatten the z-coordinate of each vertex to project it onto the XY plane
  for (let i = 0; i < vertices3D.length / 3; i++) {
    vertices3D[i * 3 + 2] = 0; // Set the Z-coordinate to 0
  }

  // Create a new buffer geometry to hold the wireframe
  const wireframeGeometry = new THREE.BufferGeometry();

  // Create an array to hold the indices for the line segments
  const lineIndices: number[] = [];

  // Loop through each grid cell to generate two triangles (as lines)
  for (let i = 0; i < accuracy; i++) {
    for (let j = 0; j < accuracy; j++) {
      // Calculate the indices of the corners of the cell
      const a = i * (accuracy + 1) + j;
      const b = a + accuracy + 1;
      const c = a + 1;
      const d = b + 1;

      // Add the lines for the triangles
      lineIndices.push(a, b, b, d, d, a); // first triangle
      lineIndices.push(b, c, c, a); // second triangle (note: one line is already added)
    }
  }

  // Add the vertices and line indices to the geometry
  wireframeGeometry.setIndex(lineIndices);
  wireframeGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices3D), 3));
  
  // Return the wireframe geometry
  return wireframeGeometry;
};



  
interface BezierSurfaceProps {
  accuracy: number;
  texture?: string;
  normalMap?: string;
  kd: number;
  ks: number;
  specularExponent: number;
  lightColor: string;
  animateLight: boolean;
  objectColor: string | THREE.Color;
  showGrid?: boolean;
  useNormalMap: boolean
  
}

const BezierSurface: React.FC<BezierSurfaceProps> = ({ 
  accuracy, 
  texture: textureProp = '', 
  normalMap: normalMapProp = '', 
  kd, 
  ks, 
  specularExponent, 
  objectColor,
  lightColor, 
  animateLight, 
  showGrid = true,
  useNormalMap,
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

    attribute vec3 barycentric; // Add barycentric attribute
    varying vec3 vBarycentric;

    varying vec3 vTangent;
    varying vec3 vBitangent;

    

    void main() {
      vNormal = normal;
      vUv = uv;

      vBarycentric = barycentric;

      vec3 c1 = cross(normal, vec3(0.0, 0.0, 1.0));
      vec3 c2 = cross(normal, vec3(0.0, 1.0, 0.0));

      vTangent = length(c1) > length(c2) ? c1 : c2;
      vTangent = normalize(vTangent);
      vBitangent = normalize(cross(normal, vTangent));

      // gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

      // Flatten the z-coordinate to project the vertices onto the XY plane
      vec4 modelViewPosition = modelViewMatrix * vec4(position.x, position.y, 0.0, 1.0);
      gl_Position = projectionMatrix * modelViewPosition;
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
  varying vec3 vBarycentric;
  
  uniform sampler2D uTexture;
  uniform bool uUseTexture;

  varying vec3 vTangent;
  varying vec3 vBitangent;

  

  uniform sampler2D uNormalMap;
  uniform bool uUseNormalMap;
  
  void main() {
    vec3 modulatedNormal = vNormal;
    if (uUseNormalMap) {
      vec3 normalTexture = texture2D(uNormalMap, vUv).rgb;
      normalTexture = normalTexture * 2.0 - 1.0;
      vec3 Nsurface = normalize(vNormal);
      vec3 B = normalize(cross(Nsurface, vec3(0.0, 0.0, 1.0)));
      if (length(B) < 0.0001) {
        B = vec3(0.0, 1.0, 0.0);
      }
      vec3 T = normalize(cross(B, Nsurface));
      mat3 TBN = mat3(T, B, Nsurface);
      modulatedNormal = normalize(TBN * normalTexture);
    }

    vec3 lightDir = normalize(uLightPosition - vNormal);
    vec3 viewDir = normalize(uViewPosition - vNormal);
    vec3 reflectDir = reflect(-lightDir, modulatedNormal);
  
    float lambertian = max(dot(modulatedNormal, lightDir), 0.0);
    float spec = 0.0;
    if (lambertian > 0.0) {
      float specular = pow(max(dot(viewDir, reflectDir), 0.0), uShininess);
      spec = uKs * specular;
    }
    vec3 lighting = uKd * uLightColor * lambertian + spec;

    vec4 texelColor = uUseTexture ? texture2D(uTexture, vUv) : vec4(1.0);
    gl_FragColor = vec4(texelColor.rgb * lighting, texelColor.a) * vec4(uObjectColor, 1.0);
  }
  `;
  const [sometexture, setTexture] = React.useState<THREE.Texture | null>(null);
  const [edgesGeometry, setEdgesGeometry] = React.useState<THREE.EdgesGeometry | null>(null);


  const { size, scene, gl } = useThree(); // use scene and gl from useThree hook
  const orthoCameraRef = React.useRef<THREE.OrthographicCamera>(); 

  useMemo(() => {
    const aspect = size.width / size.height;
    // Make sure the orthographic camera's frustum encompasses the area of interest
    const camera = new THREE.OrthographicCamera(
      -aspect * 10, aspect * 10, 10, -10, 0.01, 1000
    );
    camera.position.set(0, 0, 10); // Set the camera to look down the Z-axis
    camera.lookAt(new THREE.Vector3(0, 0, 0)); // Look at the center of the XY plane
    orthoCameraRef.current = camera;
    scene.add(camera);
  }, [size.width, size.height]);

  useFrame(() => {
    const camera = orthoCameraRef.current;
    if (camera) {
      // Render the scene using the orthographic camera
      gl.render(scene, camera);
    }
  });



  // Inside your component:
  const texture = textureProp ? useLoader(THREE.TextureLoader, textureProp) : undefined;
  const normalMap = normalMapProp ? useLoader(THREE.TextureLoader, normalMapProp) : undefined;

  React.useEffect(() => {
    // Since texture and normalMap could be undefined, check before using them
    if (texture) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
    }
    if (normalMap) {
      normalMap.wrapS = THREE.RepeatWrapping;
      normalMap.wrapT = THREE.RepeatWrapping;
    }
  }, [texture, normalMap]);

  React.useEffect(() => {
    if (texture instanceof THREE.Texture) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    if (normalMap instanceof THREE.Texture) normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  }, [texture, normalMap]);

  

  React.useEffect(() => {
    if (showGrid) {
      // Create edges geometry from the main geometry
      // const edges = new THREE.EdgesGeometry(geometry);
      // setEdgesGeometry(edges);
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
  const [loadedNormalMap, setLoadedNormalMap] = React.useState<THREE.Texture | null>(null);


    // Load the texture when the textureProp changes
    React.useEffect(() => {
      if (typeof textureProp === 'string' && textureProp !== '') {
        new THREE.TextureLoader().load(textureProp, setLoadedTexture);
      }
    }, [textureProp]);
  
    // Load the normal map when the normalMapProp changes
    React.useEffect(() => {
      if (typeof normalMapProp === 'string' && normalMapProp !== '') {
        const loader = new THREE.TextureLoader();
        loader.load(normalMapProp, (texture) => {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          setLoadedNormalMap(texture);
        });
      } else {
        setLoadedNormalMap(null); // Reset normal map if the prop is not a string or is empty
      }
    }, [normalMapProp]);
  
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
      uNormalMap: { value: loadedNormalMap || new THREE.Texture() },
      uUseNormalMap: { value: !!loadedNormalMap && useNormalMap }
    };

    // Create the ShaderMaterial
    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: uniforms,
    });

    // If a texture is provided, set the map to the texture
  

    return shaderMaterial;
  }, [kd, ks, specularExponent, lightColor, loadedTexture,  loadedNormalMap, useNormalMap]); // Include 'texture' in the dependency array



  // Update the material on frame if necessary
  useFrame(({clock}) => {
    // Update uniforms or perform any animations

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
    const camera = orthoCameraRef.current;
  
  });

  // const wireframeMaterial = useMemo(() => new LineBasicMaterial({ color: 0x000000 }), []);
  // const edgesGeometry = useMemo(() => new EdgesGeometry(geometry), [geometry]);

  const wireframeGeometry = useMemo(() => {
    // Generate the wireframe geometry based on the projected vertices
    return createBezierWireframeGeometry(accuracy, controlPoints);
  }, [accuracy, controlPoints]);
  // const { size, scene, gl } = useThree(); // use scene and gl from useThree hook
  // const orthoCameraRef = React.useRef(); // useRef to keep reference to the camera



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
