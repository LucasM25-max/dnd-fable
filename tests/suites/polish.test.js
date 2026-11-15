'use strict';
const assert=require('assert'),H=require('../harness'),fs=require('fs'),path=require('path');
const read=f=>fs.readFileSync(path.join(H.ROOT,f),'utf8');
const noComments=s=>s.replace(/\/\*[\s\S]*?\*\//g,'');

/* The polish pass: what was wrong, kept from coming back. These read the sources as text, so they run in plain Node. */
module.exports=function(t){
  const {suite,test}=t;
  suite('polish pass',()=>{
    test('every hotbar slot is sized by the one --slot variable: a media query can no longer shrink the frame and leave the button wide',()=>{
      const css=noComments(read('css/hud-combat.css'));
      assert.ok(/\.abar\{--slot:60px/.test(css),'the default size is a variable on the bar');
      assert.ok(/#hud-layer \.slotb\{[^}]*width:var\(--slot\)/.test(css),'the button follows it');
      assert.ok(/\.slotb \.frame\{[^}]*width:var\(--slot\);height:var\(--slot\)/.test(css),'and so does the frame');
      assert.ok(/\.hslot\{[^}]*width:var\(--slot\)/.test(css),'and the slot');
      /* no rule outside the variable may give these a pixel width again (that is how the button stayed 60px inside a 52px slot) */
      css.split('}').forEach(r=>{
        const sel=(r.split('{')[0]||'').trim();
        if(/^(#hud-layer )?\.(slotb|hslot)( \.frame)?$/.test(sel)||/^\.slotb,\.slotb \.frame/.test(sel))
          assert.ok(!/(^|[;{])\s*width:\d+px/.test(r.split('{')[1]||'')||/--slot/.test(r),'hard width on '+sel);
      });
      ['@media (max-width:1360px)','@media (max-width:980px)','@media (max-width:760px)'].forEach(q=>assert.ok(css.includes(q),q));
      assert.ok(/--slot:52px/.test(css)&&/--slot:44px/.test(css),'the smaller sizes change the variable only');
    });
    test('the slot tags sit inside the frame, so none hangs off its edge',()=>{
      const css=noComments(read('css/hud-combat.css'));
      const rule=sel=>{const m=css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\{([^}]*)\\}'));return m?m[1]:''};
      ['.hslot .hk','.slotb .cm','.slotb .uses','.hslot .mvv'].forEach(sel=>{
        const r=rule(sel);assert.ok(r,sel+' is styled');
        assert.ok(!/(left|right|top|bottom):-\d/.test(r),sel+' has a negative offset: '+r);
      });
    });
    test('the half-health tick is two teeth on the bar edge and never a line through the number',()=>{
      const css=noComments(read('css/hud.css'));
      const m=css.match(/\.hb-notch\{([^}]*)\}/);
      assert.ok(m&&/width:0/.test(m[1])&&!/background/.test(m[1]),'the notch itself draws nothing: '+(m&&m[1]));
      assert.ok(/\.hb-notch::before,\.hb-notch::after\{[^}]*background/.test(css),'the teeth are the pseudo elements');
    });
    test('the hero card shows the name only: the class line is gone from it',()=>{
      const js=read('js/hud/health-bar.js');
      assert.ok(!/subtitle/.test(js)&&!/hb-name i/.test(js));
    });
    test('free actions carry no cost marker, and the others keep their shapes',()=>{
      const js=read('js/hud/action-bar.js');
      const m=js.match(/var COSTSHAPE=\{([\s\S]*?)\};/);
      assert.ok(m);
      ['action','bonus','reaction'].forEach(k=>assert.ok(new RegExp(k+':').test(m[1]),k));
      ['free','object','move'].forEach(k=>assert.ok(!new RegExp('\\b'+k+':').test(m[1]),k+' has no shape'));
    });
    test('the combat log starts folded for a new player, sizes itself to what it holds and always follows the newest line',()=>{
      const S=read('js/hud/settings.js'),css=noComments(read('css/hud-combat.css')),js=read('js/hud/combat-log.js');
      assert.ok(/log:false/.test(S.replace(/\s+/g,'')),'folded by default');
      assert.ok(/\.cl-body\{[^}]*max-height:176px/.test(css)&&!/\.cl-body\{[^}]*[^-]height:176px/.test(css));
      assert.ok(/\.cl-body:empty/.test(css),'an empty log shows no empty panel');
      assert.ok(!/\|\|true/.test(js));
    });
    test('HUD modules give back the settings listener they take when the fight ends',()=>{
      ['js/hud/action-bar.js','js/hud/combat-log.js'].forEach(f=>{
        const js=read(f);
        assert.ok(/var offSettings=Fable\.hudSettings\.onChange/.test(js),f+' keeps the unsubscribe');
        assert.ok(/destroy:function\(\)\{[^}]*offSettings\(\)/.test(js),f+' calls it on destroy');
      });
    });
    test('the main menu has no filler: no placeholder panels, no buttons that only show a toast, no permanent badge',()=>{
      const h=read('index.html'),ui=read('js/menu/menu-ui.js');
      ['Daily contest','Fresh stock','class="ev','class="new"','data-t=','Settings','Quit','XP budget'].forEach(s=>assert.ok(!h.includes(s),'index.html has '+s));
      assert.ok(!/data-t|Quit|XP budget/.test(noComments(ui)),'menu-ui.js');
      assert.ok(!/ep-hint|ep-kick|Click to begin|XP budget/.test(read('js/menu/encounter-preview.js')),'the encounter card');
    });
    test('difficulty reads Easy, Normal, Hard on the menu and on the encounter card (the saved ids stay low, moderate, high)',()=>{
      const h=read('index.html'),ep=read('js/menu/encounter-preview.js');
      [['low','Easy'],['moderate','Normal'],['high','Hard']].forEach(([id,name])=>{
        assert.ok(new RegExp('data-d="'+id+'"[^>]*>'+name+'<').test(h),id+' button says '+name);
        assert.ok(new RegExp(id+":'"+name+"'").test(ep),id+' card says '+name);
      });
    });
    test('the reward line is plain: "75 XP · 83–103 gp", and a single enemy shows no count',async()=>{
      const C=await H.loadData({monsters:true,heroes:true});
      /* load the card module against a stub page: it only needs Fable.rewards.estimate and a document for the full card */
      global.document=global.document||{};
      const src=read('js/menu/encounter-preview.js');
      const sandbox={Fable:{rewards:{estimate:(e,l)=>e.est},content:C&&C.content?C.content:{}},document:{},window:{},console};
      new Function('Fable','document','window',src+';return Fable.encounterPreview;')(sandbox.Fable,sandbox.document,sandbox.window);
      const P=sandbox.Fable.encounterPreview;
      assert.strictEqual(P.rewardLine({est:{xp:75,gold:83,maxGold:103}},[1]),'75 XP  ·  83–103 gp');
      assert.strictEqual(P.rewardLine({est:{xp:50,gold:50,maxGold:50}},[1]),'50 XP  ·  50 gp');
      assert.strictEqual(P.rewardLine({est:{xp:0,gold:0,maxGold:0}},[1]),'');
      assert.strictEqual(P.rewardLine({},[1]),'','a failure to work it out is an empty line, never a thrown error');
      assert.ok(/g\.count>1\?/.test(src),'the count shows only above one');
    });
    test('no map is lit so brightly that its ground burns out (hemisphere plus sun stays within the range checked by eye on every map)',()=>{
      const dir=path.join(H.ROOT,'js/content/maps');
      fs.readdirSync(dir).filter(d=>fs.existsSync(path.join(dir,d,'definition.js'))).forEach(d=>{
        const m=read('js/content/maps/'+d+'/definition.js').match(/light:\{hemi:\[[^\]]*?,([\d.]+)\],sun:\[[^\]]*?,([\d.]+)\]/);
        if(!m)return;
        assert.ok(+m[1]+ +m[2]<=1.9,d+' is lit '+(+m[1]+ +m[2]).toFixed(2));
      });
      ['rolling-plains','scorched-dunes','sunken-coast','frostbound-pass'].forEach(d=>{
        const m=read('js/content/maps/'+d+'/definition.js').match(/light:\{hemi:\[[^\]]*?,([\d.]+)\],sun:\[[^\]]*?,([\d.]+)\]/);
        assert.ok(m&&+m[1]+ +m[2]<=1.6,d+' pale ground needs less light: '+(m&&(+m[1]+ +m[2])));
      });
    });
  });
};
