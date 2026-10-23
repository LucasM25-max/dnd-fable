'use strict';
const assert=require('assert'),H=require('../harness');

/* Phase 7 core: easing, the animation system and the cue timeline. All pure, so they run on plain stand-in objects. */
function load(){
  H.fresh();H.loadRules();
  ['js/presentation/ease.js','js/presentation/anim.js','js/presentation/timeline.js'].forEach(f=>H.runFile(f));
}
function obj(x,y,z){return {position:{x:x||0,y:y||0,z:z||0},rotation:{x:0,y:0,z:0,order:'XYZ'},scale:{x:1,y:1,z:1}}}
function rig(){
  const j={root:obj(),hips:obj(0,8,0),torso:obj(0,8,0),head:obj(0,11,0),armL:obj(5,7,0),armR:obj(-5,7,0),legL:obj(-2,0,0),legR:obj(2,0,0)};
  j.root.scale={x:.75,y:.75,z:.75};j.armR.rotation.x=-.9;
  return {joints:j,idle:{armR:-.9},footDrop:8};
}
const near=(a,b,e)=>assert.ok(Math.abs(a-b)<=(e||1e-6),a+' vs '+b);

module.exports=function(t){
  const {suite,test}=t;
  suite('phase 7 easing',()=>{
    test('every easing starts at 0 and ends at 1',()=>{
      load();
      Fable.ease.names().forEach(n=>{
        const f=Fable.ease.get(n);
        near(f(0),0,1e-9);near(f(1),1,1e-9);
        for(let i=0;i<=20;i++)assert.ok(isFinite(f(i/20)),n);
      });
    });
    test('sample holds the ends, interpolates between keys and honours a per-key easing',()=>{
      load();
      const k=[[0,0],[1,10],[2,10,'step']];
      near(Fable.ease.sample(k,-1,'linear'),0);near(Fable.ease.sample(k,.5,'linear'),5);near(Fable.ease.sample(k,5,'linear'),10);
      near(Fable.ease.sample([[0,0],[1,10,'step']],.99,'linear'),0);
      near(Fable.ease.sample([[3,4]],0),4);
    });
    test('unknown names fall back to the default curve',()=>{load();assert.strictEqual(Fable.ease.get('nope'),Fable.ease.get(Fable.ease.DEFAULT))});
  });

  suite('phase 7 animation system',()=>{
    const clip={id:'t-swing',duration:1,layer:'upper',fadeIn:0,fadeOut:0,tracks:{torso:{rotY:[[0,0],[1,1]],ease:'linear'},root:{posZ:[[0,0],[1,2]],ease:'linear'}},events:[{t:.5,cue:'mid'}]};
    test('validate accepts a sound clip and names each problem in a bad one',()=>{
      load();
      assert.deepStrictEqual(Fable.anim.validate(clip),[]);
      const bad={duration:0,layer:'x',tracks:{torso:{rotQ:[[0,0]],rotX:[[1,0],[0,0]],ease:'nope'},head:{}},events:[{t:9,cue:''}]};
      const p=Fable.anim.validate(bad).join('|');
      ['duration','layer','unknown channel','out of time order','easing','animates nothing','events[0]'].forEach(w=>assert.ok(p.indexOf(w)>=0,w+' in '+p));
    });
    test('sampleClip reads tracks at a time',()=>{
      load();
      near(Fable.anim.sampleClip(clip,.5)['torso.rotY'],.5);
      near(Fable.anim.clipValue(clip,'head','rotX',.5),0);
      near(Fable.anim.clipValue(clip,'head','sclY',.5),1);
      assert.strictEqual(Fable.anim.eventTime(clip,'mid'),.5);
    });
    test('the pose is rebuilt from the resting pose every frame: nothing accumulates and the model scale survives',()=>{
      load();
      const r=rig(),a=Fable.anim.createAnimator(r,{lookup:{get:()=>clip}});
      a.setRoot(10,20,0);
      for(let i=0;i<30;i++){a.update(.05);a.apply()}
      a.play(clip);
      for(let i=0;i<8;i++){a.update(.05);a.apply()}
      for(let i=0;i<60;i++){a.update(.05);a.apply()}
      near(r.joints.root.scale.y,.75);near(r.joints.torso.rotation.y,0);near(r.joints.armR.rotation.x,-.9);
      near(r.joints.root.position.x,10);near(r.joints.root.position.z,20);
    });
    test('an upper clip blends over the base, fires its events once, and calls back when it ends',()=>{
      load();
      const r=rig(),a=Fable.anim.createAnimator(r,{lookup:{get:()=>clip}}),seen=[];let done=0;
      a.setRoot(0,0,0);
      a.play(clip,{onEvent:c=>seen.push(c),onDone:()=>done++});
      let mid=null;
      for(let i=0;i<40;i++){a.update(.05);a.apply();if(Math.abs(i*.05+.05-.5)<1e-6)mid=r.joints.torso.rotation.y}
      near(mid,.5,.06);
      assert.deepStrictEqual(seen,['mid']);assert.strictEqual(done,1);assert.ok(!a.busy());
    });
    test('root position tracks are in the creature frame: forward follows the facing',()=>{
      load();
      const r=rig(),a=Fable.anim.createAnimator(r,{lookup:{get:()=>clip}});
      a.setRoot(0,0,Math.PI/2);a.play(clip,{fade:0});
      for(let i=0;i<20;i++){a.update(.05);a.apply()}
      assert.ok(r.joints.root.position.x>1.5,'facing +x moves along +x: '+r.joints.root.position.x);near(r.joints.root.position.z,0,1e-3);
    });
    test('crossfading the base keeps the weights adding up to one pose',()=>{
      load();
      const A={id:'a',duration:1,layer:'base',loop:true,tracks:{head:{rotX:[[0,1],[1,1]]}}},B={id:'b',duration:1,layer:'base',loop:true,tracks:{head:{rotX:[[0,3],[1,3]]}}};
      const r=rig(),a=Fable.anim.createAnimator(r,{});
      a.setBase(A,{fade:0});a.update(.01);near(a.pose().head.rotX,1);
      a.setBase(B,{fade:.2});
      let prev=1;
      for(let i=0;i<10;i++){a.update(.03);const v=a.pose().head.rotX;assert.ok(v>=prev-1e-9&&v<=3+1e-9,'monotone '+v);prev=v}
      near(a.pose().head.rotX,3,1e-6);assert.strictEqual(a.baseId(),'b');
    });
    test('additive clips add and upper clips override, by weight',()=>{
      load();
      const add={id:'x',duration:1,layer:'additive',loop:true,fadeIn:0,tracks:{head:{rotX:[[0,.5],[1,.5]]}}};
      const r=rig(),a=Fable.anim.createAnimator(r,{});
      a.play(add);a.update(.02);near(a.pose().head.rotX,.5);
      a.play({id:'u',duration:1,layer:'upper',fadeIn:0,hold:true,tracks:{head:{rotX:[[0,2],[1,2]]}}});a.update(.02);near(a.pose().head.rotX,2.5-.5,.6);
    });
    test('scale tracks multiply the resting scale',()=>{
      load();
      const r=rig(),a=Fable.anim.createAnimator(r,{});
      a.play({id:'s',duration:1,layer:'upper',fadeIn:0,hold:true,tracks:{root:{sclY:[[0,.8],[1,.8]]}}});
      a.setRoot(0,0,0);a.update(.02);a.apply();
      near(r.joints.root.scale.y,.75*.8);near(r.joints.root.scale.x,.75);
    });
    test('foot planting lowers the body by the lift of the lower foot, and clips can switch it off',()=>{
      load();
      const r=rig(),a=Fable.anim.createAnimator(r,{});
      a.play({id:'w',duration:1,layer:'additive',loop:true,fadeIn:0,tracks:{legL:{rotX:[[0,.8],[1,.8]]},legR:{rotX:[[0,-.8],[1,-.8]]}}});
      a.update(.02);
      assert.ok(a.pose().root.posY<-.5,'both feet lifted equally: the body drops '+a.pose().root.posY);
      const a2=Fable.anim.createAnimator(rig(),{});
      a2.play({id:'w2',duration:1,layer:'additive',loop:true,fadeIn:0,tracks:{legL:{rotX:[[0,.8],[1,.8]]}}});a2.update(.02);
      near(a2.pose().root.posY,0,1e-9);
      const a3=Fable.anim.createAnimator(rig(),{});
      a3.play({id:'w3',duration:1,layer:'additive',loop:true,fadeIn:0,plant:false,tracks:{legL:{rotX:[[0,.8],[1,.8]]},legR:{rotX:[[0,.8],[1,.8]]}}});a3.update(.02);
      near(a3.pose().root.posY,0,1e-9);
    });
    test('look-at turns the head toward a point and clamps it; clearing it eases back',()=>{
      load();
      const r=rig(),a=Fable.anim.createAnimator(r,{});
      a.setRoot(0,0,0);a.lookAt(10,0,1);
      for(let i=0;i<60;i++)a.update(.05);
      near(a.pose().head.rotY,1.0,.01);
      a.clearLook();for(let i=0;i<80;i++)a.update(.05);
      near(a.pose().head.rotY,0,.01);
    });
    test('a frozen animator holds still (hit-stop) and a per-actor speed scales the base only',()=>{
      load();
      const loop={id:'l',duration:1,layer:'base',loop:true,tracks:{head:{rotX:[[0,0],[1,1]],ease:'linear'}}};
      const r=rig(),a=Fable.anim.createAnimator(r,{});
      a.setBase(loop,{fade:0});a.update(.25);const v=a.pose().head.rotX;
      a.freeze(.1);a.update(.05);near(a.pose().head.rotX,v);a.update(.1);a.update(.05);assert.ok(a.pose().head.rotX>v);
      a.setSpeed(.5);const w=a.pose().head.rotX;a.update(.1);near(a.pose().head.rotX-w,.05,.01);
    });
    test('locomotion advances the stride by distance and reports each footfall',()=>{
      load();
      const walk={id:'walk',duration:1,layer:'base',loop:true,stride:10,tracks:{legL:{rotX:[[0,-.5],[.5,.5],[1,-.5]]},legR:{rotX:[[0,.5],[.5,-.5],[1,.5]]}},events:[{t:0,cue:'step'},{t:.5,cue:'step'}]};
      const r=rig();r.clips={walk:'walk'};
      const steps=[],a=Fable.anim.createAnimator(r,{lookup:{get:()=>walk},onEvent:c=>steps.push(c)});
      for(let i=0;i<20;i++){a.locomotion({moving:true,dist:1});a.update(.02)}
      assert.strictEqual(a.baseId(),'walk');
      assert.strictEqual(steps.length,4,'20 units at a stride of 10 is two cycles, two steps each: '+steps.length);
    });
    test('finish() ends actions, keeps held poses and calls the callbacks',()=>{
      load();
      const r=rig(),a=Fable.anim.createAnimator(r,{});let d=0;
      a.play({id:'u',duration:5,layer:'upper',tracks:{head:{rotX:[[0,1],[5,1]]}}},{onDone:()=>d++});
      a.play({id:'h',duration:2,layer:'additive',hold:true,fadeIn:0,tracks:{head:{rotY:[[0,0],[2,1]],ease:'linear'}}});
      a.update(.1);a.finish();
      assert.strictEqual(d,1);assert.ok(!a.busy('upper'));near(a.pose().head.rotX,0);near(a.pose().head.rotY,1,1e-6);
    });
  });

  suite('phase 7 cue timeline',()=>{
    function runner(log){return (c,info)=>log.push([c.type,c.t,!!info.skipped])}
    test('cues fire in time order, once each, and the timeline ends after its duration',()=>{
      load();
      const log=[],tl=Fable.createTimeline([{t:.3,type:'sfx'},{t:0,type:'anim'},{t:.3,type:'vfx'},{t:.1,type:'wait',dur:.6}]);
      assert.strictEqual(tl.duration,.7);
      for(let i=0;i<20;i++)tl.update(.05,runner(log));
      assert.deepStrictEqual(log.map(x=>x[0]),['anim','wait','sfx','vfx']);assert.ok(tl.done());
    });
    test('skip runs only the essential cues, flagged as skipped, in order',()=>{
      load();
      const log=[],tl=Fable.createTimeline([{t:0,type:'anim'},{t:.2,type:'impact',essential:true},{t:.3,type:'vfx'},{t:.5,type:'hud',essential:true}]);
      tl.update(.1,runner(log));tl.skip(runner(log));
      assert.deepStrictEqual(log,[['anim',0,false],['impact',.2,true],['hud',.5,true]]);assert.ok(tl.done());
    });
    test('a cue that freezes the clock (hit-stop) holds back the cues after it',()=>{
      load();
      const log=[],tl=Fable.createTimeline([{t:.1,type:'impact'},{t:.12,type:'vfx'}]);
      const run=(c,i)=>{log.push(c.type);if(c.type==='impact')tl.freeze(.2)};
      tl.update(.11,run);assert.deepStrictEqual(log,['impact']);
      tl.update(.1,run);assert.deepStrictEqual(log,['impact']);
      tl.update(.15,run);assert.deepStrictEqual(log,['impact','vfx']);
    });
    test('the queue plays timelines one after another and Instant speed skips them at once',()=>{
      load();
      const log=[];let sp=1;
      const q=Fable.createCueQueue({run:(c,i)=>log.push(c.type+(i.skipped?'!':'')),speed:()=>sp});
      q.push(Fable.createTimeline([{t:0,type:'a',essential:true},{t:.2,type:'b'}]));
      q.push(Fable.createTimeline([{t:0,type:'c'}]));
      q.update(.1);assert.deepStrictEqual(log,['a']);assert.ok(q.busy());
      q.update(.2);assert.deepStrictEqual(log,['a','b','c']);assert.ok(!q.busy());
      q.push(Fable.createTimeline([{t:0,type:'x',essential:true},{t:1,type:'y',essential:true}]));sp=Infinity;
      q.update(.01);assert.deepStrictEqual(log.slice(3),['x!','y!']);assert.ok(!q.busy());
    });
    test('Fast speed shortens playback, slow motion stretches it, and pause stops the clock',()=>{
      load();
      let sp=2,log=[];
      const q=Fable.createCueQueue({run:c=>log.push(c.type),speed:()=>sp});
      q.push(Fable.createTimeline([{t:.5,type:'a'}]));
      q.update(.2);assert.deepStrictEqual(log,[]);q.update(.1);assert.deepStrictEqual(log,['a']);
      sp=1;q.timeScale=.25;log=[];q.push(Fable.createTimeline([{t:.1,type:'b'}]));
      q.update(.2);assert.deepStrictEqual(log,[]);q.update(.3);assert.deepStrictEqual(log,['b']);
      q.timeScale=1;log=[];q.push(Fable.createTimeline([{t:.1,type:'c'}]));q.pause();q.update(1);assert.deepStrictEqual(log,[]);q.resume();q.update(.2);assert.deepStrictEqual(log,['c']);
    });
  });

  suite('phase 7 camera direction',()=>{
    function loadCam(){load();H.runFile('js/presentation/camera.js')}
    const V={yaw:0,pitch:.95,dist:150,fov:45*Math.PI/180,aspect:16/9,minDist:70,maxDist:260,target:{x:0,y:6,z:0}};
    test('project puts the look point in the middle of the screen, +x on the right and distance higher up',()=>{
      loadCam();
      const c=Fable.camera.project({x:0,y:6,z:0},V);near(c.x,0,1e-9);near(c.y,0,1e-9);
      const r=Fable.camera.project({x:20,y:6,z:0},V);assert.ok(r.x>0,'yaw 0 looks toward -z, so +x is on the right: '+r.x);
      assert.ok(Fable.camera.project({x:0,y:6,z:-30},V).y>0,'further away is higher on screen');
    });
    test('frame keeps both creatures inside the HUD safe zone, closer for a short pair and further for a long one',()=>{
      loadCam();
      const safe={top:.16,bottom:.28,left:.06,right:.06};
      [[15,0],[40,0],[90,20],[0,60]].forEach(d=>{
        const a={x:0,y:6,z:0},b={x:d[0],y:6,z:d[1]},f=Fable.camera.frame([a,b],V,safe);
        const v=Object.assign({},V,{dist:f.dist,target:f.focus});
        [a,b].forEach(p=>{
          const q=Fable.camera.project(p,v);
          assert.ok(f.fits,'fits '+JSON.stringify(d));
          assert.ok(q.x>=-1+2*safe.left-1e-6&&q.x<=1-2*safe.right+1e-6&&q.y>=-1+2*safe.bottom-1e-6&&q.y<=1-2*safe.top+1e-6,'inside '+JSON.stringify(q));
        });
      });
      const near1=Fable.camera.frame([{x:0,z:0},{x:15,z:0}],V,safe),far1=Fable.camera.frame([{x:0,z:0},{x:90,z:0}],V,safe);
      assert.ok(near1.dist<=far1.dist);assert.ok(near1.dist>=V.minDist&&far1.dist<=V.maxDist);
    });
    test('frame centres the pair in the free area, above the middle of the screen when the bottom bars are taller',()=>{
      loadCam();
      const safe={top:.12,bottom:.32,left:.06,right:.06},a={x:-10,y:6,z:0},b={x:10,y:6,z:0},f=Fable.camera.frame([a,b],V,safe);
      const q=Fable.camera.project({x:0,y:6,z:0},Object.assign({},V,{dist:f.dist,target:f.focus}));
      near(q.y,((-1+2*safe.bottom)+(1-2*safe.top))/2,.02);
    });
    test('frame reports honestly when nothing fits',()=>{
      loadCam();
      const f=Fable.camera.frame([{x:-900,z:0},{x:900,z:0}],V,{top:.1,bottom:.1,left:.1,right:.1});
      assert.strictEqual(f.fits,false);assert.strictEqual(f.dist,V.maxDist);
    });
    test('a shot eases in, holds, eases out and is removed; modify only changes what the shot asks for',()=>{
      loadCam();
      const cd=Fable.camera.createDirector({rng:()=>.5});
      const base={target:{x:0,y:6,z:0},yaw:0,pitch:.9,dist:100};
      cd.shot({dist:.8,in:.2,hold:.3,out:.2,focus:{x:10,z:0}});
      assert.ok(cd.active());
      cd.update(.1);let m=cd.modify(base);assert.ok(m.dist<100&&m.dist>80);
      cd.update(.3);m=cd.modify(base);near(m.dist,80,.001);near(m.target.x,10,.001);assert.strictEqual(m.yaw,0);
      cd.update(.2);cd.update(.2);cd.update(.1);assert.ok(!cd.active());
      near(cd.modify(base).dist,100);
    });
    test('release eases a held shot out; cancel (the player moved the camera) clears moves quickly and blocks new ones for a moment',()=>{
      loadCam();
      const cd=Fable.camera.createDirector({rng:()=>.5}),base={target:{x:0,y:6,z:0},yaw:0,pitch:.9,dist:100};
      cd.shot({dist:.7,in:.1,hold:Infinity,out:.2,tag:'a'});cd.update(1);near(cd.modify(base).dist,70,.01);
      cd.release('a');cd.update(.1);cd.update(.3);assert.ok(!cd.active());
      cd.shot({dist:.7,in:.1,hold:5,out:.2});cd.update(.2);cd.cancel();cd.update(.3);assert.ok(!cd.active());
      assert.strictEqual(cd.shot({dist:.7}),null,'no new move during the grace period');
      cd.update(2);assert.ok(cd.shot({dist:.7}));
    });
    test('shake and fov punch decay to nothing, and reduced motion removes shake, punch, spin and zoom moves',()=>{
      loadCam();
      let red=false;const cd=Fable.camera.createDirector({rng:()=>.3,reduced:()=>red});
      cd.shake(1,.3);cd.punch(.1,.3);cd.update(.05);
      assert.ok(Math.abs(cd.offset().x)+Math.abs(cd.offset().y)>0);assert.ok(cd.fovAdd()>0);
      cd.update(.5);near(cd.offset().x,0);near(cd.fovAdd(),0);
      red=true;cd.shake(1,.3);cd.punch(.1,.3);cd.update(.05);near(cd.offset().x,0);near(cd.fovAdd(),0);
      cd.shot({dist:.5,spin:1,yaw:1,fov:.2,in:.1,hold:1,out:.1});cd.update(.4);
      const m=cd.modify({target:{x:0,y:0,z:0},yaw:0,pitch:.9,dist:100});near(m.dist,100);near(m.yaw,0);
    });
    test('an orbit shot turns the camera by its spin over time',()=>{
      loadCam();
      const cd=Fable.camera.createDirector({rng:()=>.5});cd.shot({spin:.5,in:.01,hold:Infinity});cd.update(2);
      near(cd.modify({target:{x:0,y:0,z:0},yaw:0,pitch:.9,dist:100}).yaw,1,.01);
    });
  });
};
