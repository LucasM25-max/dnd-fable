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
      if(['burst','arc','ring','light','column'].indexOf(p.type)<0)fail('parts['+i+'] has unknown type "'+p.type+'"');
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
C.cueNames=CUES;
})();
