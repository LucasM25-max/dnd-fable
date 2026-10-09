/* Dice expressions and a reproducible roller. Pure: no DOM, no Three.js.

   Syntax (case-insensitive, spaces allowed around + and -):
     '1d8'  'd20'  '2d6+3'  '1d4-1'  '2d6+1d4+3'  '5'  (a plain number is a flat term)
     '4d6kh3'  keep the highest 3     '2d20kl1'  keep the lowest 1
     '4d6dl1'  drop the lowest 1      '4d6dh1'   drop the highest 1
     '1d10+@class.fighter.level'      @references are resolved from opts.scope (see Fable.formula)

   Every roll takes an explicit random function, for example Fable.rng(seed), and there is no hidden default,
   so a fight can always be reproduced. Dice are rolled left to right, one random number per die, which keeps
   replays stable. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var D=Fable.dice={};

var MAX_COUNT=100,MAX_SIDES=1000,MAX_TERMS=20,MAX_FLAT=1000000,MAX_LEN=200,ENUM_CAP=300000;
D.LIMITS={count:MAX_COUNT,sides:MAX_SIDES,terms:MAX_TERMS,flat:MAX_FLAT,length:MAX_LEN};

function perr(src,msg){return new Error('Dice "'+src+'": '+msg)}

/* ---- parser ---- */

var cache=Object.create(null),cacheSize=0;

function parse(src){
  if(typeof src!=='string')throw new Error('Dice: expression must be a string, got '+typeof src);
  if(cache[src])return cache[src];
  if(src.length>MAX_LEN)throw perr(src.slice(0,30)+'...','expression is longer than '+MAX_LEN+' characters');
  if(src.indexOf('@')>=0)throw perr(src,'contains @references; pass opts.scope to resolve them before parsing');
  var s=src.toLowerCase(),i=0,n=s.length,terms=[];

  function ws(){while(i<n&&/\s/.test(s.charAt(i)))i++}
  function digits(){
    var j=i;
    while(i<n&&s.charAt(i)>='0'&&s.charAt(i)<='9')i++;
    return i>j?parseInt(s.slice(j,i),10):null;
  }
  function signs(){
    var sg=1,any=false;
    ws();
    while(i<n&&(s.charAt(i)==='+'||s.charAt(i)==='-')){
      if(s.charAt(i)==='-')sg=-sg;
      any=true;i++;ws();
    }
    return {sg:sg,any:any};
  }
  function term(sg){
    var c=s.charAt(i),cnt=null;
    if(c>='0'&&c<='9'){
      cnt=digits();
      if(s.charAt(i)!=='d'){
        if(cnt>MAX_FLAT)throw perr(src,'flat number '+cnt+' is larger than '+MAX_FLAT);
        return {type:'flat',sign:sg,value:cnt};
      }
    }else if(c!=='d'){
      throw perr(src,c===''?'expected a number or dice after the operator':'expected a number or dice (like 2d6) at position '+i+', found "'+src.charAt(i)+'"');
    }
    i++; /* the "d" */
    var sides=digits();
    if(sides===null)throw perr(src,'expected the number of sides after "d" at position '+i);
    var count=cnt===null?1:cnt;
    if(count<1||count>MAX_COUNT)throw perr(src,'number of dice must be between 1 and '+MAX_COUNT+', got '+count);
    if(sides<2||sides>MAX_SIDES)throw perr(src,'number of sides must be between 2 and '+MAX_SIDES+', got '+sides);
    var keep=null,m=s.substr(i,2);
    if(m==='kh'||m==='kl'||m==='dh'||m==='dl'){
      i+=2;
      var k=digits();if(k===null)k=1;
      if(m.charAt(0)==='k'){
        if(k<1||k>count)throw perr(src,'"'+m+k+'" needs a number between 1 and '+count+' (the number of dice)');
        keep={mode:m.charAt(1),n:k};
      }else{
        if(k<1||k>=count)throw perr(src,'"'+m+k+'" needs a number between 1 and '+(count-1)+' (it must leave at least one die)');
        /* Dropping the highest keeps the lowest, and the other way round. */
        keep={mode:m.charAt(1)==='h'?'l':'h',n:count-k};
      }
    }
    return {type:'dice',sign:sg,count:count,sides:sides,keep:keep};
  }

  ws();
  if(i>=n)throw perr(src,'the expression is empty');
  terms.push(Object.freeze(term(signs().sg)));
  for(;;){
    ws();
    if(i>=n)break;
    var r=signs();
    if(!r.any)throw perr(src,'unexpected "'+src.charAt(i)+'" at position '+i+' (expected + or -)');
    if(terms.length>=MAX_TERMS)throw perr(src,'more than '+MAX_TERMS+' terms');
    terms.push(Object.freeze(term(r.sg)));
  }
  var ast=Object.freeze({src:src,terms:Object.freeze(terms)});
  if(cacheSize>=500){cache=Object.create(null);cacheSize=0}
  cache[src]=ast;cacheSize++;
  return ast;
}
D.parse=parse;

