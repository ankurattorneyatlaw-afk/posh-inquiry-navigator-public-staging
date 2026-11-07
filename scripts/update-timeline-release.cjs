// Run intentionally when preparing a new signed staging asset set, before build verification.
const fs=require('node:fs'),crypto=require('node:crypto');
const release=JSON.parse(fs.readFileSync('dist/release.json'));
release.version='6.10.0-evidence-annexures-and-report-review';
release.search.origin='https://posh-inquiry-navigator-staging.onrender.com';
release.assets=Object.fromEntries(fs.readdirSync('dist').filter(name=>name!=='release.json').sort().map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync('dist/'+name)).digest('hex')]));
release.products=Object.fromEntries(fs.readdirSync('products').filter(n=>n.endsWith('.enc')).sort().map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('products/'+n)).digest('hex')]));
fs.writeFileSync('dist/release.json',JSON.stringify(release,null,2)+'\n');
