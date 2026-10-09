'use strict';
/* Node test harness: node tests/run.js [filter]
   Loads the plain browser scripts into Node with shimmed globals. No build step and no dependencies. */
const fs=require('fs'),path=require('path');
const filter=process.argv[2]||'';
const tests=[];
let suite='';
const t={
  suite(name,fn){suite=name;fn();suite=''},
  test(name,fn){tests.push({name:(suite?suite+': ':'')+name,fn})},
  skip(name,why){tests.push({name:(suite?suite+': ':'')+name,skip:why||'skipped'})}
};
fs.readdirSync(path.join(__dirname,'suites')).filter(f=>f.endsWith('.test.js')).sort()
  .forEach(f=>require(path.join(__dirname,'suites',f))(t));

(async()=>{
  let pass=0,fail=0,skipped=0;
  for(const x of tests){
    if(filter&&x.name.toLowerCase().indexOf(filter.toLowerCase())<0)continue;
    if(x.skip){skipped++;console.log('  skip  '+x.name+' ('+x.skip+')');continue}
    try{await x.fn();pass++;console.log('  ok    '+x.name)}
    catch(e){fail++;console.log('  FAIL  '+x.name+'\n        '+String(e&&e.stack||e).split('\n').slice(0,6).join('\n        '))}
  }
  console.log('\n'+pass+' passed, '+fail+' failed'+(skipped?', '+skipped+' skipped':''));
  process.exit(fail?1:0);
})();
