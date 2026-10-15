import { useEffect } from 'react';
import seo from '../data/seo.json';

export type Page = 'home' | 'cosmetic' | 'staff-portal';

function upsert(selector: string, create: () => HTMLElement, set: (el: HTMLElement) => void) {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  set(el);
}

const meta = (attr: 'name' | 'property', key: string, content: string) =>
  upsert(
    `meta[${attr}="${key}"]`,
    () => {
      const m = document.createElement('meta');
      m.setAttribute(attr, key);
      return m;
    },
    (el) => el.setAttribute('content', content),
  );

/** Keeps <title>, description, canonical and social tags in sync with the visible page. */
export function useSeo(page: Page) {
  useEffect(() => {
    const isPortal = page === 'staff-portal';
    const cfg = page === 'cosmetic' ? seo.pages.cosmetic : seo.pages.home;
    const title = isPortal ? `Staff Portal | ${seo.business.shortName}` : cfg.title;
    const description = isPortal ? 'Staff access only.' : cfg.description;
    const url = window.location.origin + (page === 'cosmetic' ? cfg.path : '/');

    document.title = title;
    meta('name', 'description', description);
    meta('name', 'robots', isPortal ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    meta('property', 'og:title', title);
    meta('property', 'og:description', description);
    meta('property', 'og:url', url);
    meta('name', 'twitter:title', title);
    meta('name', 'twitter:description', description);
    upsert(
      'link[rel="canonical"]',
      () => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        return l;
      },
      (el) => el.setAttribute('href', url),
    );
  }, [page]);
}
