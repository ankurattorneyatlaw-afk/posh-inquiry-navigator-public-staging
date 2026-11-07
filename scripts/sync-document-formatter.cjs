const fs=require('node:fs');
const marker='/* END SHARED PROFESSIONAL FORMATTER */\n',file='dist/docx.js',source=fs.readFileSync(file,'utf8'),base=source.includes(marker)?source.slice(source.indexOf(marker)+marker.length):source;
fs.writeFileSync(file,fs.readFileSync('dist/personal-docx.js','utf8')+'\n'+marker+base);
