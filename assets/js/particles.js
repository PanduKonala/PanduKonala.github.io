/**
 * Canvas API Particle System
 * Creates an animated particle background with twinkling stars and shooting stars
 * No external dependencies required
 */

(function() {
  'use strict';

  let canvas, ctx;
  let stars = [];
  let nebulas = []; // Colorful space clouds
  let clusters = []; // Distant star clusters/galaxies
  let spaceDust = []; // Atmospheric dust particles
  let animationId;
  let resizeTimeout;
  let shootingStarsContainer; // CSS shooting stars container

  // Professional Deep Blue Color palette with stellar classification
  const colors = {
    // Stellar classification colors (realistic star temperatures)
    stellarColors: {
      distant: [ // Cooler, redder distant stars
        'rgba(255, 204, 111, ', // Yellow-orange (G-type like Sun)
        'rgba(255, 166, 81, ',  // Orange (K-type)
        'rgba(255, 135, 94, ',  // Red-orange (M-type)
        'rgba(255, 189, 157, '  // Pale red
      ],
      mid: [ // Medium distance stars
        'rgba(255, 244, 234, ', // White-yellow (F-type)
        'rgba(255, 255, 255, ', // White
        'rgba(202, 215, 255, ', // Blue-white (A-type)
        'rgba(170, 191, 255, '  // Light blue
      ],
      near: [ // Closer, brighter blue stars
        'rgba(155, 176, 255, ', // Blue (B-type)
        'rgba(147, 197, 253, ', // Light blue
        'rgba(96, 165, 250, ',  // Sky blue
        'rgba(59, 130, 246, '   // Deep blue
      ]
    },
    shootingStar: '#d4af37', // Gold
    nebulaColors: [
      { r: 147, g: 197, b: 253 }, // Light blue
      { r: 96, g: 165, b: 250 },  // Sky blue
      { r: 59, g: 130, b: 246 },  // Deep blue
      { r: 139, g: 92, b: 246 },  // Purple
      { r: 167, g: 139, b: 250 }, // Soft purple
      { r: 236, g: 72, b: 153 },  // Pink
      { r: 251, g: 146, b: 60 },  // Orange
      { r: 34, g: 211, b: 238 },  // Cyan/Teal
      { r: 74, g: 222, b: 128 },  // Green
      { r: 244, g: 114, b: 182 }, // Rose
      { r: 192, g: 132, b: 252 }  // Violet
    ],
    clusterColors: [
      { r: 255, g: 230, b: 200 }, // Warm glow
      { r: 200, g: 210, b: 255 }, // Cool blue
      { r: 255, g: 200, b: 220 }, // Pink tint
      { r: 220, g: 255, b: 230 }  // Green tint
    ]
  };

  // Configuration
  const config = {
    // Star layers (parallax depth)
    distantStarCount: 200, // Far away, slow
    midStarCount: 200,     // Medium distance
    nearStarCount: 100,    // Close, fast
    // Nebula settings
    nebulaCount: 8,
    nebulaMinSize: 250,
    nebulaMaxSize: 600,
    nebulaOpacity: 0.12,
    // Cluster settings
    clusterCount: 4,
    clusterMinSize: 80,
    clusterMaxSize: 150,
    // Space dust
    dustCount: 80,
    // CSS shooting stars
    shootingStarCount: 8 // Reduced for less frequent shooting stars
  };

  function init() {
    // Create canvas element
    canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    canvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      pointer-events: none;
    `;
    document.body.prepend(canvas);

    ctx = canvas.getContext('2d');

    // Set canvas size immediately (no debounce for initial setup)
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create stars immediately
    createStars();

    // Draw first frame immediately to ensure backdrop-filter has content to blur
    drawFirstFrame();

    // Event listeners
    window.addEventListener('resize', resizeCanvas);

    // Start animation
    animate();

    // Create CSS shooting stars
    createCSSShootingStars();

    // Force repaint for backdrop-filter to work properly
    forceBackdropFilterRefresh();

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for pageshow event (back/forward navigation)
    window.addEventListener('pageshow', handlePageShow);
  }

  function drawFirstFrame() {
    // Draw all elements once immediately
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Initialize current values for first draw
    stars.forEach(star => {
      star.currentOpacity = star.minOpacity + (star.maxOpacity - star.minOpacity) * 0.5;
      star.currentSize = star.size;
    });
    nebulas.forEach(nebula => {
      nebula.currentOpacity = nebula.opacity;
    });
    clusters.forEach(cluster => {
      cluster.currentOpacity = cluster.opacity;
    });
    spaceDust.forEach(dust => {
      dust.currentOpacity = dust.opacity;
    });

    drawClusters();
    drawNebulas();
    drawSpaceDust();
    drawStars();
    drawVignette();
  }

  function forceBackdropFilterRefresh() {
    // Force browser to recalculate backdrop-filter by toggling a property
    const glassElements = document.querySelectorAll('.hero-card-glass, .detail-container, .about-card, .timeline-header');

    glassElements.forEach(el => {
      // Force recomposite
      el.style.transform = 'translateZ(0)';
    });

    // Additional refresh after a short delay to catch late-rendering elements
    setTimeout(() => {
      glassElements.forEach(el => {
        el.style.transform = '';
        // Force another reflow
        void el.offsetHeight;
        el.style.transform = 'translateZ(0)';
      });
    }, 50);

    // Final cleanup
    setTimeout(() => {
      glassElements.forEach(el => {
        el.style.transform = '';
      });
    }, 150);
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // Recreate stars when page becomes visible again
      resizeCanvas();
    }
  }

  function handlePageShow(event) {
    // If page is loaded from cache (back/forward), reinitialize
    if (event.persisted || performance.getEntriesByType('navigation')[0]?.type === 'back_forward') {
      reinitialize();
    } else {
      // Regular page load - just ensure canvas is sized correctly
      resizeCanvas();
    }
  }

  function reinitialize() {
    // Clear existing animation
    if (animationId) {
      cancelAnimationFrame(animationId);
    }

    // Reset canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Recreate all elements
    stars = [];
    nebulas = [];
    createStars();

    // Draw first frame immediately
    drawFirstFrame();

    // Restart animation
    animate();

    // Recreate CSS shooting stars
    createCSSShootingStars();

    // Force backdrop-filter refresh
    forceBackdropFilterRefresh();
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Debounce star recreation to avoid performance issues
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      createStars();
    }, 250);
  }

  function createStars() {
    stars = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Create distant stars (slow, small, warm colors)
    for (let i = 0; i < config.distantStarCount; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = 0.05 + Math.random() * 0.03; // Slow
      const vx = distance > 0 ? (dx / distance) * speed : 0;
      const vy = distance > 0 ? (dy / distance) * speed : 0;

      stars.push({
        x: x, y: y,
        size: Math.random() * 1 + 0.3, // Small
        color: colors.stellarColors.distant[Math.floor(Math.random() * colors.stellarColors.distant.length)],
        twinkleSpeed: 0.005 + Math.random() * 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
        minOpacity: 0.2 + Math.random() * 0.15,
        maxOpacity: 0.5 + Math.random() * 0.2,
        vx: vx, vy: vy,
        initialDistance: distance,
        layer: 'distant'
      });
    }

    // Create mid-distance stars (medium speed, size, neutral colors)
    for (let i = 0; i < config.midStarCount; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = 0.12 + Math.random() * 0.08; // Medium
      const vx = distance > 0 ? (dx / distance) * speed : 0;
      const vy = distance > 0 ? (dy / distance) * speed : 0;

      stars.push({
        x: x, y: y,
        size: Math.random() * 1.5 + 0.5, // Medium
        color: colors.stellarColors.mid[Math.floor(Math.random() * colors.stellarColors.mid.length)],
        twinkleSpeed: 0.01 + Math.random() * 0.015,
        twinklePhase: Math.random() * Math.PI * 2,
        minOpacity: 0.3 + Math.random() * 0.2,
        maxOpacity: 0.7 + Math.random() * 0.25,
        vx: vx, vy: vy,
        initialDistance: distance,
        layer: 'mid'
      });
    }

    // Create near stars (fast, large, blue/bright colors)
    for (let i = 0; i < config.nearStarCount; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = 0.2 + Math.random() * 0.15; // Fast
      const vx = distance > 0 ? (dx / distance) * speed : 0;
      const vy = distance > 0 ? (dy / distance) * speed : 0;

      stars.push({
        x: x, y: y,
        size: Math.random() * 2.5 + 1, // Large
        color: colors.stellarColors.near[Math.floor(Math.random() * colors.stellarColors.near.length)],
        twinkleSpeed: 0.015 + Math.random() * 0.02,
        twinklePhase: Math.random() * Math.PI * 2,
        minOpacity: 0.5 + Math.random() * 0.2,
        maxOpacity: 0.85 + Math.random() * 0.15,
        vx: vx, vy: vy,
        initialDistance: distance,
        layer: 'near'
      });
    }

    // Create other elements
    createNebulas();
    createClusters();
    createSpaceDust();
  }

  function createNebulas() {
    nebulas = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < config.nebulaCount; i++) {
      const color = colors.nebulaColors[Math.floor(Math.random() * colors.nebulaColors.length)];
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;

      // Calculate direction from center
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Slower forward motion for nebulas
      const speed = 0.08 + Math.random() * 0.04;
      const vx = distance > 0 ? (dx / distance) * speed : 0;
      const vy = distance > 0 ? (dy / distance) * speed : 0;

      nebulas.push({
        x: x,
        y: y,
        size: config.nebulaMinSize + Math.random() * (config.nebulaMaxSize - config.nebulaMinSize),
        color: color,
        opacity: config.nebulaOpacity * (0.5 + Math.random() * 0.5),
        pulseSpeed: 0.002 + Math.random() * 0.003,
        pulsePhase: Math.random() * Math.PI * 2,
        // Forward motion - moving away from center
        vx: vx,
        vy: vy
      });
    }
  }

  function createClusters() {
    clusters = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < config.clusterCount; i++) {
      const color = colors.clusterColors[Math.floor(Math.random() * colors.clusterColors.length)];
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;

      // Very slow movement for distant galaxies
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = 0.02 + Math.random() * 0.02;
      const vx = distance > 0 ? (dx / distance) * speed : 0;
      const vy = distance > 0 ? (dy / distance) * speed : 0;

      clusters.push({
        x: x,
        y: y,
        size: config.clusterMinSize + Math.random() * (config.clusterMaxSize - config.clusterMinSize),
        color: color,
        opacity: 0.03 + Math.random() * 0.04, // Very faint
        pulseSpeed: 0.001 + Math.random() * 0.002,
        pulsePhase: Math.random() * Math.PI * 2,
        vx: vx,
        vy: vy,
        // Cluster shape variation
        elongation: 0.6 + Math.random() * 0.8,
        rotation: Math.random() * Math.PI * 2
      });
    }
  }

  function createSpaceDust() {
    spaceDust = [];

    for (let i = 0; i < config.dustCount; i++) {
      spaceDust.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + 0.5,
        opacity: 0.05 + Math.random() * 0.1,
        // Slow random drift (not tied to center)
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        // Subtle pulsing
        pulseSpeed: 0.003 + Math.random() * 0.005,
        pulsePhase: Math.random() * Math.PI * 2
      });
    }
  }

  function createCSSShootingStars() {
    // Remove existing container if present
    const existingContainer = document.querySelector('.shooting-stars-container');
    if (existingContainer) {
      existingContainer.remove();
    }

    // Remove old shooting star styles
    document.querySelectorAll('style[data-shooting-star]').forEach(s => s.remove());

    // Create container for CSS shooting stars
    shootingStarsContainer = document.createElement('div');
    shootingStarsContainer.className = 'shooting-stars-container';

    // Generate shooting stars with random positions across the viewport
    for (let i = 0; i < config.shootingStarCount; i++) {
      const star = document.createElement('div');
      star.className = 'shooting_star';

      // Random position across the entire viewport (percentage-based)
      const topPercent = Math.floor(Math.random() * 80); // 0% to 80% from top
      const leftPercent = Math.floor(Math.random() * 80); // 0% to 80% from left

      // Longer, more random animation delays for less frequent appearance
      const delay = Math.floor(Math.random() * 15000) + (i * 2000); // Staggered delays

      star.style.cssText = `
        top: ${topPercent}%;
        left: ${leftPercent}%;
        animation-delay: ${delay}ms;
      `;

      // Add before/after delays via inline style
      const style = document.createElement('style');
      style.setAttribute('data-shooting-star', i);
      style.textContent = `
        .shooting_star:nth-child(${i + 1})::before,
        .shooting_star:nth-child(${i + 1})::after {
          animation-delay: ${delay}ms;
        }
      `;
      document.head.appendChild(style);

      shootingStarsContainer.appendChild(star);
    }

    document.body.appendChild(shootingStarsContainer);
  }

  function updateStars() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    stars.forEach(star => {
      // Update twinkle phase
      star.twinklePhase += star.twinkleSpeed;

      // Calculate current opacity
      star.currentOpacity = star.minOpacity +
        (star.maxOpacity - star.minOpacity) *
        (Math.sin(star.twinklePhase) * 0.5 + 0.5);

      // Forward motion - move away from center
      star.x += star.vx;
      star.y += star.vy;

      // Gradually increase size as stars move closer (perspective effect)
      const dx = star.x - centerX;
      const dy = star.y - centerY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);

      // Stars grow slightly as they "approach" the viewer
      if (star.initialDistance > 0) {
        const distanceRatio = currentDistance / star.initialDistance;
        star.currentSize = star.size * (0.8 + distanceRatio * 0.4);
      } else {
        star.currentSize = star.size;
      }

      // Reset star when it goes off screen (continuous forward motion)
      if (star.x < -10 || star.x > canvas.width + 10 ||
          star.y < -10 || star.y > canvas.height + 10) {
        // Respawn at random position across the screen (not just center)
        star.x = Math.random() * canvas.width;
        star.y = Math.random() * canvas.height;

        // Recalculate velocity from new position based on layer
        const newDx = star.x - centerX;
        const newDy = star.y - centerY;
        const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);

        let speed;
        if (star.layer === 'distant') {
          speed = 0.05 + Math.random() * 0.03;
          star.size = Math.random() * 1 + 0.3;
          star.color = colors.stellarColors.distant[Math.floor(Math.random() * colors.stellarColors.distant.length)];
        } else if (star.layer === 'mid') {
          speed = 0.12 + Math.random() * 0.08;
          star.size = Math.random() * 1.5 + 0.5;
          star.color = colors.stellarColors.mid[Math.floor(Math.random() * colors.stellarColors.mid.length)];
        } else {
          speed = 0.2 + Math.random() * 0.15;
          star.size = Math.random() * 2.5 + 1;
          star.color = colors.stellarColors.near[Math.floor(Math.random() * colors.stellarColors.near.length)];
        }

        star.vx = newDistance > 0 ? (newDx / newDistance) * speed : 0;
        star.vy = newDistance > 0 ? (newDy / newDistance) * speed : 0;
        star.initialDistance = newDistance;
        star.currentSize = star.size;
      }
    });
  }

  function updateClusters() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    clusters.forEach(cluster => {
      cluster.pulsePhase += cluster.pulseSpeed;
      cluster.currentOpacity = cluster.opacity * (0.7 + Math.sin(cluster.pulsePhase) * 0.3);

      // Very slow forward motion
      cluster.x += cluster.vx;
      cluster.y += cluster.vy;

      // Reset when off screen
      if (cluster.x < -cluster.size * 2 || cluster.x > canvas.width + cluster.size * 2 ||
          cluster.y < -cluster.size * 2 || cluster.y > canvas.height + cluster.size * 2) {
        cluster.x = Math.random() * canvas.width;
        cluster.y = Math.random() * canvas.height;

        const dx = cluster.x - centerX;
        const dy = cluster.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 0.02 + Math.random() * 0.02;
        cluster.vx = distance > 0 ? (dx / distance) * speed : 0;
        cluster.vy = distance > 0 ? (dy / distance) * speed : 0;
        cluster.color = colors.clusterColors[Math.floor(Math.random() * colors.clusterColors.length)];
      }
    });
  }

  function updateSpaceDust() {
    spaceDust.forEach(dust => {
      dust.pulsePhase += dust.pulseSpeed;
      dust.currentOpacity = dust.opacity * (0.6 + Math.sin(dust.pulsePhase) * 0.4);

      // Slow drift
      dust.x += dust.vx;
      dust.y += dust.vy;

      // Wrap around screen edges
      if (dust.x < 0) dust.x = canvas.width;
      if (dust.x > canvas.width) dust.x = 0;
      if (dust.y < 0) dust.y = canvas.height;
      if (dust.y > canvas.height) dust.y = 0;
    });
  }

  function drawStars() {
    stars.forEach(star => {
      const size = star.currentSize || star.size;

      ctx.beginPath();
      ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
      ctx.fillStyle = star.color + star.currentOpacity + ')';
      ctx.fill();

      // Add glow effect for brighter stars
      if (star.currentOpacity > 0.6 && size > 1.5) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, size * 2, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
          star.x, star.y, 0,
          star.x, star.y, size * 2
        );
        gradient.addColorStop(0, star.color + (star.currentOpacity * 0.3) + ')');
        gradient.addColorStop(1, star.color + '0)');
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    });
  }

  function updateNebulas() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    nebulas.forEach(nebula => {
      // Pulse effect
      nebula.pulsePhase += nebula.pulseSpeed;
      nebula.currentOpacity = nebula.opacity * (0.7 + Math.sin(nebula.pulsePhase) * 0.3);

      // Forward motion - move away from center
      nebula.x += nebula.vx;
      nebula.y += nebula.vy;

      // Reset nebula when it goes off screen
      if (nebula.x < -nebula.size * 2 || nebula.x > canvas.width + nebula.size * 2 ||
          nebula.y < -nebula.size * 2 || nebula.y > canvas.height + nebula.size * 2) {
        // Respawn at random position
        nebula.x = Math.random() * canvas.width;
        nebula.y = Math.random() * canvas.height;

        // Recalculate velocity (moving away from center)
        const dx = nebula.x - centerX;
        const dy = nebula.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 0.08 + Math.random() * 0.04;
        nebula.vx = distance > 0 ? (dx / distance) * speed : 0;
        nebula.vy = distance > 0 ? (dy / distance) * speed : 0;

        // Randomize color and size on respawn
        nebula.color = colors.nebulaColors[Math.floor(Math.random() * colors.nebulaColors.length)];
        nebula.size = config.nebulaMinSize + Math.random() * (config.nebulaMaxSize - config.nebulaMinSize);
      }
    });
  }

  function drawNebulas() {
    nebulas.forEach(nebula => {
      const gradient = ctx.createRadialGradient(
        nebula.x, nebula.y, 0,
        nebula.x, nebula.y, nebula.size
      );

      const { r, g, b } = nebula.color;
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${nebula.currentOpacity})`);
      gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${nebula.currentOpacity * 0.5})`);
      gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${nebula.currentOpacity * 0.2})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(nebula.x, nebula.y, nebula.size, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    });
  }

  function drawClusters() {
    ctx.save();
    clusters.forEach(cluster => {
      const { r, g, b } = cluster.color;
      const opacity = cluster.currentOpacity || cluster.opacity;

      // Draw elongated ellipse for galaxy shape
      ctx.save();
      ctx.translate(cluster.x, cluster.y);
      ctx.rotate(cluster.rotation);
      ctx.scale(1, cluster.elongation);

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, cluster.size);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity * 1.5})`);
      gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${opacity})`);
      gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${opacity * 0.4})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(0, 0, cluster.size, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.restore();
    });
    ctx.restore();
  }

  function drawSpaceDust() {
    spaceDust.forEach(dust => {
      const opacity = dust.currentOpacity || dust.opacity;
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 200, 220, ${opacity})`;
      ctx.fill();
    });
  }

  function drawVignette() {
    // Subtle dark vignette around edges for cinematic deep space feel
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

    const gradient = ctx.createRadialGradient(
      centerX, centerY, maxRadius * 0.4,
      centerX, centerY, maxRadius
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function animate() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update all elements
    updateClusters();
    updateNebulas();
    updateSpaceDust();
    updateStars();

    // Draw (order matters - back to front)
    drawClusters();    // Farthest back - distant galaxies
    drawNebulas();     // Nebula clouds
    drawSpaceDust();   // Atmospheric dust
    drawStars();       // Stars (layered by depth)
    drawVignette();    // Top layer - cinematic vignette
    // Note: Shooting stars are now CSS-animated (separate from canvas)

    // Continue animation
    animationId = requestAnimationFrame(animate);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API for cleanup
  window.ParticleSystem = {
    destroy: function() {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (shootingStarIntervalId) {
        clearInterval(shootingStarIntervalId);
      }
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', resizeCanvas);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      const canvasEl = document.getElementById('particle-canvas');
      if (canvasEl) canvasEl.remove();
    },
    respawn: function() {
      createStars();
    },
    reinit: function() {
      reinitialize();
    },
    resize: function() {
      resizeCanvas();
    }
  };

})();