/* Returns null when the expression is valid, otherwise the error message. Used by content validators.
   @references are replaced by 2 so only the dice syntax is checked here. */
D.validate=function(expr){
  try{
    var s=expr;
    if(typeof s==='number'){
      if(Math.floor(s)!==s||!isFinite(s))return 'Dice: a number must be a whole number, got '+s;
      s=String(s);
    }
    if(typeof s!=='string')return 'Dice: expression must be a string or a whole number, got '+typeof s;
    if(s.indexOf('@')>=0){
      if(!Fable.formula)return 'Dice: Fable.formula is needed to check @references';
      s=Fable.formula.mapRefs(s,function(){return '2'});
    }
    parse(s);
    return null;
  }catch(e){return e.message}
};

/* ---- rolling ---- */

function resolve(expr,opts){
  if(typeof expr==='number'){
    if(Math.floor(expr)!==expr||!isFinite(expr))throw new Error('Dice: a number must be a whole number, got '+expr);
    return String(expr);
  }
  if(typeof expr==='string'&&expr.indexOf('@')>=0){
    if(!opts||!opts.scope)throw perr(expr,'uses @references, but no opts.scope was given');
    if(!Fable.formula)throw perr(expr,'Fable.formula must be loaded to resolve @references');
    return Fable.formula.substitute(expr,opts.scope,{integer:true});
  }
  return expr;
}

function die(rnd,sides){
  var r=rnd();
  if(!(r>=0&&r<1))throw new Error('Dice: the random function returned '+r+', expected a number from 0 up to (not including) 1');
  return Math.floor(r*sides)+1;
}

/* Rolls an expression. Options:
     scope    object for @references
     crit     true doubles the number of dice (flat numbers are not doubled), the 2024 critical hit rule
     minDie   treat any die showing less than this as this value (for example 3 for Great Weapon Fighting)
   Returns {expr, resolved, total, crit, terms:[{type:'dice', sign, count, sides, keep, rolls, kept, subtotal} | {type:'flat', sign, value, subtotal}]}.
   rolls holds the values counted (after minDie), rawRolls what the dice actually showed, kept marks which count towards the total. */
D.roll=function(expr,rnd,opts){
  opts=opts||{};
  if(typeof rnd!=='function')throw new Error('Dice: roll needs a random function such as Fable.rng(seed); there is no default, so results stay reproducible');
  var resolved=resolve(expr,opts),ast=parse(resolved),mult=opts.crit?2:1,minDie=opts.minDie|0,total=0,out=[];
  ast.terms.forEach(function(t){
    if(t.type==='flat'){
      var sub=t.sign*t.value;total+=sub;
      out.push({type:'flat',sign:t.sign,value:t.value,subtotal:sub});
      return;
    }
    var count=t.count*mult,keepN=t.keep?t.keep.n*mult:count,raw=[],rolls=[],kept=[],k;
    for(k=0;k<count;k++){
      var v=die(rnd,t.sides);
      raw.push(v);rolls.push(minDie>v?minDie:v);kept.push(true);
    }
    if(t.keep){
      var idx=rolls.map(function(_,j){return j});
      /* Stable order: ties keep the earlier die. */
      idx.sort(function(a,b){return (t.keep.mode==='h'?rolls[b]-rolls[a]:rolls[a]-rolls[b])||(a-b)});
      kept=rolls.map(function(){return false});
      for(k=0;k<keepN;k++)kept[idx[k]]=true;
    }
    var sum=0;
    rolls.forEach(function(v,j){if(kept[j])sum+=v});
    var subtotal=t.sign*sum;total+=subtotal;
    out.push({type:'dice',sign:t.sign,count:count,sides:t.sides,keep:t.keep?{mode:t.keep.mode,n:keepN}:null,rolls:rolls,rawRolls:raw,kept:kept,subtotal:subtotal});
  });
  return {expr:typeof expr==='number'?String(expr):expr,resolved:resolved,total:total,crit:!!opts.crit,terms:out};
};

