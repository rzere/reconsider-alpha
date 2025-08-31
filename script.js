// Three.js Globe Setup
let scene, camera, renderer, globe, markers = [];
let recoveredCount = 0;
let nextMarkerTime = 0;

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

function createMarker() {
    // Create marker geometry - a small sphere for visibility
    const markerGeometry = new THREE.SphereGeometry(0.04, 8, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff44,
        transparent: true,
        opacity: 1
    });
    
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    
    // Position marker on globe surface
    const phi = Math.acos(-1 + (2 * Math.random()));
    const theta = Math.random() * 2 * Math.PI;
    
    // Calculate position on globe surface with slight offset
    const radius = 2.6;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    marker.position.set(x, y, z);
    
    // Store data for animation and rotation
    marker.userData = {
        phi: phi,
        theta: theta,
        spawnTime: Date.now(),
        lifetime: 5000, // 5 seconds
        animPhase: 0
    };
    
    markers.push(marker);
    scene.add(marker);
    
    console.log('Created marker at:', x, y, z); // Debug log
}

function animate() {
    requestAnimationFrame(animate);
    
    // Rotate globe
    globe.rotation.y += 0.002;
    
    const currentTime = Date.now();
    
    // Spawn new markers occasionally
    if (currentTime >= nextMarkerTime) {
        createMarker();
        // Schedule next marker spawn (3-8 seconds)
        nextMarkerTime = currentTime + Math.random() * 5000 + 3000;
    }
    
    // Update existing markers
    markers.forEach((marker, index) => {
        const age = currentTime - marker.userData.spawnTime;
        const progress = age / marker.userData.lifetime;
        
        if (progress >= 1) {
            // Remove expired marker
            scene.remove(marker);
            markers.splice(index, 1);
            return;
        }
        
        // Rotate marker position with globe
        const currentTheta = marker.userData.theta + globe.rotation.y;
        const radius = 2.6;
        const x = radius * Math.sin(marker.userData.phi) * Math.cos(currentTheta);
        const y = radius * Math.sin(marker.userData.phi) * Math.sin(currentTheta);
        const z = radius * Math.cos(marker.userData.phi);
        
        marker.position.set(x, y, z);
        
        // Animate opacity - fade in, stay, fade out
        let opacity;
        if (progress < 0.2) {
            // Fade in
            opacity = progress / 0.2;
        } else if (progress > 0.8) {
            // Fade out
            opacity = (1 - progress) / 0.2;
        } else {
            // Stay visible
            opacity = 1;
        }
        
        marker.material.opacity = opacity * 0.6;
        
        // Subtle pulse effect
        marker.userData.animPhase += 0.03;
        const pulse = 1 + Math.sin(marker.userData.animPhase) * 0.1;
        marker.scale.set(pulse, pulse, pulse);
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