/* Stat pipeline. Pure: no DOM, no Three.js, no content lookups (implementation plan, section 6.2).

   Every derived number (AC, attack bonus, hit points, a skill bonus) is computed as a list of contributions that is then
   reduced to a value. The reduction keeps the list, so a tooltip can show where the number came from, and the entries of
   the breakdown always add up to the value.

   A contribution is {label, op, value, source?}. The order of operations is fixed:
     base   the starting number. When several bases are offered, the highest one is used and the others are listed in
            "ignored" (so "10 + Dex" and a better alternative formula compete instead of stacking).
     set    replaces the base. If there are several, the last one wins.
     add    added in the order given (a negative value subtracts).
     min    the stat cannot end below this number.
     max    the stat cannot end above this number. Applied after min, so a cap wins over a floor.
   A min or max that actually changes the value appears in the breakdown as an adjustment entry, so the sum still holds. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var S=Fable.stats={};

S.OPS=Object.freeze(['base','set','add','min','max']);

function isNum(n){return typeof n==='number'&&isFinite(n)}
function entry(c,note){
  var e={label:c.label,op:c.op,value:c.value};
  if(c.source!==undefined)e.source=c.source;
  if(note!==undefined)e.note=note;
  return e;
}

/* Reduces a list of contributions. Returns {value, breakdown:[{label, op, value, source?, note?}], ignored:[...]}.
   Throws on a malformed contribution, because that is a bug in the caller, not in the data. */
S.reduce=function(list){
  if(!Array.isArray(list))throw new Error('Stats: reduce needs a list of contributions');
  var bases=[],sets=[],adds=[],mins=[],maxs=[];
  list.forEach(function(c,i){
    if(!c||typeof c.label!=='string'||!c.label)throw new Error('Stats: contribution '+i+' needs a label');
    if(S.OPS.indexOf(c.op)<0)throw new Error('Stats: contribution "'+c.label+'" has an unknown op "'+c.op+'" (known: '+S.OPS.join(', ')+')');
    if(!isNum(c.value))throw new Error('Stats: contribution "'+c.label+'" needs a finite number value, got '+String(c.value));
    ({base:bases,set:sets,add:adds,min:mins,max:maxs})[c.op].push(c);
  });
  var value=0,breakdown=[],ignored=[];
  if(bases.length){
    var best=bases[0];
    bases.forEach(function(b){if(b.value>best.value)best=b});
    bases.forEach(function(b){if(b!==best)ignored.push(entry(b,'a higher base applies'))});
    breakdown.push(entry(best));value=best.value;
  }
  if(sets.length){
    var last=sets[sets.length-1];
    breakdown.forEach(function(b){ignored.push(Object.assign({},b,{note:'replaced by '+last.label}))});
    sets.slice(0,-1).forEach(function(s){ignored.push(entry(s,'a later set applies'))});
    breakdown=[entry(last)];value=last.value;
  }
  adds.forEach(function(a){breakdown.push(entry(a));value+=a.value});
  mins.forEach(function(m){
    if(value<m.value){breakdown.push({label:m.label,op:'min',value:m.value-value,note:'raised to '+m.value});value=m.value}
  });
  maxs.forEach(function(m){
    if(value>m.value){breakdown.push({label:m.label,op:'max',value:m.value-value,note:'capped at '+m.value});value=m.value}
  });
  return {value:value,breakdown:breakdown,ignored:ignored};
};

/* "Chain Mail 16 + Shield 2 + Defense 1 = 19", for tooltips and logs. */
S.explain=function(stat){
  if(!stat||!Array.isArray(stat.breakdown))throw new Error('Stats: explain needs a stat with a breakdown');
  var text=stat.breakdown.map(function(b,i){
    if(i===0)return b.label+' '+b.value;
    return (b.value<0?' - ':' + ')+b.label+' '+Math.abs(b.value);
  }).join('');
  return text+' = '+stat.value;
};

/* Conditions on an effect ("when"). The context says what is true right now:
     wearing  list of armor category ids currently worn (a Shield alone does not make Defense apply, because Defense
              only lists light, medium and heavy). An empty list means no armor.
   Returns true when every listed condition holds. An unknown condition throws, so a typo in content cannot silently
   turn into "always" or "never". */
S.when=function(when,ctx){
  if(when===undefined||when===null)return true;
  ctx=ctx||{};
  var ok=true;
  Object.keys(when).forEach(function(k){
    if(k==='wearing'){
      var worn=ctx.wearing||[];
      if(!when.wearing.some(function(c){return worn.indexOf(c)>=0}))ok=false;
    }else throw new Error('Stats: unknown condition "'+k+'" in a "when" (known: wearing)');
  });
  return ok;
};

/* Collects advantage and disadvantage sources for one roll. Any of each cancels out (the 2024 rule), however many
   sources there are. sources are labels for the tooltip. Returns {state, advantage:[labels], disadvantage:[labels]}. */
S.rollState=function(advantage,disadvantage){
  var a=(advantage||[]).filter(function(x,i,arr){return arr.indexOf(x)===i});
  var d=(disadvantage||[]).filter(function(x,i,arr){return arr.indexOf(x)===i});
  var state='normal';
  if(a.length&&!d.length)state='advantage';
  else if(d.length&&!a.length)state='disadvantage';
  return {state:state,advantage:a,disadvantage:d};
};

/* The signed text of a bonus: 5 -> "+5", -1 -> "-1", 0 -> "+0". */
S.signed=function(n){return (n<0?'-':'+')+Math.abs(n)};

})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
