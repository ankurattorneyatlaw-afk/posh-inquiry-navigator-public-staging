const assert=require('node:assert/strict');
async function advanceDocumentSteps(page){
 for(let attempts=0;attempts<16;attempts++){
  const next=page.locator('#g-document-continue');
  if(await next.count()){await next.click();continue;}
  if(!await page.locator('[data-download-gate]').count())return;
  const step=page.locator('.g-inline-step > div[id^="g-context-docs-"]').last(),select=step.locator('[data-document-select]'),first=await select.locator('option').first().getAttribute('value');await select.selectOption(first);await step.locator('[data-document-actor]').fill('Fictional reviewer');const pending=page.waitForEvent('download');await step.locator('[data-document-download]').click();const download=await pending;assert.equal(download.suggestedFilename(),'POSH_'+first+'_Editable_Draft.docx');await next.waitFor();
 }
 throw Error('Document progression did not settle after sixteen steps.');
}
module.exports={advanceDocumentSteps};