/* Minimum, maximum and exact average of an expression, for tooltips and the enemy AI. Same options as roll. */
D.stats=function(expr,opts){
  opts=opts||{};
  var ast=parse(resolve(expr,opts)),mult=opts.crit?2:1,minDie=opts.minDie|0,min=0,max=0,avg=0;
  function face(v){return minDie>v?minDie:v}
  ast.terms.forEach(function(t){
    if(t.type==='flat'){var f=t.sign*t.value;min+=f;max+=f;avg+=f;return}
    var count=t.count*mult,keepN=t.keep?t.keep.n*mult:count,lo=keepN*face(1),hi=keepN*face(t.sides),mean,v;
    if(!t.keep){
      var fs=0;
      for(v=1;v<=t.sides;v++)fs+=face(v);
      mean=count*fs/t.sides;
    }else{
      if(Math.pow(t.sides,count)>ENUM_CAP)throw perr(ast.src,'too many combinations to work out an exact average');
      var vals=[],j;
      for(j=0;j<count;j++)vals.push(1);
      var combos=0,acc=0;
      for(;;){
        var sorted=vals.map(face).sort(function(a,b){return a-b}),sum=0;
        if(t.keep.mode==='h'){for(j=count-keepN;j<count;j++)sum+=sorted[j]}
        else{for(j=0;j<keepN;j++)sum+=sorted[j]}
        acc+=sum;combos++;
        for(j=0;j<count;j++){if(vals[j]<t.sides){vals[j]++;break}vals[j]=1}
        if(j===count)break;
      }
      mean=acc/combos;
    }
    if(t.sign>0){min+=lo;max+=hi;avg+=mean}else{min-=hi;max-=lo;avg-=mean}
  });
  return {min:min,max:max,average:avg};
};

/* ---- d20 rolls ---- */

/* Advantage and disadvantage: any of each cancels out, however many sources there are (a count or an array of sources). */
D.rollState=function(adv,dis){
  var a=Array.isArray(adv)?adv.length:(+adv||0),d=Array.isArray(dis)?dis.length:(+dis||0);
  if(a>0&&d===0)return 'advantage';
  if(d>0&&a===0)return 'disadvantage';
  return 'normal';
};

/* One d20 roll. opts: mode ('normal' | 'advantage' | 'disadvantage'), bonus (whole number).
   Returns {mode, rolls, natural, bonus, total, nat20, nat1}. Whether a natural 20 or 1 matters (attacks yes, checks no)
   and the critical range (Champion crits on 19) are decided by the caller. */
D.d20=function(rnd,opts){
  opts=opts||{};
  if(typeof rnd!=='function')throw new Error('Dice: d20 needs a random function such as Fable.rng(seed)');
  var mode=opts.mode||'normal',bonus=opts.bonus===undefined?0:opts.bonus;
  if(mode!=='normal'&&mode!=='advantage'&&mode!=='disadvantage')throw new Error('Dice: d20 mode must be normal, advantage or disadvantage, got "'+mode+'"');
  if(Math.floor(bonus)!==bonus||!isFinite(bonus))throw new Error('Dice: d20 bonus must be a whole number, got '+bonus);
  var rolls=[die(rnd,20)];
  if(mode!=='normal')rolls.push(die(rnd,20));
  var natural=mode==='advantage'?Math.max(rolls[0],rolls[1]):mode==='disadvantage'?Math.min(rolls[0],rolls[1]):rolls[0];
  return {mode:mode,rolls:rolls,natural:natural,bonus:bonus,total:natural+bonus,nat20:natural===20,nat1:natural===1};
};

/* ---- bound roller ---- */

/* createRoller(seed | string | rnd) binds the functions above to one random stream.
   The stream's state can be saved and restored, so a fight can be saved mid-way or replayed. */
D.createRoller=function(source){
  var rnd;
  if(typeof source==='function')rnd=source;
  else if(typeof source==='number'&&isFinite(source))rnd=Fable.rng(source);
  else if(typeof source==='string')rnd=Fable.rng(Fable.rng.hash(source));
  else throw new Error('Dice: createRoller needs a seed (number or string) or a random function');
  return {
    rnd:rnd,
    roll:function(expr,opts){return D.roll(expr,rnd,opts)},
    d20:function(opts){return D.d20(rnd,opts)},
    getState:function(){
      if(typeof rnd.getState!=='function')throw new Error('Dice: this random function cannot report its state');
      return rnd.getState();
    },
    setState:function(s){
      if(typeof rnd.setState!=='function')throw new Error('Dice: this random function cannot restore a state');
      rnd.setState(s);
    }
  };
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
