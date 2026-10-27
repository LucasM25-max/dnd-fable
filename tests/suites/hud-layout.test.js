'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');

/* Layout guards for the HUD stylesheets. They read the CSS as text, so they run in plain Node.

   The bug these guard against: the centred prompt (Victory, Defeat, the Heroic Inspiration question) was placed with
   `left:50%; top:44%; transform:translate(-50%,-50%)` and also ran an entrance animation whose last keyframe was
   `transform:none`. With `animation-fill-mode:both` the animation's end state replaces the element's own transform, so the
   translate was lost and the plate's top left corner sat at the middle of the screen: the Victory screen appeared at the
   bottom right. The same happened under the in-app "Reduced" motion setting, which only shortens the animation. */

const CSS_DIR=path.join(__dirname,'..','..','css');
const files=fs.readdirSync(CSS_DIR).filter(f=>f.endsWith('.css'));
function read(f){return fs.readFileSync(path.join(CSS_DIR,f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'')}

/* name -> {transform:bool, last:string}: which keyframes set a transform, and what the final frame says */
function keyframes(css){
  const out={};
  const re=/@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while((m=re.exec(css))){
    let depth=1,i=re.lastIndex;
    while(i<css.length&&depth>0){if(css[i]==='{')depth++;else if(css[i]==='}')depth--;i++}
    const body=css.slice(re.lastIndex,i-1);
    const frames=[];
    const fr=/([^{}]+)\{([^}]*)\}/g;let f;
    while((f=fr.exec(body)))frames.push({sel:f[1].trim(),decl:f[2]});
    const last=frames.filter(x=>/(^|,)\s*(100%|to)\s*(,|$)/.test(x.sel)).map(x=>x.decl).join(';');
    out[m[1]]={transform:frames.some(x=>/(^|;|\s)transform\s*:/.test(x.decl)),last};
  }
  return out;
}
/* rule blocks outside @keyframes and @media (the media blocks are walked by flattening them) */
function rules(css){
  const flat=css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g,'');
  const out=[];
  const re=/([^{}@]+)\{([^{}]*)\}/g;let m;
  while((m=re.exec(flat)))out.push({sel:m[1].trim().replace(/\s+/g,' '),decl:m[2]});
  return out;
}
function prop(decl,name){
  const m=new RegExp('(?:^|;|\\s)'+name+'\\s*:\\s*([^;]+)').exec(decl);
  return m?m[1].trim():null;
}

module.exports=function(t){
  const {suite,test}=t;
  suite('hud layout',()=>{
    test('no HUD rule has its own transform and an animation that also sets transform without keeping it',()=>{
      const problems=[];
      files.forEach(f=>{
        const css=read(f),kf=keyframes(css);
        rules(css).forEach(r=>{
          const base=prop(r.decl,'transform');
          const anim=prop(r.decl,'animation')||prop(r.decl,'animation-name');
          if(!base||!anim)return;
          anim.split(',').forEach(a=>{
            const name=(a.match(/[a-zA-Z][\w-]*/g)||[]).find(n=>kf[n]);
            if(!name||!kf[name].transform)return;
            /* allowed only when the animation's final frame carries the same scale variable the base transform uses */
            const keeps=/var\(--hud-scale\)/.test(base)&&/var\(--hud-scale\)/.test(kf[name].last);
            if(!keeps)problems.push(f+': "'+r.sel+'" has transform:'+base+' and animation '+name+', whose keyframes replace it');
          });
        });
      });
      assert.deepStrictEqual(problems,[]);
    });
    test('the prompt is centred by layout (a full screen flex box), not by a translate',()=>{
      const css=read('hud-combat.css'),prm=rules(css).filter(r=>r.sel==='.prm');
      assert.strictEqual(prm.length,1,'one .prm rule');
      const d=prm[0].decl;
      assert.ok(!/translate/.test(d),'.prm must not use translate');
      assert.ok(!prop(d,'transform'),'.prm must not be transformed');
      assert.strictEqual(prop(d,'display'),'flex');
      assert.strictEqual(prop(d,'align-items'),'center');
      assert.strictEqual(prop(d,'justify-content'),'center');
      assert.strictEqual(prop(d,'inset'),'0');
    });
    test('the plate inside the prompt animates with a keyframe that keeps the HUD scale at its end',()=>{
      const css=read('hud-combat.css'),kf=keyframes(css);
      const plate=rules(css).filter(r=>r.sel==='.prm>.plate');
      assert.strictEqual(plate.length,1);
      const anim=prop(plate[0].decl,'animation');
      assert.ok(/hud-prompt-in/.test(anim),'uses hud-prompt-in');
      assert.ok(kf['hud-prompt-in']&&/scale\(var\(--hud-scale\)\)/.test(kf['hud-prompt-in'].last),'ends at the HUD scale');
      assert.ok(/scale\(var\(--hud-scale\)\)/.test(prop(plate[0].decl,'transform')),'the resting transform is the HUD scale');
    });
    test('the reduced motion rule switches off the animated plate, not only the host',()=>{
      const css=read('hud-combat.css');
      assert.ok(/prefers-reduced-motion:reduce\)\s*\{[^}]*\.prm>\.plate/.test(css));
    });
    test('the end of a fight takes the whole HUD off the screen, leaving only the result menu and the screen effects',()=>{
      const css=read('presentation.css'),r=rules(css).filter(x=>/#hud-layer\.outcome/.test(x.sel));
      assert.ok(r.length>=1);
      const main=r.find(x=>/:not\(\.prm\)/.test(x.sel)&&/:not\(\.pfx\)/.test(x.sel));
      assert.ok(main,'one rule hides everything but .prm and .pfx');
      assert.ok(!/:not\(\.wl\)|:not\(\.ovl\)|:not\(\.hud-vignette\)/.test(main.sel),'nameplates, panels and the vignette go too');
      assert.strictEqual(prop(main.decl,'opacity'),'0','gone, not dimmed');
      assert.strictEqual(prop(main.decl,'visibility'),'hidden');
      assert.ok(/visibility 0s linear/.test(prop(main.decl,'transition')),'hidden once the quick fade has finished');
    });
    test('the result menu sits to the side, and returns to the middle on a phone',()=>{
      const css=read('hud-combat.css'),big=rules(css).filter(x=>x.sel==='.prm.big');
      assert.ok(big.length>=2);
      assert.strictEqual(prop(big[0].decl,'justify-content'),'flex-end');
      assert.strictEqual(prop(big[big.length-1].decl,'justify-content'),'center');
    });
    test('the target card never takes the pointer',()=>{
      const css=read('hud-combat.css');
      assert.ok(rules(css).some(x=>/^\.tgt,\s*\.tgt \*$/.test(x.sel)&&/pointer-events:none!important/.test(x.decl.replace(/\s/g,''))));
    });
    test('every transform-centred HUD element (left:50% with translate) has no transform animation',()=>{
      const problems=[];
      files.forEach(f=>{
        const css=read(f),kf=keyframes(css);
        rules(css).forEach(r=>{
          if(!/translate(X)?\(-50%/.test(r.decl)||prop(r.decl,'left')!=='50%')return;
          const anim=prop(r.decl,'animation');
          if(!anim)return;
          const name=(anim.match(/[a-zA-Z][\w-]*/g)||[]).find(n=>kf[n]);
          if(name&&kf[name].transform)problems.push(f+': '+r.sel);
        });
      });
      assert.deepStrictEqual(problems,[]);
    });
  });
};
