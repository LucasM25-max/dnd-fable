/* Formula evaluator for data-driven rules. Pure: no DOM, no Three.js, no eval().

   Formulas are small arithmetic expressions that can read values from a scope object with @references:
     '10 + @abilities.dex.mod'            numbers, + - * /, parentheses, unary minus
     'floor(@level / 2)'                  functions: floor, ceil, round, abs, min, max
     '@class["blood-hunter"].level'       bracket form for keys that are not plain words (ids with hyphens)

   References are strict: an unknown path throws with the path in the message, so a typo in content fails loudly.
   Dice are not part of formulas. A dice expression such as '1d10+@class.fighter.level' is resolved with
   Fable.formula.substitute (the @references become numbers) and then rolled by Fable.dice.
   A reference that is followed directly by "d6" would swallow the d, so write @["sneak-dice"]d6 in that case. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;
var F=Fable.formula={};
var hasOwn=Object.prototype.hasOwnProperty;
var SEG=/[A-Za-z0-9_]/;
var MAX_CACHE=1000;

function err(msg,src){return new Error('Formula'+(src!==undefined?' "'+src+'"':'')+': '+msg)}

/* ---- references ---- */

function readBracket(s,j){ /* s[j] is "[" */
  var q=s.charAt(j+1);
  if(q!=='"'&&q!=="'")return null;
  var e=s.indexOf(q,j+2);
  if(e<0||s.charAt(e+1)!==']')return null;
  var v=s.slice(j+2,e);
  return v?{v:v,end:e+2}:null;
}
function readWord(s,j){
  var k=j;
  while(k<s.length&&SEG.test(s.charAt(k)))k++;
  return k>j?{v:s.slice(j,k),end:k}:null;
}
/* Scans one @reference starting at s[i]==='@'. Returns {path,end,text} or null when malformed. */
function scanRef(s,i){
  var first=readWord(s,i+1)||(s.charAt(i+1)==='['?readBracket(s,i+1):null);
  if(!first)return null;
  var path=[first.v],j=first.end;
  for(;;){
    var c=s.charAt(j),seg=null;
    if(c==='.')seg=readWord(s,j+1);
    else if(c==='[')seg=readBracket(s,j);
    if(!seg)break;
    path.push(seg.v);j=seg.end;
  }
  return {path:path,end:j,text:s.slice(i,j)};
}
function formatRef(path){
  return '@'+path.map(function(p,i){
    if(/^[A-Za-z0-9_]+$/.test(p))return (i?'.':'')+p;
    return '["'+p+'"]';
  }).join('');
}
F.formatRef=formatRef;

function lookup(scope,path,src){
  var cur=scope;
  for(var i=0;i<path.length;i++){
    if(cur===null||(typeof cur!=='object'&&typeof cur!=='function')||!hasOwn.call(cur,path[i]))
      throw err('unknown reference '+formatRef(path)+' (nothing at "'+path.slice(0,i+1).join('.')+'")',src);
    cur=cur[path[i]];
  }
  if(typeof cur==='boolean')return cur?1:0;
  if(typeof cur!=='number'||!isFinite(cur))throw err(formatRef(path)+' is not a finite number',src);
  return cur;
}

/* Replaces every @reference in str with fn({text,path}). */
F.mapRefs=function(str,fn){
  if(typeof str!=='string')throw err('expected a string, got '+typeof str);
  var out='',last=0,i;
  while((i=str.indexOf('@',last))>=0){
    var r=scanRef(str,i);
    if(!r)throw err('malformed reference at position '+i,str);
    out+=str.slice(last,i)+fn({text:r.text,path:r.path});
    last=r.end;
  }
  return out+str.slice(last);
};

/* Lists the references used by a string (formula or dice expression): [{text, path}]. */
F.refs=function(str){
  var found=[];
  F.mapRefs(str,function(r){found.push(r);return ''});
  return found;
};

/* Replaces @references with their numeric values. opts.integer demands whole numbers (used for dice). */
F.substitute=function(str,scope,opts){
  var integer=!!(opts&&opts.integer);
  return F.mapRefs(str,function(r){
    if(scope===null||typeof scope!=='object')throw err('a scope object is required to resolve '+r.text,str);
    var v=lookup(scope,r.path,str);
    if(integer&&Math.floor(v)!==v)throw err(r.text+' is '+v+', but a whole number is needed here',str);
    return String(v);
  });
};

/* ---- tokenizer and parser ---- */

