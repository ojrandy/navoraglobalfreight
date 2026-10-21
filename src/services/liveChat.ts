// Smartsupp live chat for the public website. Loaded from code rather than index.html because the
// public site and the admin host share the same index.html, and the chat must never appear in the
// operations console. The snippet is Smartsupp's own loader, unchanged apart from typing.

const SMARTSUPP_KEY = '285d9b75390c3ee4e92d2e4f3cfc22751891a416';
const SMARTSUPP_LOADER = 'https://www.smartsuppchat.com/loader.js?';

type SmartsuppFn = ((...args: unknown[]) => void) & { _: unknown[][] };

declare global {
  interface Window {
    _smartsupp?: { key?: string };
    smartsupp?: SmartsuppFn;
  }
}

let loaded = false;

function load() {
  if (loaded || window.smartsupp) {
    loaded = true;
    return;
  }
  loaded = true;
  window._smartsupp = window._smartsupp || {};
  window._smartsupp.key = SMARTSUPP_KEY;
  const queue = function (...args: unknown[]) { queue._.push(args); } as SmartsuppFn;
  queue._ = [];
  window.smartsupp = queue;
  // The widget script itself waits until the page has finished loading and the browser is idle,
  // so it never competes with the page's own content. Calls made before then wait in the queue.
  const inject = () => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.charset = 'utf-8';
    script.async = true;
    script.src = SMARTSUPP_LOADER;
    document.head.appendChild(script);
  };
  const whenIdle = () => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
    if (idle) idle(inject, { timeout: 4000 });
    else setTimeout(inject, 2000);
  };
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}

// Shows the chat on public pages and hides it on admin. Nothing is downloaded until the first
// public page is shown, so a session that only ever opens admin never contacts Smartsupp.
export function setLiveChatVisible(visible: boolean) {
  if (typeof window === 'undefined') return;
  if (visible) {
    load();
    window.smartsupp?.('chat:show');
  } else if (loaded) {
    window.smartsupp?.('chat:hide');
  }
}
