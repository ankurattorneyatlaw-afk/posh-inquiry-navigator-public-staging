'use strict';
const fs=require('node:fs'),path=require('node:path'),{createDecipheriv}=require('node:crypto');
function productReader({folder=path.join(__dirname,'../products'),key=process.env.NAVIGATOR_PRODUCT_ASSET_KEY}={}){
 return name=>{
  if(!['individual-guides.json','compliance-checklist-template.json'].includes(name)||typeof key!=='string'||!/^[a-f0-9]{64}$/.test(key))throw Error('Product delivery is not configured');
  const data=fs.readFileSync(path.join(folder,name+'.enc'));
  if(data.length<33||data.length>4000000||data.subarray(0,4).toString()!=='NVP1')throw Error('Invalid product package');
  const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),data.subarray(4,16));
  decipher.setAAD(Buffer.from(name));decipher.setAuthTag(data.subarray(16,32));
  return Buffer.concat([decipher.update(data.subarray(32)),decipher.final()]);
 };
}
module.exports={productReader};
