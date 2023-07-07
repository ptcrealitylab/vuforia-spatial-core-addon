const vertexMesh_vertexShader = `
	varying vec2 vUv;
  varying vec3 vNormal;
	void main() {
  	vUv = uv;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const vertexMesh_fragmentShader = `
    #define blur 0.1
  #define blue vec3(0., 0., 1.)
  #define white vec3(1.)
  
	varying vec2 vUv;
  varying vec3 vNormal;
  uniform vec3 camDir;
  
  void main() {
  	float d = dot(vNormal, normalize(camDir));
   	d = smoothstep(.7 + blur, .7 - blur, d);
   	
    vec3 col = mix(blue, white, d);
  	
  	gl_FragColor = vec4(col, 1.);
  }
`;

const gizmoPlane_vertexShader = `
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const gizmoPlane_fragmentShader = `
    varying vec2 vUv;
    
    void main() {
        gl_FragColor = vec4(0., 0., 0., 1.);
    }
`;
