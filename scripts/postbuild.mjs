// Runs after `vite build`. Turns the single-page app's dist/ into something search engines,
// answer engines and AI crawlers can fully read WITHOUT running JavaScript:
//   - fills <title>/description/canonical per page (home + /cosmetic-dentistry)
//   - injects JSON-LD structured data (Dentist, WebSite, FAQPage, BreadcrumbList)
//   - injects a plain-HTML copy of the key content inside #root (React replaces it on load)
//   - writes dist/cosmetic-dentistry/index.html, sitemap.xml and llms.txt
//   - swaps the __SITE_URL__ placeholder for the real domain
// All facts come from src/data/seo.json - edit that file, not this script.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const seo = JSON.parse(fs.readFileSync(path.join(root, 'src/data/seo.json'), 'utf8'));
const b = seo.business;

const SITE = (process.env.SITE_URL || process.env.CF_PAGES_URL || 'http://localhost:4173').replace(/\/+$/, '');
if (!process.env.SITE_URL) {
  console.warn(`\n[seo] SITE_URL is not set - using ${SITE}.\n[seo] Set SITE_URL to your real domain (e.g. https://www.yourclinic.in) in Cloudflare Pages > Settings > Variables, so canonical URLs, sitemap and structured data point at it.\n`);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const today = new Date().toISOString().slice(0, 10);
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const GROUPS = { general: 'General & preventive dentistry', advanced: 'Advanced dentistry & surgery', cosmetic: 'Cosmetic dentistry & orthodontics' };

// ---------- structured data ----------
const clinic = {
  '@context': 'https://schema.org',
  '@type': 'Dentist',
  '@id': `${SITE}/#clinic`,
  name: b.name,
  alternateName: b.shortName,
  url: `${SITE}/`,
  image: `${SITE}/og-image.jpg`,
  description: b.tagline,
  telephone: b.phoneIntl,
  address: {
    '@type': 'PostalAddress',
    streetAddress: b.street,
    addressLocality: b.locality,
    addressRegion: b.region,
    postalCode: b.postalCode,
    addressCountry: b.country,
  },
  hasMap: b.mapsUrl,
  areaServed: [{ '@type': 'City', name: b.locality }, { '@type': 'AdministrativeArea', name: b.region }],
  medicalSpecialty: 'Dentistry',
  openingHoursSpecification: b.hours.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: h.days, opens: h.opens, closes: h.closes })),
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Dental services',
    itemListElement: seo.services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.description } })),
  },
  employee: seo.doctors.map((d) => ({
    '@type': 'Person',
    name: d.name,
    jobTitle: d.jobTitle,
    description: `${d.credentials}. ${d.experience} of experience. ${d.focus}.`,
    worksFor: { '@id': `${SITE}/#clinic` },
  })),
};
const website = { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: b.name, inLanguage: 'en-IN', publisher: { '@id': `${SITE}/#clinic` } };
const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: seo.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};
const crumbs = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: it[1] })),
});
const cosmeticPage = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${SITE}${seo.pages.cosmetic.path}#webpage`,
  url: `${SITE}${seo.pages.cosmetic.path}`,
  name: seo.pages.cosmetic.title,
  description: seo.pages.cosmetic.description,
  isPartOf: { '@id': `${SITE}/#website` },
  about: { '@id': `${SITE}/#clinic` },
  inLanguage: 'en-IN',
};

// ---------- crawler-readable HTML ----------
const HIDE = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%)';
const contact = () => `<section><h2>Contact and location</h2><address>${esc(b.name)}, ${esc(b.street)}, ${esc(b.locality)}, ${esc(b.region)} ${esc(b.postalCode)}, India</address><p>Phone: <a href="tel:${b.phoneIntl}">${esc(b.phoneDisplay)}</a>. Open Monday to Saturday, 9 am to 8 pm. <a href="${esc(b.mapsUrl)}">Open in Google Maps</a></p></section>`;
const doctors = () => `<section><h2>Our dentists</h2>${seo.doctors.map((d) => `<h3>${esc(d.name)}, ${esc(d.jobTitle)}</h3><p>${esc(d.credentials)}. ${esc(d.experience)} of experience. ${esc(d.focus)}.</p>`).join('')}</section>`;
const servicesHtml = (groups) => groups.map((g) => `<h3>${esc(GROUPS[g])}</h3><ul>${seo.services.filter((s) => s.group === g).map((s) => `<li><strong>${esc(s.name)}</strong>: ${esc(s.description)}</li>`).join('')}</ul>`).join('');