function tokenize(src){
  var toks=[],i=0,n=src.length,c,j;
  while(i<n){
    c=src.charAt(i);
    if(c===' '||c==='\t'||c==='\n'||c==='\r'){i++;continue}
    if(c==='@'){
      var r=scanRef(src,i);
      if(!r)throw err('malformed reference at position '+i,src);
      toks.push({k:'ref',path:r.path,text:r.text});i=r.end;continue;
    }
    if((c>='0'&&c<='9')||(c==='.'&&src.charAt(i+1)>='0'&&src.charAt(i+1)<='9')){
      j=i;
      while(j<n&&src.charAt(j)>='0'&&src.charAt(j)<='9')j++;
      if(src.charAt(j)==='.'){j++;while(j<n&&src.charAt(j)>='0'&&src.charAt(j)<='9')j++}
      var nc=src.charAt(j);
      if(/[A-Za-z_]/.test(nc))throw err('unexpected "'+src.slice(i,j+1)+'" at position '+i+' (dice expressions are rolled with Fable.dice, not evaluated as formulas)',src);
      toks.push({k:'num',v:parseFloat(src.slice(i,j)),text:src.slice(i,j)});i=j;continue;
    }
    if(/[A-Za-z_]/.test(c)){
      j=i;
      while(j<n&&/[A-Za-z0-9_]/.test(src.charAt(j)))j++;
      toks.push({k:'name',v:src.slice(i,j),text:src.slice(i,j)});i=j;continue;
    }
    if('+-*/(),'.indexOf(c)>=0){toks.push({k:'op',v:c,text:c});i++;continue}
    throw err('unexpected character "'+c+'" at position '+i,src);
  }
  return toks;
}

var FUNCS={
  floor:{fn:Math.floor,min:1,max:1},
  ceil:{fn:Math.ceil,min:1,max:1},
  round:{fn:Math.round,min:1,max:1},
  abs:{fn:Math.abs,min:1,max:1},
  min:{fn:Math.min,min:1,max:Infinity},
  max:{fn:Math.max,min:1,max:Infinity}
};

function parse(src){
  var toks=tokenize(src),p=0;
  function fail(msg){throw err(msg,src)}
  function isOp(o){var t=toks[p];return !!t&&t.k==='op'&&t.v===o}
  function add(){
    var a=mul();
    while(isOp('+')||isOp('-')){var op=toks[p++].v;a={t:'bin',op:op,a:a,b:mul()}}
    return a;
  }
  function mul(){
    var a=unary();
    while(isOp('*')||isOp('/')){var op=toks[p++].v;a={t:'bin',op:op,a:a,b:unary()}}
    return a;
  }
  function unary(){
    if(isOp('-')){p++;return {t:'neg',a:unary()}}
    if(isOp('+')){p++;return unary()}
    return primary();
  }
  function primary(){
    var t=toks[p++];
    if(!t)fail('unexpected end of expression');
    if(t.k==='num')return {t:'num',v:t.v};
    if(t.k==='ref')return {t:'ref',path:t.path};
    if(t.k==='name'){
      var f=hasOwn.call(FUNCS,t.v)?FUNCS[t.v]:null;
      if(!f)fail('unknown function "'+t.v+'" (available: '+Object.keys(FUNCS).join(', ')+')');
      if(!isOp('('))fail('expected "(" after "'+t.v+'"');
      p++;
      var args=[];
      if(!isOp(')')){
        for(;;){args.push(add());if(isOp(',')){p++;continue}break}
      }
      if(!isOp(')'))fail('expected ")" to close '+t.v+'(');
      p++;
      if(args.length<f.min||args.length>f.max)fail(t.v+'() takes '+(f.min===f.max?'':'at least ')+f.min+' argument'+(f.min===1?'':'s')+', got '+args.length);
      return {t:'call',name:t.v,args:args};
    }
    if(t.v==='('){
      var e=add();
      if(!isOp(')'))fail('expected ")"');
      p++;return e;
    }
    fail('unexpected "'+t.text+'"');
  }
  var ast=add();
  if(p<toks.length)fail('unexpected "'+toks[p].text+'"');
  return ast;
}

function run(n,scope,src){
  switch(n.t){
    case 'num':return n.v;
    case 'ref':return lookup(scope,n.path,src);
    case 'neg':return -run(n.a,scope,src);
    case 'bin':
      var a=run(n.a,scope,src),b=run(n.b,scope,src);
      if(n.op==='+')return a+b;
      if(n.op==='-')return a-b;
      if(n.op==='*')return a*b;
      if(b===0)throw err('division by zero',src);
      return a/b;
    case 'call':
      return FUNCS[n.name].fn.apply(null,n.args.map(function(x){return run(x,scope,src)}));
  }
  throw err('internal error: unknown node '+n.t,src);
}

function refsOf(n,out){
  if(n.t==='ref')out.push({text:formatRef(n.path),path:n.path});
  else if(n.t==='neg')refsOf(n.a,out);
  else if(n.t==='bin'){refsOf(n.a,out);refsOf(n.b,out)}
  else if(n.t==='call')n.args.forEach(function(x){refsOf(x,out)});
  return out;
}

var cache=Object.create(null),cacheSize=0;
/* Compiles a formula once. Returns {src, refs, evaluate(scope)}. Syntax errors throw here, before any scope exists,
   so content validators can compile every formula at load time. */
F.compile=function(src){
  if(typeof src==='number'&&isFinite(src))src=String(src);
  if(typeof src!=='string')throw err('expected a string or number, got '+typeof src);
  if(cache[src])return cache[src];
  var ast=parse(src);
  var compiled={
    src:src,
    refs:refsOf(ast,[]),
    evaluate:function(scope){
      var v=run(ast,scope,src);
      if(!isFinite(v))throw err('result is not a finite number',src);
      return v;
    }
  };
  if(cacheSize>=MAX_CACHE){cache=Object.create(null);cacheSize=0}
  cache[src]=compiled;cacheSize++;
  return compiled;
};

F.evaluate=function(src,scope){return F.compile(src).evaluate(scope)};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
