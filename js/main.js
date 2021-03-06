if (!Detector.webgl) Detector.addGetWebGLMessage();

var _tempVector = new THREE.Vector3();

var Simulation = {
  init: function init() 
  {
    this.initScene();
    this.initGL();
    this.initDom();
    this.initControls();
  },
  
  initGL: function()
  {
    var self = this;
    
    // Init THREE.js stuff
    this.camera = new THREE.OrthographicCamera(-1, 1, -1, 1, 0, 1);

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.sortObjects = false;

    this.renderer.autoClear = false;
    
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      
      defines: {
        NO_EDGE: 1
      },
    
      vertexShader: document.getElementById("vertexShaderDepth").textContent,
      fragmentShader: document.getElementById("fragmentShaderDepth").textContent,
    })));
    
    this.renderPasses = [
      new THREE.RenderPass(this.quadScene, this.quadCam),
      new THREE.BloomPass(1.25),
      new THREE.FilmPass(0.35, 0.95, 2048, false)
    ];

    this.renderPasses[this.renderPasses.length - 1].renderToScreen = true;

    this.composer = new THREE.EffectComposer(this.renderer);
    
    this.renderPasses.forEach(function(pass) {
      self.composer.addPass(pass);
    });
    
    this.rayMatrix = new THREE.Matrix4();
  },
  
  initDom: function()
  {
    var self = this;
    
    // Init some DOM stuff
    this.container = document.getElementById("container");
    this.container.appendChild(this.renderer.domElement);
    
    this.stats = new Stats();
    this.stats.domElement.style.position = "absolute";
    this.stats.domElement.style.top = 0;
    this.stats.domElement.style.zIndex = 100;
    document.body.appendChild(this.stats.domElement);
    
    var updateResolution = function()
    {
      var size = parseInt(document.querySelector("[name=resolution]:checked").value),
          width = Math.floor(window.innerWidth / size),
          height = Math.floor(window.innerHeight / size);
          
      self.composer.setSize(width, height);
    };
    
    var onWindowResize = function() 
    {
      self.renderer.setSize(window.innerWidth, window.innerHeight);
      
      var vx, vy;
      if (window.innerWidth > window.innerHeight) 
      {
        vx = 1;
        vy = window.innerHeight / window.innerWidth;
      }
      else 
      {
        vx = window.innerWidth / window.innerHeight;
        vy = 1;
      }
      self.rayMatrix.set(vx, 0, 0, 0,
                         0, vy, 0, 0,
                         0, 0, -1, 0,
                         0, 0, 0, 1);
                    
      updateResolution();
    };
    
    window.addEventListener("resize", onWindowResize, false);
    onWindowResize();
    
    document.querySelector("#resolution").addEventListener("change", function(event) {
      updateResolution();
      event.target.blur();
    }, false);
  },
  
  initControls: function()
  {
    var self = this;
    
    // Init the controls
    this.tabletControls = new TabletControls(this.camera, this.container);
    this.tabletControls.movementSpeed = 1.3;
    
    this.keyboardControls = new THREE.FlyControls(this.camera, this.container);
    this.keyboardControls.movementSpeed = 1;
    this.keyboardControls.domElement = this.container;
    this.keyboardControls.rollSpeed = Math.PI / 3;
    this.keyboardControls.autoForward = false;
    this.keyboardControls.dragToLook = false;
    
    var keypress = function(event)
    {
      if (event.charCode == 32)
      {
        if (!self.keyboardControls.dragToLook)
        {
          self.keyboardControls.moveState.yawLeft = 0;
          self.keyboardControls.moveState.pitchDown = 0;
        }
        self.keyboardControls.dragToLook = !self.keyboardControls.dragToLook;
      }
      
      // Pretty sure we don't need tablet controls when a keyboard event is triggered.
      self.tabletControls.disconnect();
      
      document.body.classList.remove("tablet");
    };
    
    window.addEventListener("keypress", keypress, false);
    
    // Disable tablet controls until we get some indication that we're on a tablet
    this.tabletControls.disconnect();
    
    var deviceListener = function(event) {
      if (event.alpha === null) return;
      
      self.tabletControls.connect();
      
      window.removeEventListener("deviceorientation", deviceListener, false);
      
      document.body.classList.add("tablet");
    };
    
    window.addEventListener("deviceorientation", deviceListener, false);
  },
  
  initScene: function()
  {
    this.wormholePositionSize = new THREE.Vector4(2, -5.0, -28, 0.3);
    this.blackholePositionSize = new THREE.Vector4(0.0, -250.0, 250.0, 3);
    this.saturnPositionSize = new THREE.Vector4(-14, 5, -40, 8.0);
    this.planetPositionSize = new THREE.Vector4(5.84, -200.3, 211.96, 0.08);
    
    // Ring definition - xyz is normal going through ring. Its magnitude determines inner radius.
    // w component determines outer radius
    this.blackholeDisk = new THREE.Vector4(6.0, 0.0, 0.0, 50.0);
    this.saturnRings = new THREE.Vector4(1.67, 0.0, 0.0, 2.33);
    
    var rotation = new THREE.Quaternion();
    rotation.setFromAxisAngle((new THREE.Vector3(0, -1, 2)).normalize(), 2.3);
    THREE.Vector3.prototype.applyQuaternion.call(this.blackholeDisk, rotation);
    
    rotation.setFromAxisAngle((new THREE.Vector3(2, 1, 3)).normalize(), 1.8);
    THREE.Vector3.prototype.applyQuaternion.call(this.saturnRings, rotation);

    this.uniforms = {
      "wormhole": { type: "v4", value: this.wormholePositionSize },
      "blackhole": { type: "v4", value: this.blackholePositionSize },
      "gravityWormhole": { type: "f", value: 0.01 },
      "gravityBlackhole": { type: "f", value: 0.5 },
      
      "saturn":  { type: "v4", value: this.saturnPositionSize },
      "planet":  { type: "v4", value: this.planetPositionSize },
      
      "blackholeDisk": { type: "v4", value: this.blackholeDisk },
      "saturnRings": { type: "v4", value: this.saturnRings },
      
      "planetDiffuse": { type: "v3", value: new THREE.Vector3(0.58,0.85,0.96) },
      "planetSpecular": { type: "v3", value: new THREE.Vector3(0.1,0.1,0.1) },
      "texSaturn": { type: "t", value: THREE.ImageUtils.loadTexture("saturn.jpg") },
      "texSaturnRings": { type: "t", value: THREE.ImageUtils.loadTexture("saturnrings.png") },
      "texGalaxy1":  { type: "t", value: THREE.ImageUtils.loadTexture("galaxy1.png") },
      "texGalaxy2":  { type: "t", value: THREE.ImageUtils.loadTexture("galaxy2.png") },
      "texAccretionDisk": { type: "t", value: THREE.ImageUtils.loadTexture("accretiondisk.jpg") },
      
      "lightDirection": { type: "v3", value: new THREE.Vector3(-1, 0, 0) },
      
      "rayMatrix": { type: "m4", value: new THREE.Matrix4() },
      "lightSpeed": { type: "f", value: 0.2 },
      "stepSize": { type: "f", value: 1.0 },
      
      "startGalaxy": { type: "i", value: 0 },
      "cameraPosition": { type: "v3" },
    };
  },

  step: function()
  {
    this.render();
    this.stats.update();
  },
  
  start: function()
  {
    var self = this;
    
    this.clock = new THREE.Clock();
    
    function animate() 
    {
      requestAnimationFrame(animate);

      self.step();
    }
    
    animate();
  },
  
  _diff: new THREE.Vector3(),
  _axis: new THREE.Vector3(),
  _intersection: new THREE.Vector3(),
  _rotation: new THREE.Quaternion(),
  
  render: function()
  {
    var delta = this.clock.getDelta(),
        wormholePosition = this.wormholePositionSize,
        wormholeRadius = this.wormholePositionSize.w;
    
    var prevPosition = _tempVector;
    prevPosition.copy(this.camera.position);

    this.keyboardControls.update(delta);
    this.tabletControls.update(delta);
    
    if (this.camera.position.distanceTo(wormholePosition) < wormholeRadius && prevPosition.distanceTo(wormholePosition) >= wormholeRadius)
    {
      // Calculate where exactly we passed through the wormhole
      this._diff.subVectors(this.camera.position, prevPosition).normalize();
      
      this._intersection.subVectors(prevPosition, wormholePosition);
      var p = this._intersection.dot(this._diff);
      var d = p * p + wormholeRadius * wormholeRadius - this._intersection.dot(this._intersection);
      this._intersection.copy(this._diff).multiplyScalar(-p - Math.sqrt(d)).add(prevPosition);
      
      // Rotate 180 degrees around axis pointing at exit point
      var axis = _tempVector;
      axis.subVectors(this._intersection, wormholePosition).normalize();
      this._rotation.setFromAxisAngle(axis, Math.PI);
      this.camera.quaternion.multiplyQuaternions(this._rotation, this.camera.quaternion);

      // Set new camera position a tiny bit outside mirrored intersection point
      var temp = _tempVector;
      this.camera.position.copy(wormholePosition).add(temp.subVectors(wormholePosition, this._intersection).multiplyScalar(1.0001));
      
      this.uniforms.startGalaxy.value = 1 - this.uniforms.startGalaxy.value;
    }
    
    var rotationMatrix = new THREE.Matrix4();
    
    
    rotationMatrix.makeRotationFromQuaternion(this.camera.quaternion);
    this.uniforms.rayMatrix.value.copy(rotationMatrix);
    this.uniforms.rayMatrix.value.multiply(this.rayMatrix);
    
    this.uniforms.cameraPosition.value = this.camera.position;
    
    this.renderer.clear();
    this.composer.render( 0.01 );
  }
};

Simulation.init();
Simulation.start();