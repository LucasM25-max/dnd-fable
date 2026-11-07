/* Which scene is on screen, and how one replaces another. Pure, so a Node test can guard the order (tests/suites/scenes.test.js).

   Scenes share what exists once on the page: #hud-layer, the input handlers and the canvas. A scene's exit() tears those down, so
   the scene on screen has to be left BEFORE the next one is built, never after. A fight built first had its HUD and its input
   handlers wiped by the exit of the fight it replaced, which is why "Fight again" used to leave the player with no HUD.

   Fable.createSceneRunner({resize})     resize() is called after every change of scene
     runner.current()                    the scene on screen, or null between two scenes
     runner.leave()                      exit() the current scene once and clear it
     runner.show(scene)                  leave, then enter the scene (a scene that already exists, such as the menu)
     runner.swap(build)                  leave, then build() the next scene and show it. If build() throws, nothing is left on
                                         screen and the error is passed on: the caller decides what to show instead     */
(function(G){
G.Fable=G.Fable||{};
G.Fable.createSceneRunner=function(opts){
  opts=opts||{};
  var cur=null;
  var runner={
    current:function(){return cur},
    leave:function(){var old=cur;cur=null;if(old&&old.exit)old.exit();return old},
    show:function(scene){
      runner.leave();
      cur=scene;
      if(scene.enter)scene.enter();
      if(opts.resize)opts.resize();
      return scene;
    },
    swap:function(build){
      runner.leave();
      return runner.show(build());
    }
  };
  return runner;
};
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
