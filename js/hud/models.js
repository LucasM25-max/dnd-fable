/* HUD view models (implementation plan, section 13.14). Pure functions from the combat state to the plain data each HUD
   module draws, so what the HUD shows can be tested in Node with no DOM and no Three.js. Nothing here changes the state.

   Fable.hudModels.health(c)            name plate, AC with breakdown, hit point bar numbers, conditions
   Fable.hudModels.ribbon(s)            round and the initiative chips in turn order
   Fable.hudModels.economy(c, preview)  Action, Bonus Action, Reaction and the movement segments
   Fable.hudModels.moveLabel(plan, c)   what the hover to move label says
   Fable.hudModels.portraitSvg(p)       a portrait ({width, rows, palette}) as an SVG string */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var M=Fable.hudModels={};
var FT=5;

function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
M.escape=esc;
/* The two colours that tell the player whether something can be done: blue when it can, red when it cannot. Moving and aiming
   an attack both read from here, so the same colour always means the same thing on the ground. */
M.COLORS={ok:0x4aa3ff,deny:0xe8584c};

/* ---------- portraits ---------- */
M.portraitSvg=function(p){
  if(!p||Fable.statblock&&Fable.statblock.checkPortrait(p))return fallbackPortrait();
  var rects=[];
  p.rows.forEach(function(row,y){
    var x=0;
    while(x<row.length){
      var ch=row.charAt(x);
      if(ch==='.'){x++;continue}
      var x2=x;while(x2<row.length&&row.charAt(x2)===ch)x2++;
      rects.push('<rect x="'+x+'" y="'+y+'" width="'+(x2-x)+'" height="1" fill="'+p.palette[ch]+'"/>');
      x=x2;
    }
  });
  return '<svg viewBox="0 0 '+p.width+' '+p.rows.length+'" shape-rendering="crispEdges" aria-hidden="true" focusable="false">'+rects.join('')+'</svg>';
};
function fallbackPortrait(){
  return '<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><rect x="2" y="1" width="4" height="4" fill="#bba583"/><rect x="1" y="5" width="6" height="3" fill="#6b4a2a"/></svg>';
}

/* ---------- health ---------- */
M.acTip=function(c){
  var t=c.ac&&c.ac.breakdown&&c.ac.breakdown.length?Fable.stats.explain(c.ac):'AC '+c.ac.value;
  var parts=t.split(' = ')[0].split(' + ');
  return 'Armor Class '+c.ac.value+'\n'+parts.join('\n');
};
M.health=function(c){
  var max=Math.max(1,c.hp.max),cur=Math.max(0,Math.min(max,c.hp.current)),temp=c.hp.temp||0;
  /* temporary hit points are drawn over the front of the bar, never past its end */
  var total=Math.max(max,cur+temp);
  return {
    id:c.id,name:c.name,subtitle:c.subtitle||'',ac:c.ac.value,acTip:M.acTip(c),
    cur:cur,max:max,temp:temp,
    pct:Math.round(cur/total*1000)/10,tempPct:Math.round(Math.min(cur+temp,total)/total*1000)/10,
    bloodied:cur>0&&cur*2<=max,down:cur===0,
    segments:Math.min(max,12),
    inspiration:!!c.inspiration,
    conditions:(c.conditions||[]).map(function(x){return {id:x.id,name:x.name}})
  };
};

/* ---------- initiative ---------- */
M.ribbon=function(s){
  var chips=s.order.map(function(id){
    var c=s.byId[id],roll=s.initiativeRolls.filter(function(r){return r.id===id})[0];
    var h=M.health(c);
    return {
      id:id,name:c.name,team:c.team,kind:c.kind,portrait:c.portrait,
      init:roll?roll.total:null,
      active:s.phase==='running'&&s.order[s.turn]===id,
      defeated:!c.alive||c.down,
      /* the hero and allies show a sliver of health; enemies only get the Bloodied tint */
      hpPct:c.team==='player'?h.pct:null,
      bloodied:h.bloodied,
      label:c.name+(roll?', initiative '+roll.total:'')+(c.team==='player'?', ally':', enemy')+(h.bloodied?', bloodied':'')+((!c.alive||c.down)?', defeated':'')
    };
  });
  return {round:s.round,phase:s.phase,chips:chips};
};

/* ---------- action economy ---------- */
/* preview: null, or {costFt, ok} while the pointer is over a destination, so the movement bar can pulse what a move spends. */
M.economy=function(c,preview){
  var e=c.economy,max=e.speedFt*(1+e.dashes),left=Math.max(0,max-e.movedFt);
  var n=Math.ceil(max/FT),segs=[];
  var previewFt=preview&&preview.costFt>0?preview.costFt:0;
  for(var i=0;i<n;i++){
    var from=i*FT,to=from+FT;
    /* segments are used up from the right: what is left stays on the left of the bar */
    var have=Math.max(0,Math.min(FT,left-from));
    var state=have>=FT?'full':have>0?'part':'spent';
    var dash=from>=e.speedFt&&e.dashes>0;
    var pv=false;
    if(previewFt&&state!=='spent'){
      var lo=Math.max(0,left-previewFt);
      pv=to>lo;
    }
    segs.push({state:state,part:state==='part'?Math.round(have/FT*100):null,dash:dash,preview:pv});
  }
  return {
    action:{used:e.action},bonus:{used:e.bonus},reaction:{used:e.reaction},
    movement:{left:left,max:max,dashes:e.dashes,segments:segs,text:left+' / '+max+' ft'}
  };
};

/* ---------- hover to move ---------- */
/* {tone:'ok'|'deny', main:'25', unit:'ft', sub:''}. The wording follows the denied move table in plan section 13.7. */
M.moveLabel=function(plan){
  if(!plan)return null;
  if(plan.ok)return {tone:'ok',main:String(plan.costFt),unit:'ft',sub:plan.afterFt+' ft left'};
  switch(plan.code){
    case 'too-far':return {tone:'deny',main:String(plan.costFt),unit:'ft',sub:(plan.costFt-plan.leftFt)+' ft short'};
    case 'occupied':return {tone:'deny',main:'Occupied',unit:'',sub:''};
    case 'no-path':return {tone:'deny',main:'No path',unit:'',sub:''};
    case 'blocked':return {tone:'deny',main:'Blocked',unit:'',sub:''};
    case 'no-movement':return {tone:'deny',main:'No movement',unit:'',sub:'0 ft left'};
    case 'down':return {tone:'deny',main:'Cannot move',unit:'',sub:''};
    default:return null;
  }
};

/* One line for screen readers when the turn changes. */
M.turnText=function(s,c){
  if(!c)return '';
  return c.team==='player'?'Your turn':c.name+"'s turn";
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
