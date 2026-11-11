import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../src/layouts/BaseLayout.astro',import.meta.url),'utf8');

function linear(component){
 const s=component/255;
 return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;
}
const lum=hex=>{
 const channels=hex.match(/[0-9a-f]{2}/gi).map(x=>linear(parseInt(x,16)));
 return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
};
const ratio=(a,b)=>{
 const x=lum(a),y=lum(b);
 return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
};

test('F158: secondary CTA on dark section has WCAG AA readable default and hover states',()=>{
 assert.match(css,/\.section-dark \.cta-secondary \{ color: #fff; border-color: #b6d4f3; \}/);
 assert.match(css,/\.section-dark \.cta-secondary:hover \{ color: #102d50; background: #eaf3ff; \}/);
 assert.ok(ratio('ffffff','111e34')>=4.5,'normal light CTA text on dark section');
 assert.ok(ratio('102d50','eaf3ff')>=4.5,'dark CTA text on pale hover background');
 assert.match(css,/:focus-visible \{ outline: 3px solid/,'keyboard focus remains present');
});
