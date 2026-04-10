/**
 * JavaScript that gets injected into webview pages to capture DOM events.
 * Returns a self-executing string that sets up event listeners and
 * communicates back via window.postMessage.
 */
export function getDOMEventInjectionScript(): string {
  return `
    (function() {
      if (window.__leonardoDOMCapture) return;
      window.__leonardoDOMCapture = true;

      function getSelector(el) {
        if (!el || el === document.body || el === document.documentElement) return 'body';
        if (el.id) return '#' + CSS.escape(el.id);

        const parts = [];
        let current = el;
        while (current && current !== document.body) {
          let selector = current.tagName.toLowerCase();
          if (current.id) {
            parts.unshift('#' + CSS.escape(current.id));
            break;
          }
          if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\\s+/).slice(0, 3);
            if (classes.length > 0 && classes[0] !== '') {
              selector += '.' + classes.map(c => CSS.escape(c)).join('.');
            }
          }
          const parent = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
            if (siblings.length > 1) {
              const index = siblings.indexOf(current) + 1;
              selector += ':nth-of-type(' + index + ')';
            }
          }
          parts.unshift(selector);
          current = current.parentElement;
        }
        return parts.join(' > ');
      }

      function getElementText(el) {
        const text = (el.textContent || '').trim();
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
      }

      function emit(type, detail) {
        window.postMessage({
          __leonardoEvent: true,
          type: type,
          timestamp: Date.now(),
          elementSelector: detail.selector || '',
          coordinates: detail.coordinates || { x: 0, y: 0 },
          elementText: detail.text || '',
          url: detail.url || '',
          value: detail.value || '',
        }, '*');
      }

      // Click events
      document.addEventListener('click', function(e) {
        emit('click', {
          selector: getSelector(e.target),
          coordinates: { x: e.clientX, y: e.clientY },
          text: getElementText(e.target),
        });
      }, true);

      // Form submit events
      document.addEventListener('submit', function(e) {
        emit('submit', {
          selector: getSelector(e.target),
          coordinates: { x: 0, y: 0 },
          text: getElementText(e.target),
        });
      }, true);

      // Focus events (on inputs/textareas)
      document.addEventListener('focusin', function(e) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          const rect = e.target.getBoundingClientRect();
          emit('focus', {
            selector: getSelector(e.target),
            coordinates: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
            text: e.target.placeholder || e.target.name || '',
          });
        }
      }, true);

      // Input events (value changes)
      document.addEventListener('input', function(e) {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          emit('input', {
            selector: getSelector(e.target),
            coordinates: { x: 0, y: 0 },
            value: e.target.value ? '[' + e.target.value.length + ' chars]' : '',
          });
        }
      }, true);

      // Scroll events (throttled)
      let scrollTimeout = null;
      document.addEventListener('scroll', function(e) {
        if (scrollTimeout) return;
        scrollTimeout = setTimeout(function() {
          scrollTimeout = null;
          emit('scroll', {
            selector: getSelector(e.target === document ? document.body : e.target),
            coordinates: { x: window.scrollX, y: window.scrollY },
          });
        }, 500);
      }, true);

      // Navigation events (via History API)
      const origPush = history.pushState;
      const origReplace = history.replaceState;
      history.pushState = function() {
        origPush.apply(this, arguments);
        emit('navigate', { url: location.href });
      };
      history.replaceState = function() {
        origReplace.apply(this, arguments);
        emit('navigate', { url: location.href });
      };
      window.addEventListener('popstate', function() {
        emit('navigate', { url: location.href });
      });
    })();
  `
}
