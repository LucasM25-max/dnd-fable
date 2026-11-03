/* The scripted first-launch tutorial. It plays only the first time the game is opened (js/character/flags.js remembers that), and only
   on an encounter that names a tutorial script (`tutorial: 'goblin-ambush'`). Nothing here runs in an ordinary fight.

   A tutorial script (js/content/tutorials/*.js) is data:
     order      who goes first, by creature id: the lesson always starts the same way
     steps      what Elminster says, what is highlighted, what the player may do, and what ends the step
     enemy      what each goblin does on each of its turns, and the dice it rolls
   The rules still decide every result. The script only picks the dice (Fable.combat s.fixed, see attack.js), the order of turn and the
   goblins' moves, and the director only gates what the player may click so each lesson lands the way it was written.

   A step: {id, say, click, focus, hints, beacon, allow, dice, offerReroll, on, until}
     say          Elminster's line ({hero} becomes the hero's name); with click:true he waits for a click on his box
     focus        what gets the pulsing frame: 'slot:<id>' (a hotbar slot), 'end' (End Turn), 'prompt:<choice>' (a button of the open question)
     hints        'flank': the squares beside the first goblin that are out of reach of the second, glowing on the ground
     beacon       'foe1' / 'foe2': a ring under that goblin
     allow        {slots:[ids], move:'hints', attack:{target:'foe1'|'foe2', attack:id}, end:true}: everything else is refused politely
     dice         [{d20, reroll, damage:{sides, faces}}]: the dice of the attacks this step leads to, in order
     offerReroll  true on the one step that teaches Heroic Inspiration; every other hero attack has no reroll offer
     on           {'<event>': {say, focus}}: what changes when that event arrives during the step
     until        the event that ends the step: 'click', 'slot:<id>', 'moved', 'attack', 'action:<id>', 'endturn', 'hero-turn'

   Fable.tutorials.register(script) / .get(id)
   var t = Fable.createTutorial({id, state, hero, foes, hud, marks, grid, announce, leave, finish})
   t.order()  t.begin()  t.event(name, data)  t.allowSlot(id)  t.allowClick(cell, creature, attackId)  t.allowEnd()
   t.attackOpts()  t.rerollChoices(choices)  t.enemyPlan(creature)  t.askLeave()  t.skip()  t.done() */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable,reg={};
Fable.tutorials={
  register:function(s){
    if(!s||typeof s.id!=='string'||!s.id)throw new Error('Tutorial: a script needs an id');
    if(reg[s.id])throw new Error('Tutorial "'+s.id+'" is already registered');
    if(!Array.isArray(s.steps)||!s.steps.length)throw new Error('Tutorial "'+s.id+'": steps must be a list');
    if(!Array.isArray(s.order)||!s.order.length)throw new Error('Tutorial "'+s.id+'": order must list the creatures');
    var ids={};
    s.steps.forEach(function(st,i){
      if(!st.id||ids[st.id])throw new Error('Tutorial "'+s.id+'": step '+i+' needs its own id');
      ids[st.id]=1;
      if(typeof st.until!=='string')throw new Error('Tutorial "'+s.id+'": step "'+st.id+'" needs an until event');
    });
    reg[s.id]=s;return s;
  },
  get:function(id){return reg[id]||null}
};

var SELECT={
  slot:function(id){return '.hotbar .slotb[data-id="'+id+'"]'},
  end:function(){return '.end button'},
  prompt:function(id){return '.prm button[data-choice="'+id+'"]'}
};
function selectorOf(focus){
  if(!focus)return null;
  var i=focus.indexOf(':'),k=i<0?focus:focus.slice(0,i),arg=i<0?'':focus.slice(i+1);
  return SELECT[k]?SELECT[k](arg):null;
}

