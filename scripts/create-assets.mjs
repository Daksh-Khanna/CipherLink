// Deterministic, locally drawn brand mark. No remote images or generated art.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
const n = 512;
const shield = [[256,96],[384,144],[367,292],[328,355],[256,408],[184,355],[145,292],[128,144]];
function inside(x,y,p) { let b=false; for(let i=0,j=p.length-1;i<p.length;j=i++) {const a=p[i],c=p[j]; if((a[1]>y)!==(c[1]>y) && x<(c[0]-a[0])*(y-a[1])/(c[1]-a[1])+a[0]) b=!b;} return b; }
const bytes = Buffer.alloc((n*4+1)*n);
for(let y=0;y<n;y++) for(let x=0;x<n;x++) {
  let color=[16,20,21];
  if(inside(x,y,shield)) color=[73,185,155];
  if(inside(x,y,[[256,119],[361,159],[345,285],[312,338],[256,382],[200,338],[167,285],[151,159]])) color=[25,32,33];
  if((x-256)**2+(y-233)**2<27**2 || (x>245&&x<267&&y>=233&&y<303)) color=[73,185,155];
  const offset=y*(n*4+1)+1+x*4; bytes.set([...color,255],offset);
}
function crc32(buf) {let c=0xffffffff;for(const b of buf){c^=b;for(let k=0;k<8;k++) c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data) {const t=Buffer.from(type);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(n,0);header.writeUInt32BE(n,4);header[8]=8;header[9]=6;
mkdirSync('mobile/assets',{recursive:true});
writeFileSync('mobile/assets/icon.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(bytes)),chunk('IEND',Buffer.alloc(0))]));
writeFileSync('mobile/assets/logo.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#101415"/><path d="M256 96 384 144 367 292 328 355 256 408 184 355 145 292 128 144Z" fill="#49B99B"/><path d="M256 119 361 159 345 285 312 338 256 382 200 338 167 285 151 159Z" fill="#192021"/><circle cx="256" cy="233" r="27" fill="#49B99B"/><path d="M245 233h22v70h-22z" fill="#49B99B"/></svg>');
console.log('Created CipherLink icon and vector source.');
