// Three.js Globe Setup
let scene, camera, renderer, globe, markers = [];
let recoveredCount = 0;
let nextMarkerTime = 0;

// Mouse controls
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationVelocity = { x: 0, y: 0 };
let autoRotationSpeed = 0.002;

function init() {
    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Create globe
    createGlobe();
    
    // Initialize marker system
    initMarkers();
    
    // Position camera
    camera.position.z = 5;
    
    // Start animation loop
    animate();
    
    // Start counter animation
    animateCounter();
    
    // Add mouse controls
    addMouseControls();
}

function createGlobe() {
    const geometry = new THREE.SphereGeometry(2.5, 64, 32);
    
    // Create a wireframe material with minimal green
    const material = new THREE.MeshBasicMaterial({
        color: 0x004422,
        wireframe: true,
        opacity: 0.2,
        transparent: true
    });
    
    globe = new THREE.Mesh(geometry, material);
    scene.add(globe);
    
    // Add inner solid sphere for depth
    const solidGeometry = new THREE.SphereGeometry(2.48, 32, 16);
    const solidMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        opacity: 0.05,
        transparent: true
    });
    
    const solidGlobe = new THREE.Mesh(solidGeometry, solidMaterial);
    scene.add(solidGlobe);
}

function initMarkers() {
    // Set up first marker spawn time - start immediately for testing
    nextMarkerTime = Date.now() + 1000; // 1 second
}

function addMouseControls() {
    const canvas = renderer.domElement;
    
    canvas.addEventListener('mousedown', (event) => {
        isDragging = true;
        previousMousePosition = { x: event.clientX, y: event.clientY };
        canvas.style.cursor = 'grabbing';
    });
    
    canvas.addEventListener('mousemove', (event) => {
        if (!isDragging) return;
        
        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };
        
        // Update rotation velocity based on mouse movement
        rotationVelocity.x = deltaMove.y * 0.005;
        rotationVelocity.y = deltaMove.x * 0.005;
        
        previousMousePosition = { x: event.clientX, y: event.clientY };
    });
    
    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });
    
    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });
    
    // Set initial cursor
    canvas.style.cursor = 'grab';
}

function createMarker() {
    // Position marker on globe surface
    const phi = Math.acos(-1 + (2 * Math.random()));
    const theta = Math.random() * 2 * Math.PI;
    
    // Calculate base position on globe surface
    const baseRadius = 2.52;
    const baseX = baseRadius * Math.sin(phi) * Math.cos(theta);
    const baseY = baseRadius * Math.sin(phi) * Math.sin(theta);
    const baseZ = baseRadius * Math.cos(phi);
    
    // Create vertical line geometry going upward from the surface
    const lineHeight = 0.3 + Math.random() * 0.4; // Random height between 0.3 and 0.7
    const points = [];
    
    // Base point on globe surface
    points.push(new THREE.Vector3(baseX, baseY, baseZ));
    
    // Top point extending outward from globe center
    const direction = new THREE.Vector3(baseX, baseY, baseZ).normalize();
    const topPoint = new THREE.Vector3(baseX, baseY, baseZ).add(direction.multiplyScalar(lineHeight));
    points.push(topPoint);
    
    // Create line geometry
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff44,
        transparent: true,
        opacity: 1,
        linewidth: 2
    });
    
    const marker = new THREE.Line(lineGeometry, lineMaterial);
    
    // Add a small glowing point at the top
    const pointGeometry = new THREE.SphereGeometry(0.02, 8, 8);
    const pointMaterial = new THREE.MeshBasicMaterial({
        color: 0x44ff66,
        transparent: true,
        opacity: 1
    });
    
    const topPoint3D = new THREE.Mesh(pointGeometry, pointMaterial);
    topPoint3D.position.copy(topPoint);
    
    // Create a group to hold both line and point
    const markerGroup = new THREE.Group();
    markerGroup.add(marker);
    markerGroup.add(topPoint3D);
    
    // Store data for animation and rotation
    markerGroup.userData = {
        phi: phi,
        theta: theta,
        spawnTime: Date.now(),
        lifetime: 8000, // 8 seconds for better visibility
        animPhase: 0,
        baseRadius: baseRadius,
        lineHeight: lineHeight,
        topPoint: topPoint3D,
        line: marker
    };
    
    markers.push(markerGroup);
    scene.add(markerGroup);
}

function animate() {
    requestAnimationFrame(animate);
    
    // Handle globe rotation
    if (isDragging) {
        // Apply manual rotation while dragging
        globe.rotation.x += rotationVelocity.x;
        globe.rotation.y += rotationVelocity.y;
        // Dampen the velocity
        rotationVelocity.x *= 0.95;
        rotationVelocity.y *= 0.95;
    } else {
        // Auto rotation when not dragging
        globe.rotation.y += autoRotationSpeed;
        // Apply momentum from manual rotation
        globe.rotation.x += rotationVelocity.x;
        globe.rotation.y += rotationVelocity.y;
        // Gradually return to auto rotation
        rotationVelocity.x *= 0.98;
        rotationVelocity.y *= 0.98;
    }
    
    const currentTime = Date.now();
    
    // Spawn new markers occasionally
    if (currentTime >= nextMarkerTime) {
        createMarker();
        // Schedule next marker spawn (3-8 seconds)
        nextMarkerTime = currentTime + Math.random() * 5000 + 3000;
    }
    
    // Update existing markers
    markers.forEach((markerGroup, index) => {
        const age = currentTime - markerGroup.userData.spawnTime;
        const progress = age / markerGroup.userData.lifetime;
        
        if (progress >= 1) {
            // Remove expired marker
            scene.remove(markerGroup);
            markers.splice(index, 1);
            return;
        }
        
        // Rotate marker position with globe
        const currentTheta = markerGroup.userData.theta + globe.rotation.y;
        const baseRadius = markerGroup.userData.baseRadius;
        const baseX = baseRadius * Math.sin(markerGroup.userData.phi) * Math.cos(currentTheta);
        const baseY = baseRadius * Math.sin(markerGroup.userData.phi) * Math.sin(currentTheta);
        const baseZ = baseRadius * Math.cos(markerGroup.userData.phi);
        
        // Update line geometry
        const direction = new THREE.Vector3(baseX, baseY, baseZ).normalize();
        const topPoint = new THREE.Vector3(baseX, baseY, baseZ).add(direction.multiplyScalar(markerGroup.userData.lineHeight));
        
        const points = [
            new THREE.Vector3(baseX, baseY, baseZ),
            topPoint
        ];
        
        markerGroup.userData.line.geometry.setFromPoints(points);
        markerGroup.userData.topPoint.position.copy(topPoint);
        
        // Animate opacity - fade in, stay, fade out
        let opacity;
        if (progress < 0.15) {
            // Fade in
            opacity = progress / 0.15;
        } else if (progress > 0.85) {
            // Fade out
            opacity = (1 - progress) / 0.15;
        } else {
            // Stay visible
            opacity = 1;
        }
        
        markerGroup.userData.line.material.opacity = opacity * 0.8;
        markerGroup.userData.topPoint.material.opacity = opacity * 0.9;
        
        // Subtle pulse effect on the top point
        markerGroup.userData.animPhase += 0.04;
        const pulse = 1 + Math.sin(markerGroup.userData.animPhase) * 0.2;
        markerGroup.userData.topPoint.scale.set(pulse, pulse, pulse);
    });
    
    renderer.render(scene, camera);
}

function animateCounter() {
    // Remove counter animation - no longer needed
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onWindowResize);

// Initialize when page loads
window.addEventListener('load', init);

// Particle system for extra visual flair
// Removed particles for minimal aesthetic