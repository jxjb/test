import * as THREE from './libs/three137/three.module.js';
import { GLTFLoader } from './libs/three137/GLTFLoader.js';
import { DRACOLoader } from './libs/three137/DRACOLoader.js';
import { RGBELoader } from './libs/three137/RGBELoader.js';
import { OrbitControls } from './libs/three137/OrbitControls.js';
import { LoadingBar } from './libs/LoadingBar.js';

class Game {
    constructor() {
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.clock = new THREE.Clock();
        this.loadingBar = new LoadingBar(); // Show it by default

        this.assetsPath = './assets/';
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(110, window.innerWidth / window.innerHeight, 0.1, 50);
        this.camera.position.set(1, 1.7, 7.8);

        const ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        this.scene.add(ambient);

        const light = new THREE.DirectionalLight();
        light.position.set(0.2, 1, 1);
        this.scene.add(light);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);

        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.ACESFilmicToneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMapping = THREE.FilmicToneMapping;

        this.renderer.toneMappingExposure = 1.25; // Adjust for brightness

        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
this.controls.enableDamping = true;         // Enables inertia
this.controls.dampingFactor = 0.05;         // Lower = smoother/slower stop
this.controls.rotateSpeed = 0.7;            // Adjust rotation sensitivity
this.controls.zoomSpeed = 0.8;              // Zoom speed
this.controls.panSpeed = 0.6;               // Pan speed

        controls.target.set(0, 1, 0);
        controls.update();

        this.setEnvironment();
        this.loadNPC();
        this._CreateClickableObject();
        this.createSkySphere();
        this.loadOrderObject();
        this.orderObject = null;
        this.orderPulseScale = 1;
        this.orderPulseDirection = 0.5; // 1 = scale up, -1 = scale down
        

        window.addEventListener('resize', this.resize.bind(this));
        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setEnvironment() {
        const loader = new RGBELoader().setPath(this.assetsPath);
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        loader.load(
            'hdr/factory.hdr',
            (texture) => {
                const envMap = pmremGenerator.fromEquirectangular(texture).texture;
                pmremGenerator.dispose();
                this.scene.environment = envMap;
            },
            undefined,
            (err) => console.error('HDR load error:', err.message)
        );
    }




