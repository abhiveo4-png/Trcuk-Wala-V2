declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let isScriptLoading = false;
let isApiLoaded = false;
const callbacks: (() => void)[] = [];

// Suppress unhandled cross-origin iframe errors ("Script error.") from YouTube embed origin
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message === 'Script error.' || (event.filename && event.filename.includes('youtube.com'))) {
      // Prevent cross-origin iframe script errors from crashing the console
      event.preventDefault();
    }
  });
}

export function loadYouTubeIframeApi(onReady: () => void): void {
  if (window.YT && window.YT.Player) {
    isApiLoaded = true;
    onReady();
    return;
  }

  callbacks.push(onReady);

  if (isScriptLoading) return;
  isScriptLoading = true;

  const previousOnReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    isApiLoaded = true;
    if (typeof previousOnReady === 'function') {
      try {
        previousOnReady();
      } catch (e) {
        console.warn('Error in previous onYouTubeIframeAPIReady', e);
      }
    }
    while (callbacks.length > 0) {
      const cb = callbacks.shift();
      if (cb) {
        try {
          cb();
        } catch (e) {
          console.warn('Error executing YT API callback', e);
        }
      }
    }
  };

  let scriptTag = document.getElementById('yt-iframe-api-script') as HTMLScriptElement | null;
  if (!scriptTag) {
    const script = document.createElement('script');
    script.id = 'yt-iframe-api-script';
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      console.warn('Failed to load YouTube Iframe API script');
      isScriptLoading = false;
    };
    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }
  }
}