Fable.createTutorial=function(o){
  var script=Fable.tutorials.get(o.id);
  if(!script)throw new Error('Unknown tutorial "'+o.id+'"');
  var s=o.state,hud=o.hud,Cb=function(){return Fable.combat};
  var idx=-1,step=null,cells=[],turns={},over=false,finished=false,override=null;
  var elm=function(){return hud.mods.elminster},coach=function(){return hud.mods.tutorialCoach};

  function foe(ref){
    var m=/^foe(\d+)$/.exec(ref||'');
    return m?o.foes[+m[1]-1]:null;
  }
  function idOf(ref){var f=foe(ref);return f?f.id:ref}
  function text(t){return String(t||'').replace('{hero}',o.hero.name)}

  /* the squares beside the first goblin that the second cannot reach in one step: stepping there picks one fight, not two */
  function flank(){
    var a=foe('foe1'),b=foe('foe2'),out=[];
    if(!a||!a.cell)return out;
    function near(p,q){return Math.max(Math.abs(p.c-q.c),Math.abs(p.r-q.r))<=1}
    function collect(avoidB){
      var list=[];
      for(var dc=-1;dc<=1;dc++)for(var dr=-1;dr<=1;dr++){
        if(!dc&&!dr)continue;
        var cell={c:a.cell.c+dc,r:a.cell.r+dr};
        if(!Fable.grid.inBounds||Fable.grid.inBounds(o.grid,cell.c,cell.r)){
          if(avoidB&&b&&b.cell&&near(cell,b.cell))continue;
          if(s.creatures.some(function(x){return x.alive&&x.cell&&x.cell.c===cell.c&&x.cell.r===cell.r}))continue;
          var plan=Cb().planMove(s,o.hero,cell);
          if(plan.ok&&!(plan.provokes&&plan.provokes.length))list.push(cell);
        }
      }
      return list;
    }
    out=collect(true);
    if(!out.length)out=collect(false);
    return out.slice(0,6);
  }

  function frameFor(st){return selectorOf((override&&override.focus!==undefined?override.focus:st.focus))}
  function paint(){
    if(!step){coach().focus(null);o.marks.setHints([]);o.marks.setBeacon(null);return}
    var line=override&&override.say!==undefined?override.say:step.say;
    if(line){
      elm().say({text:text(line),click:!!step.click,onClick:step.click?function(){t.event('click')}:null});
    }else elm().hide();
    coach().focus(frameFor(step));
    o.marks.setHints(cells);
    var b=foe(step.beacon);
    if(b&&b.alive&&b.cell){var p=Fable.grid.center(o.grid,b.cell.c,b.cell.r);o.marks.setBeacon({x:p.x,z:p.z})}else o.marks.setBeacon(null);
  }
  function enter(i){
    idx=i;step=script.steps[i]||null;override=null;cells=[];
    if(!step){paint();return}
    if(step.hints==='flank')cells=flank();
    (step.dice||[]).forEach(function(d){s.fixed=s.fixed||[];s.fixed.push(d)});
    paint();
  }
  function keyOf(name,data){return name+(data&&data.id?':'+data.id:'')}

  var t={
    order:function(){return script.order.slice()},
    done:function(){return finished},
    begin:function(){
      elm().onSkip(function(){t.skip()});
      enter(0);
    },
    event:function(name,data){
      if(finished)return;
      if(name==='over'){t.finish(data&&data.win);return}
      if(!step)return;
      var key=keyOf(name,data);
      if(step.on&&step.on[key]){override=Object.assign({},override,step.on[key]);paint()}
      if(step.until===key||step.until===name)enter(idx+1);
    },
    /* ---- what the player may do ---- */
    refuse:function(why){
      elm().nudge();o.announce(why||'Follow Elminster first.');
      return false;
    },
    allowSlot:function(id){
      var ok=!!(step&&step.allow&&step.allow.slots&&step.allow.slots.indexOf(id)>=0);
      return ok||t.refuse();
    },
    allowEnd:function(){
      return !!(step&&step.allow&&step.allow.end)||t.refuse();
    },
    allowClick:function(cell,creature,attackId){
      var a=step&&step.allow;
      if(creature&&creature.team!==o.hero.team){
        var at=a&&a.attack;
        if(at&&idOf(at.target)===creature.id&&(!at.attack||at.attack===attackId))return true;
        return t.refuse(at&&foe(at.target)&&foe(at.target).alive?'Attack the goblin Elminster marked.':null);
      }
      if(a&&a.move==='hints'&&cell&&cells.some(function(q){return q.c===cell.c&&q.r===cell.r}))return true;
      return t.refuse(a&&a.move==='hints'?'Click one of the glowing squares.':null);
    },
    attackOpts:function(){return {noReroll:!(step&&step.offerReroll)}},
    /* the one question the lesson asks: the only answer on offer is the reroll */
    rerollChoices:function(choices){
      return step&&step.offerReroll?choices.filter(function(c){return c.id==='reroll'}):choices;
    },
    /* ---- the goblins ---- */
    enemyPlan:function(c){
      var list=(script.enemy||{})[c.id]||[],n=turns[c.id]=(turns[c.id]===undefined?0:turns[c.id]+1);
      var turn=list[Math.min(n,list.length-1)]||[],intents=[];
      turn.forEach(function(x){
        if(x.t==='move'){
          var to=besideHero(c);
          if(to)intents.push({t:'move',to:to});
        }else if(x.t==='attack'){
          var atk=(c.attacks||[]).filter(function(a){return a.mode==='melee'})[0];
          if(!atk)return;
          if(x.dice){s.fixed=s.fixed||[];s.fixed.push(x.dice)}
          intents.push({t:'attack',attack:atk.id,target:o.hero.id});
        }
      });
      return {intents:intents,tier:'script',trace:null};
    },
    /* ---- leaving ---- */
    askLeave:function(){
      if(hud.promptActive())return;
      hud.prompt({title:'Leave the tutorial?',icon:'step',body:'You can play it again from the start next time.',
        choices:[{id:'stay',label:'Keep going',primary:true,key:'k',keyLabel:'K',codes:['Enter','Escape']},{id:'leave',label:'Leave',key:'l',keyLabel:'L'}],
        onChoose:function(id){if(id==='leave')o.leave()}});
    },
    skip:function(){
      if(hud.promptActive())return;
      hud.prompt({title:'Skip the tutorial?',icon:'step',body:'Elminster will not appear again. You go to the main menu.',
        choices:[{id:'stay',label:'Keep going',primary:true,key:'k',keyLabel:'K',codes:['Enter','Escape']},{id:'skip',label:'Skip tutorial',key:'s',keyLabel:'S'}],
        onChoose:function(id){if(id==='skip'){finished=true;o.finish(true,true)}}});
    },
    finish:function(win){
      if(finished)return;
      finished=true;step=null;paint();
      if(win){elm().say({text:text(script.victory),click:false});o.finish(true,false)}
      else if(script.defeat)elm().say({text:text(script.defeat),click:false});
    }
  };
  /* the square beside the hero that is free and closest to the goblin that is coming, and within one step of it */
  function besideHero(c){
    var h=o.hero,best=null,bd=1e9;
    for(var dc=-1;dc<=1;dc++)for(var dr=-1;dr<=1;dr++){
      if(!dc&&!dr)continue;
      var cell={c:h.cell.c+dc,r:h.cell.r+dr};
      if(Fable.grid.inBounds&&!Fable.grid.inBounds(o.grid,cell.c,cell.r))continue;
      if(s.creatures.some(function(x){return x.alive&&x.cell&&x.cell.c===cell.c&&x.cell.r===cell.r}))continue;
      var plan=Cb().planMove(s,c,cell);
      if(!plan.ok)continue;
      var d=Math.max(Math.abs(cell.c-c.cell.c),Math.abs(cell.r-c.cell.r));
      if(d<bd){bd=d;best=cell}
    }
    return best;
  }
  return t;
};
})(typeof window!=='undefined'?window:globalThis);
