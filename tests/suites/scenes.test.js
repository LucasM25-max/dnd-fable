'use strict';
const assert=require('assert');
const {fresh,runFile}=require('../harness');

/* "Fight again" left the player with no HUD and no input: the next fight was built (it mounted its HUD on the shared #hud-layer and set
   the input handlers) and only then was the old fight's scene left, and its exit() cleared both. The runner guards the order. */
module.exports=function(t){
  t.suite('scene runner',()=>{
    function rig(){
      fresh();runFile('js/game/scenes.js');
      const log=[];
      let resized=0;
      const runner=Fable.createSceneRunner({resize:()=>{resized++}});
      const scene=(name,extra)=>Object.assign({name,enter(){log.push('enter '+name)},exit(){log.push('exit '+name)}},extra||{});
      return {runner,log,scene,resized:()=>resized};
    }
    t.test('swap leaves the old scene before it builds the next one',()=>{
      const {runner,log,scene}=rig();
      runner.show(scene('fight 1'));
      log.length=0;
      runner.swap(()=>{log.push('build fight 2');return scene('fight 2')});
      assert.deepStrictEqual(log,['exit fight 1','build fight 2','enter fight 2']);
      assert.strictEqual(runner.current().name,'fight 2');
    });
    t.test('the old scene is exited exactly once, however many times the scene changes',()=>{
      const {runner,log,scene}=rig();
      runner.show(scene('a'));
      runner.swap(()=>scene('b'));
      runner.show(scene('c'));
      runner.leave();runner.leave();
      assert.deepStrictEqual(log,['enter a','exit a','enter b','exit b','enter c','exit c']);
      assert.strictEqual(runner.current(),null);
    });
    t.test('a scene that cannot be built leaves nothing on screen and passes the error on',()=>{
      const {runner,log,scene}=rig();
      runner.show(scene('fight 1'));
      assert.throws(()=>runner.swap(()=>{throw new Error('no free square')}),/no free square/);
      assert.strictEqual(runner.current(),null);
      assert.deepStrictEqual(log,['enter fight 1','exit fight 1']);
      /* the caller can then show the menu */
      runner.show(scene('menu'));
      assert.strictEqual(runner.current().name,'menu');
    });
    t.test('the scene being exited does not see itself as current, and resize runs after each change',()=>{
      const {runner,scene,resized}=rig();
      let seen='unset';
      runner.show(scene('a',{exit(){seen=runner.current()}}));
      runner.swap(()=>scene('b'));
      assert.strictEqual(seen,null);
      assert.strictEqual(resized(),2);
    });
    t.test('a scene without enter or exit is fine',()=>{
      const {runner}=rig();
      runner.show({name:'bare'});
      runner.swap(()=>({name:'bare 2'}));
      assert.strictEqual(runner.current().name,'bare 2');
    });
  });
};
