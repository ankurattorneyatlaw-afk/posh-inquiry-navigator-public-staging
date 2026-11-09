'use strict';

const app = document.getElementById('app');
const home = app.innerHTML;

function navigate() {
  const path = location.hash.slice(1).split('?')[0];
  if (path.startsWith('faq/') || path === 'faq') {
    window.NavigatorFAQ.render(app, path);
    scrollTo(0, 0);
    return;
  }
  if (!app.querySelector('#samples')) app.innerHTML = home;
  document.title = 'POSH Inquiry Navigator | FAQs and Free Resources';
  if (path === 'samples') document.getElementById('samples').scrollIntoView();
  else if (path !== 'main') scrollTo(0, 0);
}

window.addEventListener('hashchange', navigate);
navigate();
