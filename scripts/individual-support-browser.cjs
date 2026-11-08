'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const assert=require('node:assert/strict');

(async()=>{
  process.env.PORT='4260';
  require('./serve.cjs');
  const origin='http://127.0.0.1:4260';
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:1000}});
      const errors=[],writes=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('request',request=>{if(request.method()==='POST')writes.push(new URL(request.url()).pathname);});
      await page.goto(origin+'/individual-support.html');
      await page.getByRole('heading',{name:'Know what to prepare next.',exact:true}).waitFor();
      const paid=page.getByRole('link',{name:'Explore and test this guide',exact:true});
      assert.deepEqual(await paid.evaluateAll(links=>links.map(link=>link.getAttribute('href'))),
        ['/shop.html?product=aggrieved','/shop.html?product=respondent']);
      assert.equal(await page.locator('input,textarea,form').count(),0);
      await page.getByRole('link',{name:'Start the free guide',exact:true}).click();
      const paths=[
        ['I have a workplace concern','Guidance for an aggrieved woman'],
        ['I received a complaint','Guidance for a respondent']
      ];
      for(const [link,heading] of paths){
        await page.getByRole('link',{name:new RegExp(link)}).click();
        await page.getByRole('heading',{name:heading,exact:true}).waitFor();
        const first=page.locator('button[data-answer]').first();
        await first.click();
        assert.equal(await first.getAttribute('aria-pressed'),'true');
        assert.equal(await page.locator('textarea, input[type=text], input[type=file]').count(),0);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.goto(origin+'/#guidance');
      }
      assert.deepEqual(writes,[]);
      assert.deepEqual(errors,[]);
      await page.close();
    }
    console.log('PASS: public individual support, both free guidance entry paths, separate test guide links and no case submissions.');
  }finally{await browser.close();}
})().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
