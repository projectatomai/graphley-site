// Google Analytics, loaded only after the visitor clicks "Allow analytics" (same rules as jotley.ai and pulsecanvas.si).
// Settings come from the script tag's data attributes, so pages need no inline script:
//   data-ga        measurement ID (G-...)
//   data-site      short name for the stored choice ("textley" -> localStorage "textley.analytics-consent")
//   data-host      production hostname; the tag never loads anywhere else (previews, localhost)
//   data-privacy   privacy policy link shown in the banner
//   data-footer    CSS selector of the footer element that gets an "Analytics settings" button
//   data-css       stylesheet for the banner
//   data-app-store-id  optional: this app's Apple ID, once it is on the App Store (clicks on it send app_store_click)
(() => {
  const script = document.currentScript;
  if (!script) return;
  const config = script.dataset;
  const measurementId = config.ga;
  const storageKey = `${config.site}.analytics-consent`;
  const disableKey = `ga-disable-${measurementId}`;
  let accepted = false;
  let tagStarted = false;
  let banner = null;
  let opener = null;

  const isProductionSite = () =>
    location.protocol === 'https:' && location.hostname.replace(/^www\./, '') === config.host;

  const withoutQuery = value => {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    } catch { return ''; }
  };

  // Safari (above all on iPhone) deletes what page scripts save, localStorage and script cookies alike,
  // after 7 days without a visit, so the banner came back. The choice is also kept in a cookie the server
  // sets (functions/analytics-consent.gif.js), which Safari keeps for the cookie's full lifetime.
  function cookieChoice() {
    const match = document.cookie.match(/(?:^|;\s*)analytics_consent=(granted|denied)(?:;|$)/);
    return match ? match[1] : null;
  }

  function rememberOnServer(value) {
    const ping = new Image();
    ping.src = `/analytics-consent.gif?choice=${value}&t=${Date.now()}`;
  }

  function storedChoice() {
    let value = null;
    try { value = localStorage.getItem(storageKey); } catch { /* Fall back to the cookie below. */ }
    if (value !== 'granted' && value !== 'denied') value = null;
    const saved = cookieChoice();
    if (!value && saved) {
      value = saved;
      try { localStorage.setItem(storageKey, value); } catch { /* The cookie still holds it. */ }
    }
    if (value && saved !== value) rememberOnServer(value);
    return value;
  }

  function startTag() {
    if (!isProductionSite() || tagStarted) return;
    tagStarted = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: withoutQuery(location.href),
      page_referrer: withoutQuery(document.referrer),
    });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.append(tag);
  }

  function clearCookies() {
    const names = document.cookie.split(';').map(cookie => cookie.trim().split('=')[0]);
    const parts = location.hostname.split('.');
    const domains = ['', ...parts.map((_, index) => `.${parts.slice(index).join('.')}`)];
    for (const name of names.filter(name => /^_ga(?:_|$)/.test(name))) {
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; Path=/;${domain ? ` Domain=${domain};` : ''} SameSite=Lax`;
      }
    }
  }

  function apply(value) {
    accepted = value === 'granted';
    window[disableKey] = !accepted;
    if (tagStarted && window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: accepted ? 'granted' : 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    }
    if (accepted) startTag();
    else clearCookies();
  }

  function choose(value) {
    try { localStorage.setItem(storageKey, value); } catch { /* The choice still applies on this page. */ }
    rememberOnServer(value);
    apply(value);
    hideBanner();
  }

  function hideBanner() {
    if (!banner) return;
    banner.hidden = true;
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
  }

  function showBanner(focus) {
    if (!banner) {
      banner = document.createElement('aside');
      banner.className = 'analytics-choice';
      banner.setAttribute('aria-label', 'Website analytics preference');
      const text = document.createElement('div');
      const heading = document.createElement('h2');
      heading.textContent = 'Website analytics';
      const body = document.createElement('p');
      body.append('Allow Google Analytics cookies to understand visits, page views, and link clicks? We don’t send your name, email, or anything from the app. ');
      const privacy = document.createElement('a');
      privacy.href = config.privacy || '/privacy/';
      privacy.textContent = 'Privacy policy';
      body.append(privacy);
      text.append(heading, body);
      const actions = document.createElement('div');
      actions.className = 'analytics-choice-actions';
      const decline = document.createElement('button');
      decline.type = 'button';
      decline.textContent = 'Decline';
      decline.addEventListener('click', () => choose('denied'));
      const allow = document.createElement('button');
      allow.type = 'button';
      allow.className = 'analytics-allow';
      allow.textContent = 'Allow analytics';
      allow.addEventListener('click', () => choose('granted'));
      actions.append(decline, allow);
      banner.append(text, actions);
      document.body.append(banner);
    }
    banner.hidden = false;
    if (focus) banner.querySelector('button').focus();
  }

  function addSettingsButton() {
    const footer = config.footer && document.querySelector(config.footer);
    if (!footer) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'analytics-settings-link';
    button.textContent = 'Analytics settings';
    button.addEventListener('click', () => {
      opener = button;
      showBanner(true);
    });
    footer.append(button);
  }

  // Link clicks named like jotley.ai and pulsecanvas.si, so the dashboard reads them the same way:
  //   mac_installer_download  the .dmg itself (the real download)
  //   download_click_mac      a "Download for Mac" button that leads to the download page
  //   app_store_click         this site's own App Store listing (data-app-store-id="<Apple ID>" on the script tag).
  //                           Links to the other Protomota apps in the footer are not this site's downloads, so they
  //                           send nothing here (GA's own outbound click still records them).
  //   source_click, newsletter_click
  const ownStoreId = config.appStoreId || '';
  function eventFor(link) {
    const href = link.href || '';
    let url;
    try { url = new URL(href, location.href); } catch { return null; }
    if (/\.dmg$/i.test(url.pathname)) {
      const fileName = url.pathname.split('/').pop();
      const version = fileName.match(/-(\d+(?:\.\d+)+)(?:-[\w]+)?\.dmg$/i)?.[1] || 'unknown';
      return ['mac_installer_download', { file_name: fileName, version, link_url: url.origin + url.pathname }];
    }
    if (url.origin === location.origin && /^\/download\/?$/.test(url.pathname)) {
      return ['download_click_mac', { location: link.closest('[id]')?.id || location.pathname }];
    }
    if (/^(apps|itunes)\.apple\.com$/.test(url.hostname)) {
      const isOwn = ownStoreId && url.pathname.includes(`id${ownStoreId}`) && !/write-review/.test(url.search);
      return isOwn ? ['app_store_click', { link_url: url.origin + url.pathname, transport_type: 'beacon' }] : null;
    }
    if (url.hostname === 'github.com') return ['source_click', { link_url: url.origin + url.pathname }];
    if (/^newsletter\.protomota\.com$/.test(url.hostname)) return ['newsletter_click', { link_url: url.origin + url.pathname }];
    return null;
  }

  document.addEventListener('click', event => {
    const link = event.target instanceof Element && event.target.closest('a[href]');
    if (!link || !accepted || !tagStarted || !window.gtag) return;
    const found = eventFor(link);
    if (found) window.gtag('event', found[0], found[1]);
  });

  // Detailed tracking (2026-11-24), the same events on every Protomota site so the dashboard reads them alike.
  // Only sent for visitors who allowed analytics (send() returns false otherwise, and nothing is remembered).
  //   outbound_click  a link to another site: link_domain, link_url, link_text, link_section
  //   email_click     a mailto link: link_domain (the address's domain only), link_text, link_section
  //   nav_click       an internal link in the site header or footer: link_url, link_text, link_section
  //   cta_click       any other internal link (buttons, cards, in-page jumps): link_url, link_text, link_section
  //   button_click    a button that isn't a link (menus, tabs, copy, FAQ): link_text, link_section
  //   text_copy       text copied from the page (install commands, prompts): link_section, text_length
  //   scroll_depth    how far down each page a visitor got: percent_scrolled 25, 50, 75, 100
  //   section_view    a page section seen (half of it on screen): content_id = section id
  //   video_start, video_progress (video_percent 25/50/75), video_complete: videos with sound, not background loops;
  //                  an embedded YouTube or Vimeo player sends video_start (video_provider) on the first click into it
  // link_section is the section id the click happened in, or header, footer, hero or page. It is also sent as
  // content_id, a dimension GA4 reports without a custom definition. Links that already send their own event
  // (downloads, App Store, source, newsletter) are left to it, so nothing is counted twice.
  function installDetailTracking(send, alreadyTracked) {
    const generic = /^(__next|root|app|main|content|page|top|wrapper|layout|site)$/i;
    const clean = value => (value || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    const textOf = element => clean(element.getAttribute('aria-label') || element.textContent ||
      element.querySelector('img[alt]')?.getAttribute('alt') || element.getAttribute('title'));
    const bareHost = host => host.replace(/^www\./, '');
    function sectionOf(element) {
      const header = element.closest('header, nav, [role="banner"]');
      if (header && !header.closest('main, section, article')) return 'header';
      const footer = element.closest('footer, [role="contentinfo"]');
      if (footer && !footer.closest('main, section, article')) return 'footer';
      const marked = element.closest('[data-track-section]');
      if (marked) return marked.dataset.trackSection;
      const section = element.closest('section[id], article[id]');
      if (section && !generic.test(section.id)) return section.id;
      if (element.closest('[class*="hero"]')) return 'hero';
      for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
        if (node.id && !generic.test(node.id)) return node.id;
      }
      return 'page';
    }

    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest('.analytics-choice, [data-analytics-settings]')) return;
      const section = sectionOf(target);
      const link = target.closest('a[href]');
      if (link) {
        let url;
        try { url = new URL(link.getAttribute('href'), location.href); } catch { return; }
        const base = { link_text: textOf(link), link_section: section, content_id: section };
        if (url.protocol === 'mailto:') {
          send('email_click', { ...base, link_domain: url.pathname.split('@')[1]?.toLowerCase() || '' });
          return;
        }
        if (!/^https?:$/.test(url.protocol) || alreadyTracked(link, url)) return;
        if (bareHost(url.hostname) !== bareHost(location.hostname)) {
          send('outbound_click', { ...base, link_domain: bareHost(url.hostname), link_url: url.origin + url.pathname, transport_type: 'beacon' });
          return;
        }
        const name = section === 'header' || section === 'footer' ? 'nav_click' : 'cta_click';
        send(name, { ...base, link_url: url.origin + url.pathname + (url.pathname === location.pathname ? url.hash : '') });
        return;
      }
      const button = target.closest('button, [role="button"], summary');
      if (button && !button.closest('form')) send('button_click', { link_text: textOf(button), link_section: section, content_id: section });
    }, true);

    document.addEventListener('copy', () => {
      const selection = String(window.getSelection?.() || '');
      const node = window.getSelection?.()?.anchorNode;
      const element = node instanceof Element ? node : node?.parentElement;
      if (!selection.trim() || !element) return;
      const section = sectionOf(element);
      send('text_copy', { link_section: section, content_id: section, text_length: selection.length });
    });

    let page = location.pathname;
    let marks = new Set();
    let seen = new Set();
    function check() {
      if (location.pathname !== page) {
        page = location.pathname;
        marks = new Set();
        seen = new Set();
      }
      const room = document.documentElement.scrollHeight - window.innerHeight;
      if (room > 0) {
        const percent = Math.round((window.scrollY / room) * 100);
        for (const mark of [25, 50, 75, 100]) {
          if (percent >= (mark === 100 ? 98 : mark) && !marks.has(mark) && send('scroll_depth', { percent_scrolled: mark })) marks.add(mark);
        }
      }
      for (const element of document.querySelectorAll('section[id], [data-track-section]')) {
        const id = element.dataset.trackSection || element.id;
        if (!id || seen.has(id)) continue;
        const box = element.getBoundingClientRect();
        const visible = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0);
        if (box.height > 0 && visible >= Math.min(box.height, window.innerHeight) * 0.5 &&
            send('section_view', { content_type: 'section', content_id: id, link_section: id })) seen.add(id);
      }
    }
    let queued = false;
    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; check(); }, 300);
    }, { passive: true });
    // Pages that change without a reload (Next.js, React) and visitors who allow analytics after landing.
    setInterval(() => { if (!document.hidden) check(); }, 2000);

    const videos = new WeakMap();
    const videoTitle = video => clean(video.getAttribute('aria-label') || video.getAttribute('title') ||
      video.dataset.title || (video.currentSrc || video.src || '').split('/').pop()?.split('?')[0] || sectionOf(video));
    const isBackground = video => video.loop || (video.autoplay && video.muted);
    document.addEventListener('play', event => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement) || isBackground(video) || videos.has(video)) return;
      if (send('video_start', { video_title: videoTitle(video), link_section: sectionOf(video), content_id: sectionOf(video) })) videos.set(video, new Set());
    }, true);
    document.addEventListener('timeupdate', event => {
      const video = event.target;
      const done = video instanceof HTMLVideoElement && videos.get(video);
      if (!done || !video.duration) return;
      const percent = (video.currentTime / video.duration) * 100;
      for (const mark of [25, 50, 75]) {
        if (percent >= mark && !done.has(mark) && send('video_progress', { video_title: videoTitle(video), video_percent: mark })) done.add(mark);
      }
    }, true);
    document.addEventListener('ended', event => {
      const video = event.target;
      const done = video instanceof HTMLVideoElement && videos.get(video);
      if (done && !done.has(100) && send('video_complete', { video_title: videoTitle(video), video_percent: 100 })) done.add(100);
    }, true);
    // Embedded YouTube or Vimeo players: a click into the player moves focus to its frame, which the page sees as a blur.
    const frames = new WeakSet();
    window.addEventListener('blur', () => {
      setTimeout(() => {
        const frame = document.activeElement;
        if (!(frame instanceof HTMLIFrameElement) || frames.has(frame) || !/youtube|vimeo/i.test(frame.src)) return;
        const title = clean(frame.getAttribute('title') || frame.src.split('/').pop()?.split('?')[0]);
        if (send('video_start', { video_title: title, video_provider: /vimeo/i.test(frame.src) ? 'vimeo' : 'youtube', link_section: sectionOf(frame), content_id: sectionOf(frame) })) frames.add(frame);
      }, 0);
    });
  }

  installDetailTracking((name, params) => {
    if (!accepted || !tagStarted || !window.gtag) return false;
    window.gtag('event', name, params);
    return true;
  }, link => Boolean(eventFor(link)));

  function init() {
    if (config.css) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = config.css;
      document.head.append(style);
    }
    addSettingsButton();
    const choice = storedChoice();
    if (choice) apply(choice);
    else showBanner(false);
    window.addEventListener('storage', event => {
      if (event.key !== storageKey || (event.newValue !== 'granted' && event.newValue !== 'denied')) return;
      apply(event.newValue);
      hideBanner();
    });
  }

  if (!measurementId || !config.site || !config.host) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
