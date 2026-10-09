/* Seeded random numbers (mulberry32). Pure: no DOM and no Three.js, so rules code, Web Workers and the Node tests can use it.
   Fable.rng(seed) returns a function that yields numbers in [0, 1). The sequence for a given seed never changes,
   because map generation and saved encounters depend on it. */
(function(G){
G.Fable=G.Fable||{};
var Fable=G.Fable;

function rng(seed){
  var a=seed|0;
  var next=function(){var t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
  /* State can be saved and restored so a fight can be replayed or resumed from the exact same point. */
  next.getState=function(){return a|0};
  next.setState=function(s){a=s|0};
  return next;
}

/* Turns any string into a 32-bit seed (FNV-1a), for example rng(rng.hash('goblin-ambush:round-1')). */
rng.hash=function(str){
  var h=0x811C9DC5;str=String(str);
  for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)}
  return h|0;
};

Fable.rng=rng;
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
