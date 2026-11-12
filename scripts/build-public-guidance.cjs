'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { PROTECTED } = require('./account-access.cjs');
const { products } = require('../dist/products.js');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public-guidance-build');
const origin = 'https://navigator.thecosmicenergizers.com';
const source = name => fs.readFileSync(path.join(root, 'dist', name), 'utf8');
const save = (name, data) => fs.writeFileSync(path.join(output, name), data);
const email = 'mailto:training@thecosmicenergizers.com';
const walkthrough = email + '?subject=Navigator%20Committee%20walkthrough';
const pages = ['index', 'about', 'contact', 'digital-delivery', 'help', 'individual-support', 'institutions',
  'preview', 'pricing', 'privacy', 'product-terms', 'purchase-terms', 'refund-policy', 'resources', 'products-services'];
const assets = ['styles.css', 'digital.css', 'library.js', 'faq.js', 'cases.js', 'legal.js', 'finder.js',
  'engine.js', 'docx.js', 'guidance-context.js', 'checklist-sample.pdf', 'essential-sample-invoice.pdf', 'social-preview.png'];
const { records } = require('../dist/finder.js');
assert.equal(records.length, 488);
assert.equal(fs.readFileSync(path.join(root, 'dist/checklist-sample.pdf')).subarray(0, 4).toString(), '%PDF');
assert([...assets, ...pages.map(name => name + '.html')].every(name => !PROTECTED.has(name)));

const copyEdits = new Map([
  ['Navigator staging · Free guidance and FAQs · Inquiry access for approved accounts', 'Public release · Free guidance, FAQs and samples · Sign-in and checkout closed'],
  ['STAGING · Free guidance and product enquiries · No complaint filing, case uploads or paid workspace.', 'Public release · Free guidance and product enquiries · Sign-in and checkout closed'],
  ['Test checkout is open at ₹0; real payments remain disabled.', 'Online checkout is currently closed.'],
  ['Both checklists are available for test checkout. Real payments are disabled.', 'Explore both checklists and view the free Inquiry Checklist sample. Online checkout is currently closed.'],
  ['Test checkout only', 'Online checkout closed'],
  ['Test checkout and test delivery are available; no payment or real purchase is created.', 'Explore the product details and free samples. Online checkout is closed.'],
  ['Staging checkout only.', 'Online checkout closed.'],
  ['On staging, you’ll sign in, complete a test checkout, and open your plan. No money is charged.', 'Contact the team to discuss availability, access and fees.'],
  ['DIGITAL PRODUCTS · TEST CHECKOUT OPEN · REAL PAYMENTS DISABLED', 'DIGITAL PRODUCTS · ONLINE CHECKOUT CLOSED'],
  ['Test checkout charges ₹0 and grants 90 days of test access, not a binding purchase.', 'Online checkout is currently closed. Contact the team for availability.'],
  ['View products and test delivery', 'View the product details'],
  ['Explore and test this guide', 'Explore this guide'],
  ['Preview test checkout', 'Ask about availability'],
  ['Compare staging features', 'Compare plan features'],
  ['Compare the tools available in staging.', 'Compare the tools shown in the plan previews.'],
  ['The comparison above shows the staging tools.', 'The comparison above describes the planned access scope.'],
  ['Staging is for testing with fictional information. Live purchases are closed. The ₹999 Word checklist is a separate download for checking the broad steps.', 'Online purchases are closed. The separate ₹999 Online Inquiry Checklist has a free PDF sample.'],
  ['Sign in when your access is approved.', 'Sign-in is currently closed.'],
  ['Use your approved email to sign in. Your active access determines which tools you can open.', 'Sign-in is currently closed. Contact the team for access updates.'],
  ['Sign in to your authorised workspace.', 'When account access opens, use your authorised workspace.'],
  ['Ready to test', 'Product preview'],
  ['Choose Essential', 'Ask about Essential'],
  ['Choose Professional', 'Ask about Professional'],
  ['Choose Advanced', 'Ask about Advanced'],
  ['Staging policy preview. Live online purchases are closed.', 'Public website privacy notice. Sign-in and online checkout are closed.'],
  ['Staging shows catalogue prices and accepts test payments only.', 'Catalogue prices are for reference. Online checkout is closed.'],
  ['Help with sign-in and recovery', 'Help and recovery guidance'],
]);

function publicCopy(content, { preservePlanCheckout = false } = {}) {
  for (const [before, after] of copyEdits) content = content.replaceAll(before, after);
  return content
    .replaceAll('https://posh-inquiry-navigator-staging.onrender.com', origin)
    .replace(/<a\b[^>]*href="\/(?:account|workspace|admin)(?:\.html)?(?:[?#][^"]*)?"[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/\/checkout\.html\?plan=([a-z-]+)/g, (link, plan) => preservePlanCheckout ? link : '/#enquire?plan=' + plan)
    .replace(/href="\/guided(?:#[^"]*)?"/g, 'href="/preview"')
    .replaceAll('#community/suggest-faq', email + '?subject=Suggest%20a%20POSH%20FAQ')
    .replace(/href="(styles\.css)"|src="([a-z-]+\.js)"/g, (_, css, script) =>
      css ? 'href="/' + css + '"' : 'src="/' + script + '"');
}

