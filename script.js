(function () {
  const viewport = document.getElementById("gameViewport");
  const solarSpeedInput = document.getElementById("solarSpeed");
  const shipSpeedInput = document.getElementById("shipSpeed");
  const solarSpeedValue = document.getElementById("solarSpeedValue");
  const shipSpeedValue = document.getElementById("shipSpeedValue");
  const resetButton = document.getElementById("resetButton");
  const weaponButtons = Array.from(document.querySelectorAll(".weapon"));
  const scoreValue = document.getElementById("scoreValue");
  const hitsValue = document.getElementById("hitsValue");
  const streakValue = document.getElementById("streakValue");
  const explosionValue = document.getElementById("explosionValue");
  const statusBadge = document.getElementById("statusBadge");
  const missionMessage = document.getElementById("missionMessage");
  const reportStats = document.getElementById("reportStats");
  const planetReport = document.getElementById("planetReport");
  const leaderboardForm = document.getElementById("leaderboardForm");
  const leaderboardList = document.getElementById("leaderboardList");
  const playerNameInput = document.getElementById("playerName");
  const saveScoreButton = document.getElementById("saveScoreButton");
  const celebrationOverlay = document.getElementById("celebrationOverlay");
  const ribbonLayer = document.getElementById("ribbonLayer");
  const victoryTitle = document.getElementById("victoryTitle");
  const victorySubtitle = document.getElementById("victorySubtitle");
  const viewportWrap = document.querySelector(".viewport-wrap");

  const leaderboardStorageKey = "nick-solar-system-16-leaderboard";
  const keys = Object.create(null);
  const raycaster = new THREE.Raycaster();
  const mouseLook = { yaw: 0, pitch: 0 };
  const clock = new THREE.Clock();
  const tempVector = new THREE.Vector3();
  const rightVector = new THREE.Vector3();
  const shotDirection = new THREE.Vector3();
  const asteroidTailDirection = new THREE.Vector3();
  const asteroidTailUp = new THREE.Vector3(0, 1, 0);
  const particlesToRemove = [];
  const beamsToRemove = [];
  const activeExplosions = [];
  const activeBeams = [];
  const activePlanets = [];
  const planetMeshes = [];
  const activeAsteroids = [];
  const asteroidMeshes = [];

  const state = {
    solarSpeed: parseFloat(solarSpeedInput.value),
    shipSpeed: parseFloat(shipSpeedInput.value),
    weapon: "light",
    score: 0,
    hits: 0,
    streak: 0,
    explosions: 0,
    asteroidsDestroyed: 0,
    shotsFired: 0,
    fireRateBoostLevel: 0,
    gameOver: false,
    pointerLocked: false,
    hoveredPlanet: null,
    missionStart: performance.now(),
    lastShotAt: 0,
    scoreSaved: false,
  };

  const audio = {
    context: null,
    master: null,
    noiseBuffer: null,
  };

  const ribbonColors = ["#ff6b6b", "#ffd93d", "#6bff95", "#5cd8ff", "#b089ff", "#ff9f68"];

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x040916, 0.0085);

  const camera = new THREE.PerspectiveCamera(72, viewport.clientWidth / viewport.clientHeight, 0.1, 500);
  camera.rotation.order = "YXZ";
  camera.position.set(0, 7, 58);
  camera.lookAt(0, 2, 0);

  const starGroup = new THREE.Group();
  const solarSystemRoot = new THREE.Group();
  scene.add(starGroup, solarSystemRoot);

  scene.add(new THREE.HemisphereLight(0xaad7ff, 0x101928, 1.25));
  const sunLight = new THREE.PointLight(0xffcf6d, 2.8, 380, 1.1);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  const ambientGlow = new THREE.PointLight(0x6ecfff, 0.35, 220, 1.2);
  ambientGlow.position.set(0, 14, 38);
  scene.add(ambientGlow);

  const solarBackdrop = new THREE.Mesh(
    new THREE.SphereGeometry(180, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x050b18,
      side: THREE.BackSide,
    })
  );
  scene.add(solarBackdrop);

  function createSun() {
    const sunGroup = new THREE.Group();
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(4.8, 48, 48),
      new THREE.MeshStandardMaterial({
        color: 0xffc655,
        emissive: 0xff8c1a,
        emissiveIntensity: 1.7,
        roughness: 0.45,
        metalness: 0.02,
      })
    );

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeRadialTexture(["rgba(255,255,255,0.95)", "rgba(255,196,69,0.75)", "rgba(255,105,32,0.02)"]),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    glow.scale.set(24, 24, 1);

    const corona = new THREE.Mesh(
      new THREE.SphereGeometry(6.2, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffaa3a,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );

    sunGroup.add(sun, corona, glow);
    solarSystemRoot.add(sunGroup);
    return { sunGroup, sun, glow, corona };
  }

  const sunParts = createSun();

  function createOrbit(radius) {
    const points = [];
    for (let i = 0; i <= 128; i += 1) {
      const angle = (i / 128) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const orbit = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0x25508b,
        transparent: true,
        opacity: 0.28,
      })
    );
    solarSystemRoot.add(orbit);
  }

  function makeRadialTexture(stops) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    const step = 1 / Math.max(stops.length - 1, 1);
    stops.forEach(function (color, index) {
      gradient.addColorStop(index * step, color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
  }

  function makePlanetTexture(planet) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, planet.colors[0]);
    gradient.addColorStop(0.5, planet.colors[1]);
    gradient.addColorStop(1, planet.colors[2]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (planet.style === "striped") {
      for (let y = 0; y < canvas.height; y += 16) {
        const alpha = 0.07 + Math.random() * 0.16;
        ctx.fillStyle = "rgba(255,255,255," + alpha.toFixed(3) + ")";
        ctx.fillRect(0, y, canvas.width, 8 + Math.random() * 10);
      }
    }

    if (planet.style === "rocky") {
      for (let i = 0; i < 90; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
        ctx.beginPath();
        ctx.arc(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          5 + Math.random() * 18,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    if (planet.style === "clouds") {
      for (let i = 0; i < 20; i += 1) {
        ctx.fillStyle = "rgba(255,255,255,0.11)";
        ctx.beginPath();
        ctx.ellipse(
          Math.random() * canvas.width,
          Math.random() * canvas.height,
          40 + Math.random() * 60,
          12 + Math.random() * 22,
          Math.random() * Math.PI,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return texture;
  }

  function makeLabelTexture(name) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(7, 18, 41, 0.82)";
    roundRect(ctx, 10, 12, canvas.width - 20, canvas.height - 24, 24);
    ctx.fill();

    ctx.strokeStyle = "rgba(145, 232, 255, 0.32)";
    ctx.lineWidth = 4;
    roundRect(ctx, 10, 12, canvas.width - 20, canvas.height - 24, 24);
    ctx.stroke();

    ctx.fillStyle = "#fff7ca";
    ctx.font = "700 30px Fredoka";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, canvas.width / 2, canvas.height / 2 + 2);

    return new THREE.CanvasTexture(canvas);
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  const planetDefinitions = [
    { name: "Mercury", size: 0.82, orbitRadius: 8.5, orbitSpeed: 1.62, spin: 1.1, hp: 10, colors: ["#7b6c61", "#b59678", "#4d3d33"], style: "rocky" },
    { name: "Venus", size: 1.28, orbitRadius: 11.8, orbitSpeed: 1.18, spin: 0.82, hp: 12, colors: ["#edc784", "#d5914a", "#83502a"], style: "clouds" },
    { name: "Earth", size: 1.34, orbitRadius: 15.2, orbitSpeed: 1.0, spin: 1.5, hp: 12, colors: ["#1b73c5", "#45c271", "#12426f"], style: "clouds" },
    { name: "Mars", size: 0.96, orbitRadius: 19.1, orbitSpeed: 0.81, spin: 1.32, hp: 10, colors: ["#d77441", "#914833", "#5a3029"], style: "rocky" },
    { name: "Jupiter", size: 3.45, orbitRadius: 28.2, orbitSpeed: 0.44, spin: 2.25, hp: 30, colors: ["#c7864a", "#f0d0aa", "#8f5331"], style: "striped" },
    { name: "Saturn", size: 2.96, orbitRadius: 36.2, orbitSpeed: 0.33, spin: 1.95, hp: 28, colors: ["#dec27b", "#bea069", "#86673e"], style: "striped", ring: { inner: 4.2, outer: 6.6, color: 0xf5daa1, orientation: "horizontal" } },
    { name: "Uranus", size: 2.16, orbitRadius: 44.6, orbitSpeed: 0.24, spin: 1.3, hp: 24, colors: ["#86e6eb", "#49b5d0", "#5ec7ea"], style: "clouds", tilt: 0.72 },
    { name: "Neptune", size: 2.02, orbitRadius: 52.1, orbitSpeed: 0.18, spin: 1.4, hp: 24, colors: ["#386ef1", "#5ab5ff", "#162b86"], style: "clouds", ring: { inner: 2.8, outer: 4.5, color: 0x70c7ff, orientation: "vertical" } },
  ];

  planetDefinitions.forEach(createPlanet);
  createStars();
  createAsteroids(12);
  renderLeaderboard();
  refreshHud();
  updateLeaderboardAccess();
  updateMissionReport();

  function createPlanet(definition) {
    createOrbit(definition.orbitRadius);

    const orbitGroup = new THREE.Group();
    const tiltGroup = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      map: makePlanetTexture(definition),
      color: 0xffffff,
      emissive: new THREE.Color(definition.colors[0]).multiplyScalar(0.09),
      emissiveIntensity: 0.45,
      roughness: 0.92,
      metalness: 0.05,
    });

    const bodyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(definition.size, 42, 42),
      material
    );
    bodyMesh.position.x = definition.orbitRadius;

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(definition.size * 1.18, 26, 26),
      new THREE.MeshBasicMaterial({
        color: 0x87d9ff,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    halo.position.copy(bodyMesh.position);

    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeLabelTexture(definition.name),
        transparent: true,
        depthWrite: false,
      })
    );
    label.scale.set(5.8, 2.2, 1);
    label.position.set(definition.orbitRadius, definition.size + 2.6, 0);

    tiltGroup.rotation.z = definition.tilt || 0;
    tiltGroup.add(bodyMesh, halo, label);

    let ring = null;
    if (definition.ring) {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(definition.ring.inner, definition.ring.outer, 96),
        new THREE.MeshBasicMaterial({
          color: definition.ring.color,
          transparent: true,
          opacity: 0.62,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.position.copy(bodyMesh.position);
      if (definition.ring.orientation === "horizontal") {
        ring.rotation.x = Math.PI / 2;
        ring.rotation.z = 0.18;
      } else {
        ring.rotation.y = Math.PI / 2;
        ring.rotation.z = 0.1;
      }
      tiltGroup.add(ring);
    }

    orbitGroup.rotation.y = Math.random() * Math.PI * 2;
    orbitGroup.add(tiltGroup);
    solarSystemRoot.add(orbitGroup);

    const planet = {
      definition: definition,
      orbitGroup: orbitGroup,
      tiltGroup: tiltGroup,
      bodyMesh: bodyMesh,
      halo: halo,
      label: label,
      ring: ring,
      baseColor: new THREE.Color(0xffffff),
      baseEmissive: new THREE.Color(definition.colors[0]).multiplyScalar(0.09),
      criticalColor: new THREE.Color(0xff4249),
      criticalEmissive: new THREE.Color(0xff2a24),
      flash: 0,
      currentHp: definition.hp,
      maxHp: definition.hp,
      exploded: false,
    };

    bodyMesh.userData.planet = planet;
    activePlanets.push(planet);
    planetMeshes.push(bodyMesh);
    updatePlanetVisual(planet, 0);
  }

  function createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const palette = [0xffffff, 0x9fd2ff, 0xfff1b5, 0x9effff];
    for (let i = 0; i < 2200; i += 1) {
      const radius = 120 + Math.random() * 130;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions.push(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi) * 0.9,
        radius * Math.sin(phi) * Math.sin(theta)
      );
      const color = new THREE.Color(palette[(Math.random() * palette.length) | 0]);
      colors.push(color.r, color.g, color.b);
    }
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    starGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        size: 1.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        sizeAttenuation: true,
      })
    );

    const nebula = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 180),
      new THREE.MeshBasicMaterial({
        map: makeRadialTexture(["rgba(110,247,255,0.15)", "rgba(28,75,189,0.06)", "rgba(0,0,0,0)"]),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    nebula.position.set(-55, 22, -120);
    nebula.rotation.y = 0.45;

    starGroup.add(stars, nebula);
  }

  function createAsteroids(count) {
    for (let i = 0; i < count; i += 1) {
      const size = 0.55 + Math.random() * 0.95;
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size, 0),
        new THREE.MeshStandardMaterial({
          color: 0x9f8f82,
          emissive: 0x271d18,
          emissiveIntensity: 0.22,
          roughness: 0.98,
          metalness: 0.04,
          flatShading: true,
        })
      );

      const tailLength = 3.8 + size * 2.8 + Math.random() * 1.8;
      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(size * 0.42, tailLength, 14, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xc9ecff,
          transparent: true,
          opacity: 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeRadialTexture(["rgba(255,255,255,0.96)", "rgba(183,230,255,0.65)", "rgba(120,190,255,0.02)"]),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      glow.scale.set(size * 2.8, size * 2.8, 1);

      const asteroid = {
        mesh: mesh,
        tail: tail,
        glow: glow,
        size: size,
        tailLength: tailLength,
        velocity: new THREE.Vector3(),
        rotationSpeed: new THREE.Vector3(),
        active: true,
        respawnAt: 0,
      };
      mesh.userData.asteroid = asteroid;
      activeAsteroids.push(asteroid);
      asteroidMeshes.push(mesh);
      scene.add(mesh);
      scene.add(tail);
      scene.add(glow);
      respawnAsteroid(asteroid, true);
    }
  }

  function respawnAsteroid(asteroid, immediate) {
    const radius = 42 + Math.random() * 42;
    const angle = Math.random() * Math.PI * 2;
    const height = -16 + Math.random() * 34;
    asteroid.mesh.position.set(
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    );

    const driftTarget = new THREE.Vector3(
      (Math.random() * 2 - 1) * 18,
      -6 + Math.random() * 18,
      (Math.random() * 2 - 1) * 18
    );

    asteroid.velocity.copy(driftTarget.sub(asteroid.mesh.position).normalize().multiplyScalar(3.2 + Math.random() * 3.8));
    asteroid.rotationSpeed.set(
      (Math.random() * 2 - 1) * 1.6,
      (Math.random() * 2 - 1) * 1.6,
      (Math.random() * 2 - 1) * 1.6
    );
    asteroid.active = true;
    asteroid.mesh.visible = true;
    asteroid.tail.visible = true;
    asteroid.glow.visible = true;
    asteroid.tail.scale.setScalar(0.85 + Math.random() * 0.45);
    asteroid.respawnAt = immediate ? 0 : performance.now() + 1800 + Math.random() * 2400;
    updateAsteroidTail(asteroid);
  }

  function burstAsteroid(asteroid, point) {
    asteroid.active = false;
    asteroid.mesh.visible = false;
    asteroid.tail.visible = false;
    asteroid.glow.visible = false;
    asteroid.respawnAt = performance.now() + 2200 + Math.random() * 2600;
    state.asteroidsDestroyed += 1;
    state.fireRateBoostLevel += 1;
    state.score += 35 + Math.min(80, state.fireRateBoostLevel * 3);
    state.streak += 1;
    createExplosionBurst(point || asteroid.mesh.position, "#ffd18f");
    missionMessage.textContent = "Asteroid smashed. Fire speed boosted!";
    refreshHud();
  }

  function updateAsteroidTail(asteroid) {
    asteroidTailDirection.copy(asteroid.velocity).normalize().multiplyScalar(-1);
    asteroid.tail.position.copy(asteroid.mesh.position).addScaledVector(asteroidTailDirection, asteroid.tailLength * 0.42);
    asteroid.tail.quaternion.setFromUnitVectors(asteroidTailUp, asteroidTailDirection);
    asteroid.tail.material.opacity = 0.28 + state.solarSpeed * 0.08;

    asteroid.glow.position.copy(asteroid.mesh.position);
    asteroid.glow.material.opacity = 0.68;
  }

  function updatePlanetVisual(planet, delta) {
    const hpRatio = planet.currentHp / planet.maxHp;
    const critical = hpRatio <= 0.1 ? 1 : 0;
    planet.flash = Math.max(0, planet.flash - delta * 2.8);

    planet.bodyMesh.material.color.copy(planet.baseColor).lerp(planet.criticalColor, critical * 0.92);
    planet.bodyMesh.material.emissive.copy(planet.baseEmissive).lerp(planet.criticalEmissive, critical * 0.82);
    planet.bodyMesh.material.emissiveIntensity = 0.42 + critical * 0.95 + planet.flash * 1.1;
    planet.halo.material.opacity = (planet.exploded ? 0 : 0.09) + critical * 0.19 + planet.flash * 0.28 + (planet === state.hoveredPlanet ? 0.14 : 0);
    planet.label.material.opacity = planet.exploded ? 0 : planet === state.hoveredPlanet ? 1 : 0.82;
    if (planet.ring) {
      planet.ring.material.opacity = planet.exploded ? 0 : 0.58 + critical * 0.16;
      if (critical) {
        planet.ring.material.color.set(0xff8e70);
      } else {
        planet.ring.material.color.set(planet.definition.ring.color);
      }
    }
  }

  function getCurrentCooldown() {
    const baseCooldown = state.weapon === "light" ? 170 : 310;
    const boostFactor = Math.max(0.38, 1 - state.fireRateBoostLevel * 0.045);
    return Math.max(65, baseCooldown * boostFactor);
  }

  function getShootableHit() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const intersects = raycaster.intersectObjects(planetMeshes.concat(asteroidMeshes), false);
    return intersects.find(function (item) {
      const planet = item.object.userData.planet;
      const asteroid = item.object.userData.asteroid;
      return (planet && !planet.exploded) || (asteroid && asteroid.active);
    }) || null;
  }

  function updateTargeting() {
    const hit = getShootableHit();
    const nextPlanet = hit && hit.object.userData.planet ? hit.object.userData.planet : null;
    const nextAsteroid = hit && hit.object.userData.asteroid ? hit.object.userData.asteroid : null;
    state.hoveredPlanet = nextPlanet && !nextPlanet.exploded ? nextPlanet : null;

    if (state.gameOver) {
      statusBadge.textContent = "All planets popped. Save your score, then reset for another mission.";
      return;
    }

    if (!state.hoveredPlanet) {
      statusBadge.textContent = state.pointerLocked
        ? "Look around the solar system and line up a planet in the windshield."
        : "Click the game view to steer with your mouse, or use the arrow keys.";
      return;
    }

    if (nextAsteroid && nextAsteroid.active) {
      statusBadge.textContent = "Target asteroid: 1 hit to smash. Bonus fire speed if you land it!";
      return;
    }

    const left = Math.max(0, Math.ceil(state.hoveredPlanet.currentHp));
    const hpText = left === 1 ? "1 hit left" : left + " hits left";
    const danger = state.hoveredPlanet.currentHp / state.hoveredPlanet.maxHp <= 0.1 ? " Hurry, it is glowing red!" : "";
    statusBadge.textContent = "Target " + state.hoveredPlanet.definition.name + ": " + hpText + "." + danger;
  }

  function shoot() {
    if (state.gameOver) {
      return;
    }
    const now = performance.now();
    const cooldown = getCurrentCooldown();
    if (now - state.lastShotAt < cooldown) {
      return;
    }
    state.lastShotAt = now;
    state.shotsFired += 1;

    ensureAudio();
    playShotSound(state.weapon);

    camera.getWorldDirection(shotDirection);
    const hitTarget = getShootableHit();
    const target = hitTarget && hitTarget.object.userData.planet ? hitTarget.object.userData.planet : null;
    const asteroid = hitTarget && hitTarget.object.userData.asteroid ? hitTarget.object.userData.asteroid : null;

    const shotOrigin = camera.position.clone().add(shotDirection.clone().multiplyScalar(2.2));
    let endPoint = shotOrigin.clone().add(shotDirection.clone().multiplyScalar(90));
    let didHit = false;

    if (asteroid && asteroid.active) {
      endPoint = hitTarget.point.clone();
      didHit = true;
      state.hits += 1;
      burstAsteroid(asteroid, endPoint);
    } else if (target && !target.exploded) {
      endPoint = hitTarget.point.clone();
      didHit = true;
      target.currentHp = Math.max(0, target.currentHp - 1);
      target.flash = 1;
      state.hits += 1;
      state.streak += 1;
      state.score += state.weapon === "light" ? 12 : 18;

      if (target.currentHp === 0) {
        explodePlanet(target, endPoint);
        state.score += target.maxHp * 14;
      } else if (target.currentHp / target.maxHp <= 0.1) {
        missionMessage.textContent = target.definition.name + " is turning red. Keep blasting until it explodes!";
      } else {
        missionMessage.textContent = target.definition.name + " got hit. " + Math.ceil(target.currentHp) + " hits to go.";
      }
    } else {
      state.streak = 0;
      missionMessage.textContent = "Missed! Try putting a planet right in the middle of the windshield.";
    }

    createBeam(shotOrigin, endPoint, state.weapon, didHit);
    refreshHud();
  }

  function createBeam(origin, target, weapon, hit) {
    const beamColor = weapon === "light" ? 0x7cf5ff : 0xff8f4b;
    const glowColor = weapon === "light" ? 0xa6ffff : 0xffd978;
    const positions = new Float32Array([
      origin.x, origin.y, origin.z,
      target.x, target.y, target.z,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: beamColor,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geometry, material);
    scene.add(line);

    const markers = [];
    const markerCount = 4;
    for (let i = 0; i < markerCount; i += 1) {
      const t = (i + 1) / (markerCount + 1);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(weapon === "light" ? 0.18 : 0.24, 10, 10),
        new THREE.MeshBasicMaterial({
          color: glowColor,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      marker.position.lerpVectors(origin, target, t);
      scene.add(marker);
      markers.push(marker);
    }

    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(weapon === "light" ? 0.34 : 0.46, 12, 12),
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    muzzle.position.copy(origin);
    scene.add(muzzle);

    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(hit ? 0.7 : 0.4, 14, 14),
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    pulse.position.copy(target);
    scene.add(pulse);

    activeBeams.push({
      life: 0.22,
      maxLife: 0.22,
      line: line,
      markers: markers,
      muzzle: muzzle,
      pulse: pulse,
    });
  }

  function explodePlanet(planet, at) {
    if (planet.exploded) {
      return;
    }
    planet.exploded = true;
    planet.bodyMesh.visible = false;
    planet.halo.visible = false;
    planet.label.visible = false;
    if (planet.ring) {
      planet.ring.visible = false;
    }

    state.explosions += 1;
    missionMessage.textContent = planet.definition.name + " exploded into sparkles!";
    playExplosionSound();
    createExplosionBurst(at || getPlanetWorldPosition(planet), planet.definition.colors[1]);

    if (state.explosions === activePlanets.length) {
      state.gameOver = true;
      state.scoreSaved = false;
      const timeSpent = ((performance.now() - state.missionStart) / 1000).toFixed(1);
      state.score += 250;
      missionMessage.textContent = "Mission complete in " + timeSpent + "s. Rating: " + getRatingText() + ". Save your leaderboard score!";
      showVictoryCelebration(timeSpent);
      unlockPointer();
      updateLeaderboardAccess();
    }
  }

  function showVictoryCelebration(timeSpent) {
    ensureAudio();
    playVictorySound();
    celebrationOverlay.classList.add("active");
    celebrationOverlay.setAttribute("aria-hidden", "false");
    viewportWrap.classList.add("victory-mode");
    victoryTitle.textContent = "Mission Complete!";
    victorySubtitle.textContent = "Cup earned in " + timeSpent + "s. Rating " + getRatingText() + ". Save your score to the leaderboard.";
    createRibbons(36);
  }

  function hideVictoryCelebration() {
    celebrationOverlay.classList.remove("active");
    celebrationOverlay.setAttribute("aria-hidden", "true");
    viewportWrap.classList.remove("victory-mode");
    ribbonLayer.innerHTML = "";
  }

  function createRibbons(count) {
    ribbonLayer.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const ribbon = document.createElement("div");
      ribbon.className = "ribbon";
      ribbon.style.left = 2 + Math.random() * 96 + "%";
      ribbon.style.height = 72 + Math.random() * 110 + "px";
      ribbon.style.background = ribbonColors[i % ribbonColors.length];
      ribbon.style.animationDuration = 2.8 + Math.random() * 2.4 + "s";
      ribbon.style.animationDelay = Math.random() * 0.8 + "s";
      ribbon.style.setProperty("--drift", Math.round(Math.random() * 180 - 90) + "px");
      ribbon.style.setProperty("--spin", Math.round(Math.random() * 720 - 360) + "deg");
      ribbonLayer.appendChild(ribbon);
    }
  }

  function createExplosionBurst(position, color) {
    const count = 72;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const tint = new THREE.Color(color);
    const geometry = new THREE.BufferGeometry();

    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize().multiplyScalar(6 + Math.random() * 12);

      velocities[i * 3] = direction.x;
      velocities[i * 3 + 1] = direction.y;
      velocities[i * 3 + 2] = direction.z;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: tint,
        size: 0.95,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(points);

    activeExplosions.push({
      points: points,
      positions: positions,
      velocities: velocities,
      life: 1.15,
      maxLife: 1.15,
    });
  }

  function getPlanetWorldPosition(planet) {
    const position = new THREE.Vector3();
    planet.bodyMesh.getWorldPosition(position);
    return position;
  }

  function ensureAudio() {
    if (!audio.context) {
      audio.context = new (window.AudioContext || window.webkitAudioContext)();
      audio.master = audio.context.createGain();
      audio.master.gain.value = 0.18;
      audio.master.connect(audio.context.destination);
      audio.noiseBuffer = createNoiseBuffer(audio.context, 0.35);
    }
    if (audio.context.state === "suspended") {
      audio.context.resume();
    }
  }

  function createNoiseBuffer(context, duration) {
    const buffer = context.createBuffer(1, duration * context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function playShotSound(weapon) {
    if (!audio.context) {
      return;
    }

    const now = audio.context.currentTime;
    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    const filter = audio.context.createBiquadFilter();

    oscillator.type = weapon === "light" ? "triangle" : "sawtooth";
    oscillator.frequency.setValueAtTime(weapon === "light" ? 960 : 220, now);
    oscillator.frequency.exponentialRampToValueAtTime(weapon === "light" ? 420 : 95, now + (weapon === "light" ? 0.12 : 0.2));

    filter.type = weapon === "light" ? "bandpass" : "lowpass";
    filter.frequency.setValueAtTime(weapon === "light" ? 1900 : 640, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(weapon === "light" ? 0.15 : 0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (weapon === "light" ? 0.16 : 0.24));

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    oscillator.start(now);
    oscillator.stop(now + (weapon === "light" ? 0.17 : 0.25));

    if (weapon === "fire") {
      const noise = audio.context.createBufferSource();
      const noiseGain = audio.context.createGain();
      noise.buffer = audio.noiseBuffer;
      noiseGain.gain.setValueAtTime(0.08, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      noise.connect(noiseGain);
      noiseGain.connect(audio.master);
      noise.start(now);
      noise.stop(now + 0.18);
    }
  }

  function playExplosionSound() {
    if (!audio.context) {
      return;
    }
    const now = audio.context.currentTime;

    const boom = audio.context.createOscillator();
    const boomGain = audio.context.createGain();
    boom.type = "triangle";
    boom.frequency.setValueAtTime(140, now);
    boom.frequency.exponentialRampToValueAtTime(42, now + 0.45);
    boomGain.gain.setValueAtTime(0.001, now);
    boomGain.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    boom.connect(boomGain);
    boomGain.connect(audio.master);
    boom.start(now);
    boom.stop(now + 0.55);

    const crackle = audio.context.createBufferSource();
    const crackleGain = audio.context.createGain();
    crackle.buffer = audio.noiseBuffer;
    crackleGain.gain.setValueAtTime(0.18, now);
    crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    crackle.connect(crackleGain);
    crackleGain.connect(audio.master);
    crackle.start(now);
    crackle.stop(now + 0.5);
  }

  function playVictorySound() {
    if (!audio.context) {
      return;
    }

    const now = audio.context.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach(function (note, index) {
      const oscillator = audio.context.createOscillator();
      const gain = audio.context.createGain();
      oscillator.type = index % 2 === 0 ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(note, now + index * 0.12);
      gain.gain.setValueAtTime(0.001, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.34);
      oscillator.connect(gain);
      gain.connect(audio.master);
      oscillator.start(now + index * 0.12);
      oscillator.stop(now + index * 0.12 + 0.36);
    });

    const shimmer = audio.context.createBufferSource();
    const shimmerGain = audio.context.createGain();
    shimmer.buffer = audio.noiseBuffer;
    shimmerGain.gain.setValueAtTime(0.06, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(audio.master);
    shimmer.start(now);
    shimmer.stop(now + 0.9);
  }

  function refreshHud() {
    scoreValue.textContent = String(state.score);
    hitsValue.textContent = String(state.hits);
    streakValue.textContent = String(state.streak);
    explosionValue.textContent = state.explosions + " / " + activePlanets.length;
    updateMissionReport();
  }

  function updateMissionReport() {
    const cooldown = getCurrentCooldown();
    const fireBoost = Math.round((1 - cooldown / (state.weapon === "light" ? 170 : 310)) * 100);
    const liveAsteroids = activeAsteroids.filter(function (asteroid) {
      return asteroid.active;
    }).length;

    reportStats.innerHTML =
      "<div class=\"report-card\"><span>Current weapon</span><strong>" + escapeHtml(state.weapon.toUpperCase()) + "</strong></div>" +
      "<div class=\"report-card\"><span>Shots fired</span><strong>" + state.shotsFired + "</strong></div>" +
      "<div class=\"report-card\"><span>Asteroids smashed</span><strong>" + state.asteroidsDestroyed + "</strong></div>" +
      "<div class=\"report-card\"><span>Fire speed boost</span><strong>" + fireBoost + "%</strong></div>" +
      "<div class=\"report-card\"><span>Current cooldown</span><strong>" + Math.round(cooldown) + "ms</strong></div>" +
      "<div class=\"report-card\"><span>Asteroids in space</span><strong>" + liveAsteroids + "</strong></div>";

    planetReport.innerHTML = activePlanets.map(function (planet) {
      const hitsLeft = Math.max(0, Math.ceil(planet.currentHp));
      const classes = [
        "planet-item",
        planet.exploded ? "done" : "",
        !planet.exploded && hitsLeft <= Math.max(1, Math.ceil(planet.maxHp * 0.1)) ? "critical" : ""
      ].filter(Boolean).join(" ");

      const value = planet.exploded ? "0" : String(hitsLeft);

      return "<div class=\"" + classes + "\"><span>" +
        escapeHtml(planet.definition.name) +
        "</span><strong>" +
        escapeHtml(value) +
        "</strong></div>";
    }).join("");
  }

  function getRatingValue() {
    const accuracyBoost = state.hits > 0 ? Math.min(1.2, state.hits / Math.max(state.hits + 6, 1)) : 0;
    const scoreBoost = Math.min(2.4, state.score / 450);
    const explosionBoost = (state.explosions / activePlanets.length) * 2;
    return Math.max(1, Math.min(5, Math.round(1 + accuracyBoost + scoreBoost + explosionBoost)));
  }

  function getRatingText() {
    return "*".repeat(getRatingValue());
  }

  function saveScore(event) {
    event.preventDefault();
    if (!state.gameOver || state.scoreSaved) {
      return;
    }
    const name = (playerNameInput.value || "Nick").trim().slice(0, 14);
    const entries = loadLeaderboard();
    entries.push({
      name: name || "Nick",
      score: state.score,
      explosions: state.explosions,
      rating: getRatingText(),
      timestamp: Date.now(),
    });
    entries.sort(function (a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.explosions - a.explosions;
    });
    localStorage.setItem(leaderboardStorageKey, JSON.stringify(entries.slice(0, 8)));
    state.scoreSaved = true;
    updateLeaderboardAccess();
    renderLeaderboard();
    missionMessage.textContent = name + " joined the galaxy leaderboard with " + state.score + " points!";
  }

  function loadLeaderboard() {
    try {
      const stored = JSON.parse(localStorage.getItem(leaderboardStorageKey) || "[]");
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      return [];
    }
  }

  function renderLeaderboard() {
    const entries = loadLeaderboard();
    leaderboardList.innerHTML = "";

    if (!entries.length) {
      const empty = document.createElement("li");
      empty.innerHTML = "<span>No pilots yet</span><strong>Ready!</strong>";
      leaderboardList.appendChild(empty);
      return;
    }

    entries.forEach(function (entry, index) {
      const item = document.createElement("li");
      item.innerHTML =
        "<span>" +
        (index + 1) +
        ". " +
        escapeHtml(entry.name) +
        " " +
        escapeHtml(entry.rating || "*") +
        "</span><strong>" +
        entry.score +
        "</strong>";
      leaderboardList.appendChild(item);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resetGame() {
    state.score = 0;
    state.hits = 0;
    state.streak = 0;
    state.explosions = 0;
    state.asteroidsDestroyed = 0;
    state.shotsFired = 0;
    state.fireRateBoostLevel = 0;
    state.gameOver = false;
    state.lastShotAt = 0;
    state.missionStart = performance.now();
    state.hoveredPlanet = null;
    state.scoreSaved = false;
    missionMessage.textContent = "Fresh mission ready. Blast all 8 planets and earn a shiny star rating.";
    camera.position.set(0, 7, 58);
    mouseLook.yaw = 0;
    mouseLook.pitch = -0.12;
    hideVictoryCelebration();
    updateLeaderboardAccess();

    activePlanets.forEach(function (planet) {
      planet.currentHp = planet.maxHp;
      planet.exploded = false;
      planet.flash = 0;
      planet.orbitGroup.rotation.y = Math.random() * Math.PI * 2;
      planet.bodyMesh.visible = true;
      planet.halo.visible = true;
      planet.label.visible = true;
      if (planet.ring) {
        planet.ring.visible = true;
      }
      updatePlanetVisual(planet, 0);
    });

    activeAsteroids.forEach(function (asteroid) {
      respawnAsteroid(asteroid, true);
    });

    activeExplosions.forEach(function (explosion) {
      scene.remove(explosion.points);
      explosion.points.geometry.dispose();
      explosion.points.material.dispose();
    });
    activeExplosions.length = 0;

    activeBeams.forEach(function (beam) {
      scene.remove(beam.line, beam.muzzle, beam.pulse);
      beam.markers.forEach(function (marker) {
        scene.remove(marker);
        marker.geometry.dispose();
        marker.material.dispose();
      });
      beam.line.geometry.dispose();
      beam.line.material.dispose();
      beam.muzzle.geometry.dispose();
      beam.muzzle.material.dispose();
      beam.pulse.geometry.dispose();
      beam.pulse.material.dispose();
    });
    activeBeams.length = 0;

    refreshHud();
  }

  function setWeapon(weapon) {
    state.weapon = weapon;
    weaponButtons.forEach(function (item) {
      item.classList.toggle("active", item.dataset.weapon === weapon);
    });
    missionMessage.textContent = weapon === "light"
      ? "Light blaster ready. It is quick and sparkly."
      : "Fire blaster ready. Bigger blast, warmer sound.";
    updateMissionReport();
  }

  function updateLeaderboardAccess() {
    const unlocked = state.gameOver && !state.scoreSaved;
    playerNameInput.disabled = !unlocked;
    saveScoreButton.disabled = !unlocked;
    if (state.scoreSaved) {
      saveScoreButton.textContent = "Score Saved";
    } else {
      saveScoreButton.textContent = "Save Score";
    }
  }

  function unlockPointer() {
    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  function applyControls(delta) {
    const turnSpeed = 1.55;
    if (keys.ArrowLeft) {
      mouseLook.yaw += turnSpeed * delta;
    }
    if (keys.ArrowRight) {
      mouseLook.yaw -= turnSpeed * delta;
    }
    if (keys.ArrowUp) {
      mouseLook.pitch += turnSpeed * delta;
    }
    if (keys.ArrowDown) {
      mouseLook.pitch -= turnSpeed * delta;
    }

    mouseLook.pitch = THREE.MathUtils.clamp(mouseLook.pitch, -1.25, 1.1);
    camera.rotation.y = mouseLook.yaw;
    camera.rotation.x = mouseLook.pitch;

    tempVector.set(0, 0, 0);
    camera.getWorldDirection(shotDirection);
    rightVector.crossVectors(shotDirection, camera.up).normalize().multiplyScalar(-1);

    if (keys.KeyW) {
      tempVector.add(shotDirection);
    }
    if (keys.KeyS) {
      tempVector.sub(shotDirection);
    }
    if (keys.KeyA) {
      tempVector.sub(rightVector);
    }
    if (keys.KeyD) {
      tempVector.add(rightVector);
    }

    if (tempVector.lengthSq() > 0) {
      tempVector.normalize().multiplyScalar(13 * state.shipSpeed * delta);
      camera.position.add(tempVector);
    }

    const distanceFromSun = camera.position.length();
    if (distanceFromSun < 10) {
      camera.position.normalize().multiplyScalar(10);
      camera.position.y = Math.max(camera.position.y, 2);
    }
    if (distanceFromSun > 96) {
      camera.position.normalize().multiplyScalar(96);
    }
  }

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.03);

    applyControls(delta);
    updateTargeting();
    animateSystem(delta);
    animateAsteroids(delta);
    animateBeams(delta);
    animateExplosions(delta);

    renderer.render(scene, camera);
  }

  function animateSystem(delta) {
    const speed = state.solarSpeed;
    solarSystemRoot.rotation.y += delta * 0.025;
    sunParts.sun.rotation.y += delta * 0.22;
    sunParts.corona.scale.setScalar(1 + Math.sin(performance.now() * 0.0038) * 0.04);
    sunParts.glow.material.rotation += delta * 0.03;

    activePlanets.forEach(function (planet) {
      planet.orbitGroup.rotation.y += delta * planet.definition.orbitSpeed * 0.18 * speed;
      planet.bodyMesh.rotation.y += delta * planet.definition.spin;
      planet.halo.rotation.y -= delta * 0.4;
      updatePlanetVisual(planet, delta);
    });
  }

  function animateAsteroids(delta) {
    activeAsteroids.forEach(function (asteroid) {
      if (!asteroid.active) {
        if (performance.now() >= asteroid.respawnAt && !state.gameOver) {
          respawnAsteroid(asteroid, true);
          updateMissionReport();
        }
        return;
      }

      asteroid.mesh.position.addScaledVector(asteroid.velocity, delta * (0.7 + state.solarSpeed * 0.35));
      asteroid.mesh.rotation.x += asteroid.rotationSpeed.x * delta;
      asteroid.mesh.rotation.y += asteroid.rotationSpeed.y * delta;
      asteroid.mesh.rotation.z += asteroid.rotationSpeed.z * delta;
      updateAsteroidTail(asteroid);

      if (asteroid.mesh.position.length() > 95 || Math.abs(asteroid.mesh.position.y) > 34) {
        respawnAsteroid(asteroid, true);
      }
    });
  }

  function animateBeams(delta) {
    activeBeams.forEach(function (beam) {
      beam.life -= delta;
      const ratio = Math.max(0, beam.life / beam.maxLife);
      beam.line.material.opacity = ratio * 1.2;
      beam.markers.forEach(function (marker, index) {
        marker.material.opacity = ratio * (1 - index * 0.12);
        marker.scale.setScalar(1 + (1 - ratio) * (1.4 + index * 0.12));
      });
      beam.muzzle.material.opacity = ratio * 1.05;
      beam.muzzle.scale.setScalar(1 + (1 - ratio) * 2.6);
      beam.pulse.material.opacity = ratio * 0.9;
      beam.pulse.scale.setScalar(1 + (1 - ratio) * 2.4);
      if (beam.life <= 0) {
        beamsToRemove.push(beam);
      }
    });

    while (beamsToRemove.length) {
      const beam = beamsToRemove.pop();
      const index = activeBeams.indexOf(beam);
      if (index >= 0) {
        activeBeams.splice(index, 1);
      }
      scene.remove(beam.line, beam.muzzle, beam.pulse);
      beam.markers.forEach(function (marker) {
        scene.remove(marker);
        marker.geometry.dispose();
        marker.material.dispose();
      });
      beam.line.geometry.dispose();
      beam.line.material.dispose();
      beam.muzzle.geometry.dispose();
      beam.muzzle.material.dispose();
      beam.pulse.geometry.dispose();
      beam.pulse.material.dispose();
    }
  }

  function animateExplosions(delta) {
    activeExplosions.forEach(function (explosion) {
      explosion.life -= delta;
      const ratio = Math.max(0, explosion.life / explosion.maxLife);
      const positions = explosion.points.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += explosion.velocities[i] * delta;
        positions[i + 1] += explosion.velocities[i + 1] * delta;
        positions[i + 2] += explosion.velocities[i + 2] * delta;
      }
      explosion.points.geometry.attributes.position.needsUpdate = true;
      explosion.points.material.opacity = ratio;
      explosion.points.material.size = 0.8 + (1 - ratio) * 0.8;

      if (explosion.life <= 0) {
        particlesToRemove.push(explosion);
      }
    });

    while (particlesToRemove.length) {
      const explosion = particlesToRemove.pop();
      const index = activeExplosions.indexOf(explosion);
      if (index >= 0) {
        activeExplosions.splice(index, 1);
      }
      scene.remove(explosion.points);
      explosion.points.geometry.dispose();
      explosion.points.material.dispose();
    }
  }

  function handlePointerMove(event) {
    if (!state.pointerLocked) {
      return;
    }
    mouseLook.yaw -= event.movementX * 0.0026;
    mouseLook.pitch -= event.movementY * 0.0024;
    mouseLook.pitch = THREE.MathUtils.clamp(mouseLook.pitch, -1.25, 1.1);
  }

  function resize() {
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  solarSpeedInput.addEventListener("input", function () {
    state.solarSpeed = parseFloat(solarSpeedInput.value);
    solarSpeedValue.textContent = state.solarSpeed.toFixed(1) + "x";
  });

  shipSpeedInput.addEventListener("input", function () {
    state.shipSpeed = parseFloat(shipSpeedInput.value);
    shipSpeedValue.textContent = state.shipSpeed.toFixed(1) + "x";
  });

  resetButton.addEventListener("click", resetGame);
  leaderboardForm.addEventListener("submit", saveScore);

  weaponButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setWeapon(button.dataset.weapon);
    });
  });

  window.addEventListener("resize", resize);
  document.addEventListener("mousemove", handlePointerMove);
  document.addEventListener("pointerlockchange", function () {
    state.pointerLocked = document.pointerLockElement === renderer.domElement || document.pointerLockElement === viewport;
  });

  viewport.addEventListener("click", function () {
    ensureAudio();
    if (state.gameOver) {
      return;
    }
    if (!state.pointerLocked && renderer.domElement.requestPointerLock) {
      renderer.domElement.requestPointerLock();
    } else if (state.pointerLocked) {
      shoot();
    }
  });

  document.addEventListener("keydown", function (event) {
    const typingInInput = event.target === playerNameInput;
    if (event.code === "Space") {
      event.preventDefault();
      ensureAudio();
      shoot();
      return;
    }
    if (typingInInput) {
      return;
    }
    if (event.code === "KeyF") {
      setWeapon("fire");
      return;
    }
    if (event.code === "KeyL") {
      setWeapon("light");
      return;
    }
    keys[event.code] = true;
  });

  document.addEventListener("keyup", function (event) {
    keys[event.code] = false;
  });

  mouseLook.pitch = -0.12;
  solarSpeedValue.textContent = state.solarSpeed.toFixed(1) + "x";
  shipSpeedValue.textContent = state.shipSpeed.toFixed(1) + "x";
  renderer.setAnimationLoop(animate);
})();