    loadNPC() {
        const loader = new GLTFLoader().setPath(`${this.assetsPath}factory/`);
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./libs/three137/draco/');
        loader.setDRACOLoader(dracoLoader);
    
        const models = ['threeto2.glb', 'guy3.glb' ,'portal.glb' ,'gate.glb'];
        this.npcObjects = []; // Store clickable NPCs
        this.outlined = new Set(); // Store toggled outlines
        this.outlineColor = 0x00ff00; // green
        // Default outline color
    
        let modelsLoaded = 0;
    
        models.forEach((model) => {
            loader.load(
                model,
                (gltf) => {
                    gltf.scene.traverse((child) => {
                        if (child.isMesh) {
                            const material = child.material;
                            if (material) {
                                material.transparent = false;
                                material.depthWrite = true;
                                material.depthTest = true;
                                material.opacity = 1;
                                material.side = THREE.FrontSide;
                                material.needsUpdate = true;
                            }
                        }
                    });
    
                    if (model === 'guy3.glb') {
                        gltf.scene.position.y -= 0.19;
                    }
    
                    this.npcObjects.push(gltf.scene);
                    this.scene.add(gltf.scene);
                    modelsLoaded++;
    
                    if (modelsLoaded === models.length) {
                        this.loadingBar.visible = false;
                    }
                },
                (xhr) => {
                    if (xhr.lengthComputable) {
                        this.loadingBar.progress = xhr.loaded / xhr.total;
                    }
                },
                (err) => {
                    console.error(`Error loading ${model}:`, err);
                }
            );
        });
    
        // Add event listener after all objects are loaded
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
    
        const handleSelect = (x, y) => {
            pointer.x = (x / window.innerWidth) * 2 - 1;
            pointer.y = -(y / window.innerHeight) * 2 + 1;
    
            raycaster.setFromCamera(pointer, this.camera);
            const intersects = raycaster.intersectObjects(this.npcObjects, true);
    
            if (intersects.length > 0) {
                const selected = intersects[0].object;
    
                if (this.outlined.has(selected)) {
                    selected.material.emissive.set(0x000000); // remove highlight
                    this.outlined.delete(selected);
                } else {
                    selected.material.emissive = new THREE.Color(this.outlineColor);
                    selected.material.emissiveIntensity = 0.6;
                    this.outlined.add(selected);
                }
            }
        };
    
        window.addEventListener('click', (e) => handleSelect(e.clientX, e.clientY));
        window.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            handleSelect(touch.clientX, touch.clientY);
        });
    }
    
    

    createSkySphere() {
        const skyGeometry = new THREE.SphereGeometry(10, 100, 100);
        const skyMaterial = new THREE.MeshBasicMaterial({
            map: new THREE.TextureLoader().load('./assets/sky/sky3.png'),
            side: THREE.BackSide,
        });
        const skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(skySphere);
    }

    async loadOrderObject() {
        try {
            const loader = new GLTFLoader().setPath(`${this.assetsPath}factory/`);
            const gltf = await new Promise((resolve, reject) =>
                loader.load('order.glb', resolve, undefined, reject)
            );
    
            this.orderObject = gltf.scene;
            this.scene.add(this.orderObject);

         

// Optional positioning
this.orderObject.position.set(0, 0, -1);
this.orderObject.scale.set(1, 1, 1);

    
            // Optionally position or scale the object
            this.orderObject.position.set(0, 0, -1); // Change as needed
            this.orderObject.scale.set(1, 1, 1);
    
            // Setup raycaster
            const raycaster = new THREE.Raycaster();
            const pointer = new THREE.Vector2();
    
            const handleInteraction = (clientX, clientY) => {
                pointer.x = (clientX / window.innerWidth) * 2 - 1;
                pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    
                raycaster.setFromCamera(pointer, this.camera);
                const intersects = raycaster.intersectObject(this.orderObject, true);
    
                if (intersects.length > 0) {
                    window.location.href = 'https://www.noon.com';
                }
            };
    
            // Mouse click
            window.addEventListener('click', (event) => {
                handleInteraction(event.clientX, event.clientY);
            });
    
            // Touch
            window.addEventListener('touchstart', (event) => {
                const touch = event.touches[0];
                handleInteraction(touch.clientX, touch.clientY);
            });
    
        } catch (error) {
            console.error('Failed to load order.glb:', error);
        }
    }
    

  



    async _CreateClickableObject() {
        try {
            const loader = new GLTFLoader();
            const gltf = await new Promise((resolve, reject) =>
                loader.load('./assets/factory/text.glb', resolve, undefined, reject)
            );

            this.clickableObject = gltf.scene;
            this.scene.add(this.clickableObject);

            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();

            const handleInteraction = (clientX, clientY) => {
                mouse.x = (clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(clientY / window.innerHeight) * 2 + 1;

                raycaster.setFromCamera(mouse, this.camera);
                const intersects = raycaster.intersectObject(this.clickableObject, true);

                if (intersects.length > 0) {
                    window.location.href = 'https://github.com/rmutairi/space';
                }
            };

            window.addEventListener('click', (event) => {
                handleInteraction(event.clientX, event.clientY);
            });

            window.addEventListener('touchstart', (event) => {
                const touch = event.touches[0];
                handleInteraction(touch.clientX, touch.clientY);
            });
        } catch (error) {
            console.error('Failed to load clickable object:', error);
        }
    }
    async _CreateClickableObject() {
        try {
            // Create GLTF loader
            const loader = new GLTFLoader();
    
            // Load the GLB model once
            const gltf = await new Promise((resolve, reject) =>
                loader.load('./assets/factory/text.glb', resolve, undefined, reject)
            );
    
            // Original clickable object
            this.clickableObject = gltf.scene.clone(true);
            this.clickableObject.visible = false; // Hide initially
            this.scene.add(this.clickableObject);
    
            // Duplicate and position the second object
            this.rotatingText = gltf.scene.clone(true);
            this.rotatingText.position.y += 1;
            this.rotatingText.visible = false; // Hide initially
            this.scene.add(this.rotatingText);
    
            // Setup raycasting for click interaction
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
    
            const handleInteraction = (clientX, clientY) => {
                mouse.x = (clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    
                raycaster.setFromCamera(mouse, this.camera);
                const intersects = raycaster.intersectObject(this.clickableObject, true);
    
                if (intersects.length > 0) {
                    window.location.href = 'https://github.com/rmutairi/space';
                }
            };
    
            window.addEventListener('click', (event) => {
                handleInteraction(event.clientX, event.clientY);
            });
    
            window.addEventListener('touchstart', (event) => {
                const touch = event.touches[0];
                handleInteraction(touch.clientX, touch.clientY);
            });
    
            // Wait for loading to complete to show both
            const checkLoaded = () => {
                if (!this.loadingBar || this.loadingBar.visible) {
                    requestAnimationFrame(checkLoaded);
                } else {
                    this.clickableObject.visible = true;
                    this.rotatingText.visible = true;
                }
            };
            checkLoaded();
        } catch (error) {
            console.error('Failed to load clickable object:', error);
        }
    }
    
    render() {

        

        if (this.rotatingText) {
            this.rotatingText.rotation.y += 0.01; // Adjust speed as desired
        }
        
        const dt = this.clock.getDelta();

        if (this.orderObject) {
            const speed = 0.5; // speed of scaling
            const scaleAmount = 0.1; // 10% increase/decrease
    
            // Update scale factor
            this.orderPulseScale += this.orderPulseDirection * dt * speed;
    
            // Clamp between 1.0 and 1.1
            if (this.orderPulseScale > 1 + scaleAmount) {
                this.orderPulseScale = 1 + scaleAmount;
                this.orderPulseDirection = -1;
            } else if (this.orderPulseScale < 1 - scaleAmount) {
                this.orderPulseScale = 1 - scaleAmount;
                this.orderPulseDirection = 1;
            }
    
            this.orderObject.scale.set(
                this.orderPulseScale,
                this.orderPulseScale,
                this.orderPulseScale
            );
        }


        this.renderer.render(this.scene, this.camera);
    }
}

export { Game };