const homeStatic = `<div style="${HIDE}"><header><h1>${esc(b.name)}, ${esc(b.locality)}</h1><p>${esc(b.tagline)}.</p></header>${contact()}<section><h2>Dental services in ${esc(b.locality)}</h2>${servicesHtml(['general', 'advanced', 'cosmetic'])}</section>${doctors()}<section><h2>Frequently asked questions</h2>${seo.faqs.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section><p><a href="${seo.pages.cosmetic.path}">Cosmetic dentistry in ${esc(b.locality)}</a></p></div>`;
const cosmeticStatic = `<div style="${HIDE}"><header><h1>Cosmetic dentistry in ${esc(b.locality)}</h1><p>${esc(seo.pages.cosmetic.description)}</p></header><section><h2>Cosmetic treatments</h2>${servicesHtml(['cosmetic'])}</section>${doctors()}${contact()}<p><a href="/">${esc(b.name)} home</a></p></div>`;

// ---------- head helpers ----------
function setHead(html, page) {
  const url = `__SITE_URL__${page.path === '/' ? '/' : page.path}`;
  const attr = (re, value) => { html = html.replace(re, `$1${esc(value)}$2`); };
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`);
  attr(/(<meta name="description" content=")[^"]*(")/, page.description);
  attr(/(<meta property="og:title" content=")[^"]*(")/, page.title);
  attr(/(<meta property="og:description" content=")[^"]*(")/, page.description);
  attr(/(<meta property="og:url" content=")[^"]*(")/, url);
  attr(/(<meta name="twitter:title" content=")[^"]*(")/, page.title);
  attr(/(<meta name="twitter:description" content=")[^"]*(")/, page.description);
  attr(/(<link rel="canonical" href=")[^"]*(")/, url);
  attr(/(<link rel="alternate" hreflang="en-IN" href=")[^"]*(")/, url);
  attr(/(<link rel="alternate" hreflang="x-default" href=")[^"]*(")/, url);
  return html;
}
function fill(html, jsonld, staticHtml) {
  if (!html.includes('<!--SEO_JSONLD-->') || !html.includes('<!--SEO_STATIC-->')) throw new Error('index.html is missing the SEO placeholders');
  return html.replace('<!--SEO_JSONLD-->', jsonld.map(ld).join('\n    ')).replace('<!--SEO_STATIC-->', staticHtml);
}

// ---------- build pages ----------
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const home = fill(setHead(template, seo.pages.home), [clinic, website, faqLd], homeStatic);
const cosmetic = fill(
  setHead(template, seo.pages.cosmetic),
  [clinic, cosmeticPage, crumbs([['Home', '__SITE_URL__/'], ['Cosmetic dentistry', `__SITE_URL__${seo.pages.cosmetic.path}`]])],
  cosmeticStatic,
);
fs.writeFileSync(path.join(dist, 'index.html'), home);
fs.mkdirSync(path.join(dist, 'cosmetic-dentistry'), { recursive: true });
fs.writeFileSync(path.join(dist, 'cosmetic-dentistry', 'index.html'), cosmetic);

// ---------- sitemap + llms.txt ----------
fs.writeFileSync(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>__SITE_URL__/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>__SITE_URL__${seo.pages.cosmetic.path}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
</urlset>
`);

const llms = `# ${b.name}

> ${b.tagline}. Led by ${seo.doctors.map((d) => `${d.name} (${d.jobTitle})`).join(' and ')}.

## Key facts
- Address: ${b.street}, ${b.locality}, ${b.region} ${b.postalCode}, India
- Phone: ${b.phoneDisplay} (${b.phoneIntl})
- Hours: Monday to Saturday, 9 am to 8 pm. Online booking available on the website.
- Map: ${b.mapsUrl}

## Pages
- [Home](__SITE_URL__/): services, dentists, location guide, patient FAQ and online booking
- [Cosmetic dentistry](__SITE_URL__${seo.pages.cosmetic.path}): veneers, laser whitening, clear aligners, smile design and before/after cases

## Services
${Object.keys(GROUPS).map((g) => `### ${GROUPS[g]}\n${seo.services.filter((s) => s.group === g).map((s) => `- ${s.name}: ${s.description}`).join('\n')}`).join('\n\n')}

## Dentists
${seo.doctors.map((d) => `- ${d.name}, ${d.jobTitle}. ${d.credentials}. ${d.experience} of experience. ${d.focus}.`).join('\n')}

## Frequently asked questions
${seo.faqs.map((f) => `**${f.q}**\n${f.a}`).join('\n\n')}
`;
fs.writeFileSync(path.join(dist, 'llms.txt'), llms);

// ---------- replace the placeholder everywhere ----------
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(html|txt|xml)$/.test(e.name)) {
      const t = fs.readFileSync(p, 'utf8');
      if (t.includes('__SITE_URL__')) fs.writeFileSync(p, t.split('__SITE_URL__').join(SITE));
    }
  }
}
walk(dist);
console.log(`[seo] done: ${SITE}/ , ${SITE}${seo.pages.cosmetic.path} , sitemap.xml , llms.txt , robots.txt`);
