(function() {
  'use strict';

  let glowElement = null;
  let mouseX = 0;
  let mouseY = 0;
  let currentX = 0;
  let currentY = 0;
  let animationId = null;
  let isTouch = false;

  // Configuration
  const config = {
    size: 800,           // Glow diameter in pixels
    smoothing: 0.15,     // Movement smoothing (0-1, lower = smoother)
    opacity: 0.35,       // Base opacity of glow
    color: '255, 211, 77' // RGB color (cream white for warm lighting)
  };

  function init() {
    // Check if touch device
    isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isTouch) {
      return; // Don't initialize on touch devices
    }

    createGlowElement();
    addEventListeners();
    animate();
  }

  function createGlowElement() {
    glowElement = document.createElement('div');
    glowElement.id = 'cursor-glow';
    glowElement.style.cssText = `
      position: fixed;
      width: ${config.size}px;
      height: ${config.size}px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      opacity: 0;
      background: radial-gradient(
        circle at center,
        rgba(${config.color}, ${config.opacity}) 0%,
        rgba(${config.color}, ${config.opacity * 0.6}) 25%,
        rgba(${config.color}, ${config.opacity * 0.3}) 50%,
        rgba(${config.color}, 0) 70%
      );
      mix-blend-mode: soft-light;
      transform: translate(-50%, -50%);
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(glowElement);
  }

  function addEventListeners() {
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseenter', onMouseEnter);
    document.addEventListener('mouseleave', onMouseLeave);
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function onMouseEnter() {
    if (glowElement) {
      glowElement.style.opacity = '1';
    }
  }

  function onMouseLeave() {
    if (glowElement) {
      glowElement.style.opacity = '0';
    }
  }

  function animate() {
    // Smooth interpolation
    currentX += (mouseX - currentX) * config.smoothing;
    currentY += (mouseY - currentY) * config.smoothing;

    if (glowElement) {
      glowElement.style.left = currentX + 'px';
      glowElement.style.top = currentY + 'px';
    }

    animationId = requestAnimationFrame(animate);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', function() {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });

})();
