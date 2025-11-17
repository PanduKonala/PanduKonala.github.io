/**
 * Timeline Accordion Functionality
 * Handles expand/collapse behavior for timeline items
 */

(function() {
  'use strict';

  function initTimeline() {
    const timelineItems = document.querySelectorAll('.timeline-item');

    if (timelineItems.length === 0) return;

    timelineItems.forEach(item => {
      const header = item.querySelector('.timeline-header');

      if (!header) return;

      header.addEventListener('click', function(e) {
        // Don't toggle if clicking on the link inside content
        if (e.target.closest('.timeline-link')) return;

        const isActive = item.classList.contains('active');

        // Close all other items (accordion behavior)
        timelineItems.forEach(otherItem => {
          if (otherItem !== item) {
            otherItem.classList.remove('active');
          }
        });

        // Toggle current item
        if (isActive) {
          item.classList.remove('active');
        } else {
          item.classList.add('active');

          // Scroll item into view if needed
          setTimeout(() => {
            const container = document.querySelector('.timeline-container');
            const itemRect = item.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            if (itemRect.bottom > containerRect.bottom) {
              item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 100);
        }
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimeline);
  } else {
    initTimeline();
  }

})();
