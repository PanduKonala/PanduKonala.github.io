/**
 * Page Transitions
 * Smooth AJAX-based page transitions
 */

(function () {
  'use strict';

  let isTransitioning = false;
  const transitionDuration = 400; // ms

  function init() {
    // Create transition overlay if it doesn't exist
    if (!document.querySelector('.page-transition-overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'page-transition-overlay';
      document.body.appendChild(overlay);
    }

    // Intercept internal link clicks
    document.addEventListener('click', handleLinkClick);

    // Handle browser back/forward
    window.addEventListener('popstate', handlePopState);

    // Add fade-in animation on initial load
    const main = document.querySelector('main');
    if (main) {
      main.classList.add('fade-in');
    }
  }

  function handleLinkClick(e) {
    const link = e.target.closest('a');

    if (!link) return;

    const href = link.getAttribute('href');

    // Skip if:
    // - No href
    // - External link (different origin)
    // - Anchor link (#)
    // - mailto/tel links
    // - Has target="_blank"
    // - Is a download link
    if (!href ||
      link.hostname !== window.location.hostname ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      link.getAttribute('target') === '_blank' ||
      link.hasAttribute('download') ||
      isTransitioning) {
      return;
    }

    e.preventDefault();
    navigateTo(href);
  }

  function navigateTo(url) {
    if (isTransitioning) return;
    isTransitioning = true;

    const main = document.querySelector('main');
    const overlay = document.querySelector('.page-transition-overlay');

    document.body.classList.add('transitioning');
    document.body.classList.remove('page-loaded');

    // Start exit animation
    if (main) {
      main.classList.add('fade-out');
    }

    // Show overlay
    if (overlay) {
      overlay.classList.add('active');
    }

    // Wait for exit animation, then fetch new page
    setTimeout(() => {
      fetchPage(url);
    }, transitionDuration);
  }

  function fetchPage(url) {
    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.text();
      })
      .then(html => {
        updatePage(html, url);
      })
      .catch(error => {
        console.error('Page transition error:', error);
        // Fallback to normal navigation
        window.location.href = url;
      });
  }

  function updatePage(html, url) {
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(html, 'text/html');

    // Update URL in browser history FIRST (so relative paths resolve correctly)
    window.history.pushState({ url: url }, '', url);

    // Update page title
    document.title = newDoc.title;

    // Update body class (for theme changes)
    document.body.className = newDoc.body.className;
    document.body.classList.add('transitioning');

    // Replace main content
    const currentMain = document.querySelector('main');
    const newMain = newDoc.querySelector('main');

    if (currentMain && newMain) {
      currentMain.innerHTML = newMain.innerHTML;
      currentMain.className = newMain.className;
    }

    // Update header if needed (for different header styles)
    const currentHeader = document.querySelector('header');
    const newHeader = newDoc.querySelector('header');
    if (currentHeader && newHeader) {
      currentHeader.className = newHeader.className;
      currentHeader.innerHTML = newHeader.innerHTML;

      // Force logo image to reload with correct path
      const logoImg = currentHeader.querySelector('.logo');
      if (logoImg) {
        const originalSrc = logoImg.getAttribute('src');
        logoImg.src = '';
        logoImg.src = originalSrc;
      }
    }

    // Update nav if it exists
    const currentNav = document.querySelector('nav');
    const newNav = newDoc.querySelector('nav');
    if (newNav && !currentNav) {
      const header = document.querySelector('header');
      if (header) {
        header.insertAdjacentHTML('afterend', newNav.outerHTML);
      }
    } else if (!newNav && currentNav) {
      currentNav.remove();
    } else if (currentNav && newNav) {
      currentNav.outerHTML = newNav.outerHTML;
    }

    // Scroll to top
    window.scrollTo(0, 0);

    // Hide overlay and start entrance animation
    setTimeout(() => {
      const overlay = document.querySelector('.page-transition-overlay');
      if (overlay) {
        overlay.classList.remove('active');
      }

      const main = document.querySelector('main');
      if (main) {
        main.classList.remove('fade-out');
        main.classList.add('fade-in');
      }

      // Re-initialize any page-specific scripts
      reinitializeScripts();

      // Clean up
      setTimeout(() => {
        document.body.classList.remove('transitioning');
        document.body.classList.add('page-loaded');
        if (main) {
          main.classList.remove('fade-in');
        }
        isTransitioning = false;
      }, 500);
    }, 100);
  }

  function handlePopState(e) {
    if (isTransitioning) return;

    const url = window.location.href;
    isTransitioning = true;

    const main = document.querySelector('main');
    const overlay = document.querySelector('.page-transition-overlay');

    document.body.classList.add('transitioning');
    document.body.classList.remove('page-loaded');

    if (main) {
      main.classList.add('fade-out');
    }

    if (overlay) {
      overlay.classList.add('active');
    }

    setTimeout(() => {
      fetch(url)
        .then(response => response.text())
        .then(html => {
          const parser = new DOMParser();
          const newDoc = parser.parseFromString(html, 'text/html');

          document.title = newDoc.title;
          document.body.className = newDoc.body.className;
          document.body.classList.add('transitioning');

          const currentMain = document.querySelector('main');
          const newMain = newDoc.querySelector('main');

          if (currentMain && newMain) {
            currentMain.innerHTML = newMain.innerHTML;
            currentMain.className = newMain.className;
          }

          const currentHeader = document.querySelector('header');
          const newHeader = newDoc.querySelector('header');
          if (currentHeader && newHeader) {
            currentHeader.className = newHeader.className;
            currentHeader.innerHTML = newHeader.innerHTML;

            // Force logo image to reload with correct path
            const logoImg = currentHeader.querySelector('.logo');
            if (logoImg) {
              const originalSrc = logoImg.getAttribute('src');
              logoImg.src = '';
              logoImg.src = originalSrc;
            }
          }

          const currentNav = document.querySelector('nav');
          const newNav = newDoc.querySelector('nav');
          if (newNav && !currentNav) {
            const header = document.querySelector('header');
            if (header) {
              header.insertAdjacentHTML('afterend', newNav.outerHTML);
            }
          } else if (!newNav && currentNav) {
            currentNav.remove();
          } else if (currentNav && newNav) {
            currentNav.outerHTML = newNav.outerHTML;
          }

          window.scrollTo(0, 0);

          setTimeout(() => {
            if (overlay) {
              overlay.classList.remove('active');
            }

            if (main) {
              main.classList.remove('fade-out');
              main.classList.add('fade-in');
            }

            reinitializeScripts();

            setTimeout(() => {
              document.body.classList.remove('transitioning');
              document.body.classList.add('page-loaded');
              const mainEl = document.querySelector('main');
              if (mainEl) {
                mainEl.classList.remove('fade-in');
              }
              isTransitioning = false;
            }, 500);
          }, 100);
        })
        .catch(error => {
          console.error('Pop state error:', error);
          window.location.reload();
        });
    }, transitionDuration);
  }

  function reinitializeScripts() {
    // Re-initialize particle system for new page dimensions
    if (window.ParticleSystem && typeof window.ParticleSystem.reinit === 'function') {
      window.ParticleSystem.reinit();
    }

    // Re-initialize timeline accordion if present
    if (typeof window.initTimeline === 'function') {
      window.initTimeline();
    }

    // Re-initialize scroll animations
    if (typeof window.initScrollAnimations === 'function') {
      window.initScrollAnimations();
    }

    // Trigger timeline script if timeline elements exist
    const timelineItems = document.querySelectorAll('.timeline-item');
    if (timelineItems.length > 0) {
      timelineItems.forEach(item => {
        const header = item.querySelector('.timeline-header');
        if (header) {
          header.addEventListener('click', function () {
            const isActive = item.classList.contains('active');

            // Close all items
            document.querySelectorAll('.timeline-item').forEach(i => {
              i.classList.remove('active');
            });

            // Open clicked item if it wasn't active
            if (!isActive) {
              item.classList.add('active');
            }
          });
        }
      });
    }

    // Re-initialize navigation toggle if present
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    if (navToggle && navMenu) {
      navToggle.addEventListener('click', function () {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