function publicHtml(name) {
  let html = publicCopy(source(name + '.html'), { preservePlanCheckout: name === 'products-services' })
    .replace(/<a href="\/pricing\.html"(?: aria-current="page")?>Plans<\/a>/g, '<a href="/products-services.html">POSH Solutions</a>')
    .replace(/<script src="\/analytics\.js"[^>]*><\/script>/g, '')
    .replace(/<form\b[^>]*id="home-walkthrough-form"[^>]*>[\s\S]*?<\/form>/g,
      '<p>Email the team to arrange a walkthrough. Share your organisation and preferred times.</p>');
  if (name === 'privacy') html = html
    .replace('<h2>Information we process</h2>', '<h2>Information we process</h2><p>This public website has no account, checkout, reminder, community submission or optional analytics service. The descriptions below of those features apply when they are available in a separate environment.</p>')
    .replace(/<section class="panel"><h2>Staging checkout reminders<\/h2>[\s\S]*?<\/section>/, '');
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  if (json) html = html.replace(/'sha256-[^']+'/g, "'sha256-" + createHash('sha256').update(json).digest('base64') + "'");
  if (name === 'index') html = html.replace(/src="\/?(finder|legal|library)\.js"/g, (_, asset) => {
    const version = createHash('sha256').update(source(asset + '.js')).digest('hex').slice(0, 12);
    return 'src="/' + asset + '.js?v=' + version + '"';
  });
  return html.replace(/<meta name="robots" content="noindex,nofollow,noarchive"\s*\/>/g, '');
}

const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function productPage() {
  const catalogue = products.map(product => `<section class="panel" id="${esc(product.id)}">
    <h2>${esc(product.name)}</h2><p>${esc(product.scope)}</p>
    <p><strong>${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.amount / 100)}</strong> listed price</p>
    <h3>What it includes</h3><ul>${product.includes.map(item => '<li>' + esc(item) + '</li>').join('')}</ul>
    ${product.sample ? '<p><a href="' + esc(product.sample) + '">Open the free PDF sample</a></p>' : ''}
  </section>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Product previews | POSH Inquiry Navigator</title><link rel="stylesheet" href="/digital.css"><script defer src="/product-preview-public.js"></script></head>
    <body><a class="skip" href="#main">Skip to content</a><header class="digital-header"><a class="wordmark" href="/">POSH <span>Inquiry Navigator</span></a>
    <nav aria-label="Site navigation"><a href="/#faq">FAQs</a><a href="/resources.html">Resources</a><a href="/contact.html">Contact</a></nav></header>
    <main id="main" class="digital-main"><h1>Product previews</h1><p>Explore the products below. Sign-in and online checkout are currently closed.</p>
    ${catalogue}<p><a href="/contact.html">Contact the team about availability</a></p></main></body></html>`;
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output);
for (const name of assets) fs.copyFileSync(path.join(root, 'dist', name), path.join(output, name));
for (const name of pages) save(name + '.html', publicHtml(name));
for (const name of ['preview', 'institutions']) {
  fs.mkdirSync(path.join(output, name));
  save(name + '/index.html', publicHtml(name));
}
save('shop.html', productPage());
save('product-preview-public.js', "const product = new URLSearchParams(location.search).get('product'); if (product) document.getElementById(product)?.scrollIntoView();\n");
save('finder.js', publicCopy(source('finder.js')));
save('plans.js', publicCopy(source('plans.js')).replace("} test access", "} features"));
const main = publicCopy(source('main.js'))
  .replace(/function bindHomeWalkthrough\(\)\{[\s\S]*?(?=function home\(\))/, `function bindHomeWalkthrough(){
    const button=document.getElementById('home-walkthrough-copy');
    if(!button||!navigator.clipboard)return;
    button.hidden=false;
    button.onclick=async()=>{
      const status=document.getElementById('home-walkthrough-copy-status');
      try{await navigator.clipboard.writeText(document.getElementById('home-walkthrough-email').textContent);status.textContent='Email address copied.';}
      catch{status.textContent='Copy the email address above into your email app.';}
    };
  }\n`)
  .replace(/<form\b[^>]*id="home-walkthrough-form"[^>]*>[\s\S]*?<\/form>/g,
    '<p>Email the team to arrange a walkthrough. Share your organisation and preferred times.</p>')
  .replace(/function enquiryPage\(\)\{[\s\S]*?(?=document\.addEventListener\('click',event=>\{const tab=)/, `function enquiryPage(){
    app.innerHTML=header('Request a Committee walkthrough','Contact the team to discuss your organisation’s needs and arrange a time.','REQUEST A WALKTHROUGH')
      + '<div class="app-bg"><section class="wrap workspace"><h2>Contact the team</h2><p>Include your organisation, role and preferred times. Keep confidential case details out of your message.</p><a class="btn btn-dark" href="${walkthrough}">Email the team</a></section></div>';
  }\n`)
  .replace("if(path==='integrity')", "if(path==='samples'){location.replace('/resources.html#inquiry-checklist');return;}if(path==='integrity')")
  .replace("if(cta){cta.href='/account';cta.textContent='Sign in';}", "if(cta){cta.href='/contact.html';cta.textContent='Contact';}");
assert(!main.includes("fetch('/api/enquiries"));
save('main.js', main);
save('community.js', `window.NavigatorCommunity = { render(app) {
  app.innerHTML = '<section class="app-heading"><div class="wrap"><div><a class="app-back" href="#home">← Home</a><h1>Community</h1><p>Public submissions are currently closed.</p><p><a href="#faq">Browse the FAQs</a> or <a href="${email}?subject=Suggest%20a%20POSH%20FAQ">email a general FAQ suggestion</a>.</p></div></div></section>';
} };\n`);
save('robots.txt', 'User-agent: *\nAllow: /\nSitemap: ' + origin + '/sitemap.xml\n');
const urls = ['/', '/institutions/', '/preview/', '/resources.html', '/products-services.html', '/pricing.html', '/about.html', '/contact.html'];
save('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
  urls.map(url => '<url><loc>' + origin + url + '</loc></url>').join('') + '</urlset>\n');

