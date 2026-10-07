/* Forest clearing: open grass ringed by woods, a dirt path from the south edge to a ruined outpost,
   plus a standing-stone circle and a ruined watchtower to find. Load this file last in the map folder. */
(function(){
var FC=Fable.forestClearing;
Fable.maps.register({
  id:'forest-clearing',
  name:'Forest Clearing',
  environments:['forest','grassland'],      // first tag is the primary one
  bounds:FC.BOUNDS,
  seed:20261007,                            // fixed so the layout is identical every load
  sky:0xa9cbe6,
  fog:{near:260,far:900},
  groundColor:0x4f853a,                     // the ground beyond the edge of the map
  playerSpawn:FC.PLAYER_SPAWN,
  enemySpawns:FC.ENEMY_SPAWNS,
  isReserved:FC.isReserved,                 // path and outpost: scenery keeps out of these
  /* Called once by the world builder. Order matters: it sets the order the seeded random numbers are drawn in. */
  build:function(ctx){
    FC.buildTerrain(ctx);FC.buildFlora(ctx);FC.buildOutpost(ctx);FC.buildLandmarks(ctx);FC.buildProps(ctx);
  }
});
})();
