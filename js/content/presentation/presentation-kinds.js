/* The kinds of presentation content (implementation plan, section 15). The rules are final when they resolve; these rows only say how
   the result is shown: animation clips, visual effects, sounds, and per creature profiles that choose among them.
   Adding a creature's look and sound is adding rows here, with no engine or planner changes. */
(function(){
var C=Fable.content;
var CUES=['anim','vfx','sfx','camera','hud','wait','impact','bark','time','call','status','screen'];

C.defineKind('animations',{
  label:'Animation',required:['duration','tracks'],
  validate:function(d,fail){
    if(Fable.anim&&Fable.anim.validate)Fable.anim.validate(d).forEach(function(m){fail(m)});
  }
});
C.defineKind('effects',{
  label:'Effect',required:['parts'],
  validate:function(d,fail){
    if(!Array.isArray(d.parts)||!d.parts.length)fail('parts must be a non empty list');
    (d.parts||[]).forEach(function(p,i){
      if(['burst','arc','ring','light','column','decal'].indexOf(p.type)<0)fail('parts['+i+'] has unknown type "'+p.type+'"');
      if(p.count!==undefined&&!(p.count>0&&p.count<=200))fail('parts['+i+'] count must be 1 to 200');
      (p.colors||[]).forEach(function(c){if(typeof c!=='number')fail('parts['+i+'] colors must be numbers (0xRRGGBB)')});
    });
  }
});
C.defineKind('sounds',{
  label:'Sound',required:['layers'],
  validate:function(d,fail){
    if(d.kind==='bed'){
      if(!(d.bpm>30&&d.bpm<220))fail('a bed needs a bpm from 30 to 220');
      if(!Array.isArray(d.chords)||!d.chords.length)fail('a bed needs chords');
      return;
    }
    if(['sfx','voice','music'].indexOf(d.bus||'sfx')<0)fail('bus must be sfx, voice or music');
    if(!Array.isArray(d.layers)||!d.layers.length)fail('layers must be a non empty list');
    d.layers.forEach(function(L,i){
      if(['noise','osc','notes','babble'].indexOf(L.type)<0)fail('layers['+i+'] has unknown type "'+L.type+'"');
    });
  }
});
C.defineKind('presentationProfiles',{
  label:'Presentation profile',required:['clips'],
  refs:[{path:'clips.*',kind:'animations'},{path:'effects.*',kind:'effects'},{path:'sounds.*',kind:'sounds'},
        {path:'attacks.*.clip',kind:'animations'},{path:'attacks.*.swing',kind:'effects'},{path:'attacks.*.impact',kind:'effects'},
        {path:'attacks.*.swingSound',kind:'sounds'},{path:'attacks.*.hitSound',kind:'sounds'},{path:'attacks.*.missSound',kind:'sounds'},
        {path:'attacks.*.trail',kind:'effects'},{path:'voice.*',kind:'sounds'},{path:'stepSound',kind:'sounds'},{path:'stepFx',kind:'effects'},{path:'runStepFx',kind:'effects'}]
});
/* Short lines a creature calls out in a fight, shown in a speech bubble and voiced with a synthesised babble (no words are spoken).
   `profile` is the creature definition id; `lines` maps a situation to a list the director picks from without repeating. */
C.defineKind('barks',{
  label:'Bark set',required:['profile','lines','voices'],
  refs:[{path:'voices.*',kind:'sounds'},{path:'profile',kind:'presentationProfiles'}],
  validate:function(d,fail){
    Object.keys(d.lines).forEach(function(k){
      if(!Array.isArray(d.lines[k])||!d.lines[k].length)fail('lines.'+k+' must be a non empty list');
      d.lines[k].forEach(function(t){if(typeof t!=='string'||t.length>60)fail('lines.'+k+' entries must be short text (60 characters at most)')});
    });
  }
});
/* Victory animations (implementation plan, section 17.5): how the hero celebrates a win once it has risen out of the fight. A row is
   data, so a new one is a row (and, for a new character model, a clip); the player owns some, picks one, and can buy more with gold.
     clips      the clip each creature definition plays (a presentation profile's own victory clip is used for a creature not listed)
     effect     the effect played when the pose starts      sound   the sound played with it
     rise       the older way of describing how the hero moved into the pose, from when it lifted clear of the fight. The hero now charges the camera
                and lands before the pose starts (director.js, the stage), so only rise.bob is still used: how much the hero floats once it has landed
     cost       what it costs in the shop ({gp:40}), or null for one every hero starts with
     default    true on the one used until the player picks another (exactly one)                                                    */
C.defineKind('victoryAnimations',{
  label:'Victory animation',required:['clips','description'],
  refs:[{path:'clips.*',kind:'animations'},{path:'effect',kind:'effects'},{path:'sound',kind:'sounds'}],
  validate:function(d,fail){
    if(typeof d.description!=='string'||!d.description)fail('needs a description');
    if(!d.clips||typeof d.clips!=='object'||Array.isArray(d.clips)||!Object.keys(d.clips).length)fail('clips must map a character id to a clip id');
    if(d.cost!==undefined&&d.cost!==null){var why=Fable.money?Fable.money.checkCost(d.cost):null;if(why)fail('cost: '+why)}
    if(d.default!==undefined&&typeof d.default!=='boolean')fail('default must be true or false');
    if(d.default&&d.cost)fail('the default victory animation must be free');
    if(d.rise!==undefined){
      var r=d.rise;
      if(!r||typeof r!=='object')fail('rise must be an object');
      else{
        ['to','dur','bob'].forEach(function(k){if(r[k]!==undefined&&!(typeof r[k]==='number'&&isFinite(r[k])&&r[k]>=0))fail('rise.'+k+' must be a number of 0 or more')});
        if(r.dur!==undefined&&!(r.dur>0))fail('rise.dur must be above 0');
        if(r.at!==undefined&&!(typeof r.at==='number'&&r.at>=0&&r.at<=1))fail('rise.at must be between 0 and 1');
      }
    }
  },
  crossCheck:function(d,ctx){
    if(d.default&&ctx.list('victoryAnimations').filter(function(v){return v.default}).length!==1)ctx.fail('exactly one victory animation must be the default');
  }
});
C.cueNames=CUES;
})();
