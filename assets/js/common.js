/**
 * Common JavaScript Functions
 * Handles smooth scrolling and other common interactions
 */

(function () {
  'use strict';

  // =============================================
  // Smooth Scrolling
  // =============================================
  function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
      link.addEventListener('click', function (e) {
        const href = this.getAttribute('href');

        if (href === '#') {
          e.preventDefault();
          return;
        }

        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  // =============================================
  // Fade In on Scroll
  // =============================================
  // =============================================
  // Fade In on Scroll
  // =============================================
  function initScrollAnimations() {
    const elements = document.querySelectorAll('.fade-in, .stagger-animate, .slide-in-left, .slide-in-right');

    if (elements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (entry.target.classList.contains('fade-in')) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          } else {
            entry.target.classList.add('visible');
          }
        }
      });
    }, {
      threshold: 0.1
    });

    elements.forEach(el => {
      if (el.classList.contains('fade-in')) {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      }
      observer.observe(el);
    });
  }

  // Expose for page transitions
  window.initScrollAnimations = initScrollAnimations;

  // =============================================
  // Back Button Navigation
  // =============================================
  function initBackButtons() {
    const backButtons = document.querySelectorAll('.back-btn');

    backButtons.forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.preventDefault();

        // Check if there's history to go back to
        if (window.history.length > 1) {
          window.history.back();
        } else {
          // Fallback to home page
          window.location.href = '/';
        }
      });
    });
  }

  // =============================================
  // Initialize All Functions
  // =============================================
  function init() {
    initSmoothScroll();
    initScrollAnimations();
    initBackButtons();

    // Add fade-in class to body
    document.body.classList.add('loaded');

    // Enable scrolling after brief delay to prevent scrollbar flash
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.add('page-loaded');
      });
    });
  }

  // =============================================
  // Run on DOM Content Loaded
  // =============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

// =============================================
// Add CSS Animation for Body Loaded
// =============================================
if (!document.querySelector('#common-styles')) {
  const style = document.createElement('style');
  style.id = 'common-styles';
  style.textContent = `
    body.loaded {
      animation: fadeIn 0.5s ease;
    }
  `;
  document.head.appendChild(style);
}
