(function (root) {
  'use strict';
  const encoder = new TextEncoder();
  const enc = value => encoder.encode(value);
    function crc32(bytes){let c=-1;for(let i=0;i<bytes.length;i++){c^=bytes[i];for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xEDB88320:0);}return (c^-1)>>>0;}
  function u16(n){return [n&255,(n>>>8)&255]}function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
  function zip(files){let parts=[],central=[],offset=0;for(const [name,body]of Object.entries(files)){
    const n=enc(name),b=enc(body),crc=crc32(b),flags=0x0800;
    const local=Uint8Array.from([0x50,0x4b,3,4,...u16(20),...u16(flags),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(b.length),...u32(b.length),...u16(n.length),...u16(0)]);
    parts.push(local,n,b);
    const cd=Uint8Array.from([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(flags),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(b.length),...u32(b.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);
    central.push(cd,n);offset+=local.length+n.length+b.length;
  }
  const size=central.reduce((a,x)=>a+x.length,0),count=Object.keys(files).length;
  const end=Uint8Array.from([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(count),...u16(count),...u32(size),...u32(offset),...u16(0)]);
  const all=[...parts,...central,end],len=all.reduce((a,x)=>a+x.length,0);let out=new Uint8Array(len),pos=0;for(const part of all){out.set(part,pos);pos+=part.length;}return out;
  }


  function organisationName(value) {
    if (typeof value !== 'string' || /[\p{Cc}\p{Cf}\p{Cs}\uFFFE\uFFFF]/u.test(value)) {
      throw new Error('Enter the buyer’s organisation name on one line.');
    }
    const name = value.trim().normalize('NFC');
    if (!name || [...name].length > 64) throw new Error('Enter an organisation name of 1–64 characters.');
    return name;
  }

  function generate(parts, organisation, reference) {
    const name = organisationName(organisation);
    if (typeof reference !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/.test(reference)) {
      throw new Error('Use 1–48 letters, digits, dots, hyphens or underscores for the order reference.');
    }
    const safeName = name.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
    const files = {...parts};
    const destinations = Object.keys(files).filter(key => files[key].includes('[Organisation]'));
    if (destinations.length !== 3 || !files['word/settings.xml']?.includes('w:edit="forms"')) {
      throw new Error('The protected checklist template is unavailable.');
    }
    for (const key of destinations) {
      files[key] = files[key].replace(/\[Organisation\]|\[Reference\]/g, match => match === '[Organisation]' ? safeName : reference);
    }
    return zip(files);
  }

  const engine = {generate, organisationName};
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.BuyerChecklist = engine;
})(globalThis);
