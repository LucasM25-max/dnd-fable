'use strict';
const assert=require('assert'),H=require('../harness');

/* The tavern's back wall (js/menu/tavern-layout.js): the stones must fit around the window and the fireplace with no gap and no overlap. */
function layout(){H.fresh();H.runFile('js/menu/tavern-layout.js');return Fable.tavernLayout}

module.exports=function(t){
  const {suite,test}=t;
  suite('tavern wall masonry',()=>{
    test('every course is tiled exactly: stones touch end to end across each run, with no gap and no overlap',()=>{
      const L=layout();
      for(let c=0;c<L.WALL.courses;c++){
        const runs=L.runs(c),st=L.stones(c);
        runs.forEach(r=>{
          const own=st.filter(s=>s.x0>=r[0]-1e-6&&s.x1<=r[1]+1e-6).sort((a,b)=>a.x0-b.x0);
          assert.ok(own.length>0,'course '+c+' run has stones');
          assert.ok(Math.abs(own[0].x0-r[0])<1e-6,'course '+c+' starts at the run');
          assert.ok(Math.abs(own[own.length-1].x1-r[1])<1e-6,'course '+c+' ends at the run');
          for(let i=1;i<own.length;i++)assert.ok(Math.abs(own[i].x0-own[i-1].x1)<1e-6,'course '+c+' joint '+i);
        });
        assert.strictEqual(st.length,runs.reduce((n,r)=>n+st.filter(s=>s.x0>=r[0]-1e-6&&s.x1<=r[1]+1e-6).length,0));
      }
    });
    test('no stone is cut into a sliver or stretched too wide',()=>{
      const L=layout();
      L.all().forEach(s=>{
        const w=s.x1-s.x0;
        assert.ok(w>=L.MIN-1e-6&&w<=L.MAX+1e-6,'width '+w+' in course '+s.course);
      });
    });
    test('no stone overlaps the window or the fireplace, and the stones reach both ends of the wall',()=>{
      const L=layout();
      L.all().forEach(s=>L.OPENINGS.forEach(o=>{
        const hit=s.x0<o.x1-1e-6&&s.x1>o.x0+1e-6&&s.y0<o.y1-1e-6&&s.y1>o.y0+1e-6;
        assert.ok(!hit,o.id+' covered by a stone in course '+s.course);
      }));
      for(let c=0;c<L.WALL.courses;c++){
        const st=L.stones(c);
        assert.ok(Math.abs(Math.min(...st.map(s=>s.x0))-L.WALL.x0)<1e-6);
        assert.ok(Math.abs(Math.max(...st.map(s=>s.x1))-L.WALL.x1)<1e-6);
      }
    });
    test('stones next to an opening end exactly on its edge',()=>{
      const L=layout(),win=L.OPENINGS[0];
      const touching=L.all().filter(s=>s.y1>win.y0&&s.y0<win.y1);
      assert.ok(touching.some(s=>Math.abs(s.x1-win.x0)<1e-6));
      assert.ok(touching.some(s=>Math.abs(s.x0-win.x1)<1e-6));
    });
    test('joints are staggered: no vertical joint lines up with the one in the course below',()=>{
      const L=layout();
      for(let c=1;c<L.WALL.courses;c++){
        const edge=k=>L.stones(k).map(s=>s.x1).filter(x=>x<L.WALL.x1-1e-6&&!L.OPENINGS.some(o=>Math.abs(o.x0-x)<1e-6||Math.abs(o.x1-x)<1e-6));
        const below=edge(c-1);
        edge(c).forEach(x=>assert.ok(!below.some(y=>Math.abs(y-x)<0.5),'joint '+x+' stacks in course '+c));
      }
    });
  });
};
