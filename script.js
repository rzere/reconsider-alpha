// WebGL Perlin Noise Setup - Based on TypeGPU Perlin Noise example
let gl, program, timeUniformLocation, resolutionUniformLocation, gridSizeUniformLocation, sharpnessUniformLocation;
let animationFrameId;

// Vertex shader source - simple full-screen quad
const vertexShaderSource = `
    attribute vec2 a_position;
    
    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
    }
`;

// Fragment shader source with 3D Perlin Noise implementation (inspired by TypeGPU)
const fragmentShaderSource = `
    precision highp float;
    
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_gridSize;
    uniform float u_sharpness;
    
    // Hash function for pseudo-random gradient vectors
    vec3 hash(vec3 p) {
        p = vec3(
            dot(p, vec3(127.1, 311.7, 74.7)),
            dot(p, vec3(269.5, 183.3, 246.1)),
            dot(p, vec3(113.5, 271.9, 124.6))
        );
        return fract(sin(p) * 43758.5453123);
    }
    
    // Smooth interpolation
    float smoothstep5(float t) {
        return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    }
    
    // 3D Perlin Noise
    float perlin3d(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        
        // Smooth interpolation
        vec3 u = f * f * (3.0 - 2.0 * f);
        // Better smoothstep
        vec3 u2 = vec3(
            smoothstep5(f.x),
            smoothstep5(f.y),
            smoothstep5(f.z)
        );
        
        // Get gradient vectors at 8 corners of cube
        vec3 g000 = hash(i + vec3(0.0, 0.0, 0.0)) * 2.0 - 1.0;
        vec3 g100 = hash(i + vec3(1.0, 0.0, 0.0)) * 2.0 - 1.0;
        vec3 g010 = hash(i + vec3(0.0, 1.0, 0.0)) * 2.0 - 1.0;
        vec3 g110 = hash(i + vec3(1.0, 1.0, 0.0)) * 2.0 - 1.0;
        vec3 g001 = hash(i + vec3(0.0, 0.0, 1.0)) * 2.0 - 1.0;
        vec3 g101 = hash(i + vec3(1.0, 0.0, 1.0)) * 2.0 - 1.0;
        vec3 g011 = hash(i + vec3(0.0, 1.0, 1.0)) * 2.0 - 1.0;
        vec3 g111 = hash(i + vec3(1.0, 1.0, 1.0)) * 2.0 - 1.0;
        
        // Distance vectors from corners
        vec3 d000 = f - vec3(0.0, 0.0, 0.0);
        vec3 d100 = f - vec3(1.0, 0.0, 0.0);
        vec3 d010 = f - vec3(0.0, 1.0, 0.0);
        vec3 d110 = f - vec3(1.0, 1.0, 0.0);
        vec3 d001 = f - vec3(0.0, 0.0, 1.0);
        vec3 d101 = f - vec3(1.0, 0.0, 1.0);
        vec3 d011 = f - vec3(0.0, 1.0, 1.0);
        vec3 d111 = f - vec3(1.0, 1.0, 1.0);
        
        // Dot products
        float n000 = dot(g000, d000);
        float n100 = dot(g100, d100);
        float n010 = dot(g010, d010);
        float n110 = dot(g110, d110);
        float n001 = dot(g001, d001);
        float n101 = dot(g101, d101);
        float n011 = dot(g011, d011);
        float n111 = dot(g111, d111);
        
        // Trilinear interpolation
        float x00 = mix(n000, n100, u2.x);
        float x10 = mix(n010, n110, u2.x);
        float x01 = mix(n001, n101, u2.x);
        float x11 = mix(n011, n111, u2.x);
        
        float y0 = mix(x00, x10, u2.y);
        float y1 = mix(x01, x11, u2.y);
        
        return mix(y0, y1, u2.z);
    }
    
    // Exponential sharpening function (like TypeGPU)
    float exponentialSharpen(float n, float sharpness) {
        return sign(n) * pow(abs(n), 1.0 - sharpness);
    }
    
    void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        
        // Scale by grid size (like TypeGPU)
        vec2 p = uv * u_gridSize;
        
        // Add time as third dimension (loops every 10 seconds like TypeGPU DEPTH=10)
        float time = mod(u_time * 0.0002, 10.0);
        vec3 pos = vec3(p, time);
        
        // Sample 3D Perlin noise
        float n = perlin3d(pos);
        
        // Apply sharpening
        float sharp = exponentialSharpen(n, u_sharpness);
        
        // Map to 0-1 range
        float n01 = sharp * 0.5 + 0.5;
        
        // Gradient map (like TypeGPU: dark blue to light pink)
        vec3 human = vec3(1.0, 0.84, 0.65);  // #FFD6A5
        vec3 ai    = vec3(0.23, 0.31, 0.48);  // #3A4E7A
        vec3 color = mix(ai, human, n01);
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        console.error('Shader compilation error:', error);
        console.error('Shader source:', source);
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(program);
        console.error('Program linking error:', error);
        gl.deleteProgram(program);
        return null;
    }
    
    return program;
}

function init() {
    const container = document.getElementById('canvas-container');
    
    if (!container) {
        console.error('Canvas container not found');
        return;
    }
    
    // Create canvas element inside the container
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    
    container.appendChild(canvas);
    
    // Try to get WebGL context
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
        console.error('WebGL not supported');
        container.innerHTML = '<div style="color: white; padding: 20px;">WebGL not supported in your browser</div>';
        return;
    }
    
    // Create shaders
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
        console.error('Failed to create shaders');
        return;
    }
    
    // Create program
    program = createProgram(gl, vertexShader, fragmentShader);
    
    if (!program) {
        console.error('Failed to create program');
        return;
    }
    
    // Create full-screen quad
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
    ]), gl.STATIC_DRAW);
    
    // Get attribute and uniform locations
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    timeUniformLocation = gl.getUniformLocation(program, 'u_time');
    resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
    gridSizeUniformLocation = gl.getUniformLocation(program, 'u_gridSize');
    sharpnessUniformLocation = gl.getUniformLocation(program, 'u_sharpness');
    
    // Check if uniforms are found
    if (timeUniformLocation === -1 || resolutionUniformLocation === -1 || 
        gridSizeUniformLocation === -1 || sharpnessUniformLocation === -1) {
        console.error('Uniform location not found');
    }
    
    // Set up rendering
    function render(time) {
        // Resize canvas
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            gl.viewport(0, 0, displayWidth, displayHeight);
        }
        
        // Clear canvas
        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Use program
        gl.useProgram(program);
        
        // Set uniforms
        gl.uniform1f(timeUniformLocation, time);
        gl.uniform2f(resolutionUniformLocation, displayWidth, displayHeight);
        gl.uniform1f(gridSizeUniformLocation, 4.0); // Default grid size like TypeGPU
        gl.uniform1f(sharpnessUniformLocation, 0.5); // Default sharpness
        
        // Set up position attribute
        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        animationFrameId = requestAnimationFrame(render);
    }
    
    // Start animation
    animationFrameId = requestAnimationFrame(render);
}

// Handle window resize
function onWindowResize() {
    // Canvas resize is handled in the render loop
}

window.addEventListener('resize', onWindowResize);

// Initialize when page loads
window.addEventListener('load', init);
