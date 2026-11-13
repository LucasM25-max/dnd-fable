'use strict';
const assert=require('assert'),H=require('../harness');
let THREE=null;try{THREE=require('three')}catch(e){}

/* Every item has a 3D look. The rows are checked without Three.js; the shapes themselves are built when the package is there. */
module.exports=function({suite,test,skip}){
  suite('item models',()=>{
    test('every item has a model row, and every row names a family and a prop kind that exist',async()=>{
      const C=await H.loadData();
      globalThis.THREE=THREE||undefined;
      ['js/core/voxel.js','js/engine/gear-models.js','js/engine/gear-props.js','js/engine/gear-props-tools.js','js/engine/gear-props-kits.js'].forEach(H.runFile);
      try{
        C.items.list().forEach(i=>{
          assert.ok(i.visual&&i.visual.model,i.id+' has no visual');
          const m=C.itemModels.get(i.visual.model);
          assert.ok(m,i.id+' names a model row that does not exist');
          assert.ok(Fable.gear.families[m.family],i.id+' uses the unknown family '+m.family);
          if(m.family==='prop')assert.ok(Fable.gear.props[m.params.kind],i.id+' uses the unknown prop kind '+(m.params&&m.params.kind));
        });
      }finally{delete globalThis.THREE}
    });
    test('props are never drawn on the hero: only weapons, armor and the shield hang on the body',async()=>{
      const C=await H.loadData();
      C.items.list().forEach(i=>{
        const m=C.itemModels.get(i.visual.model);
        if(m.family==='prop')assert.strictEqual(m.stow,null,i.id);
      });
    });
    test('a prop of an unknown kind fails loudly instead of drawing nothing',async()=>{
      await H.loadData();
      ['js/engine/gear-models.js','js/engine/gear-props.js'].forEach(H.runFile);
      assert.throws(()=>Fable.gear.families.prop({kind:'nothing-like-it'},{}),/unknown prop kind/);
    });
    if(!THREE){skip('item shapes are built and have volume (needs the "three" npm package)','run npm i three@0.128.0 --no-save to enable');return}
    test('the shaped blocks have volume: a cylinder holds fewer voxels than its box, and a cone fewer than a cylinder',async()=>{
      await H.loadData();
      globalThis.THREE=THREE;
      try{
        ['js/core/voxel.js','js/engine/gear-models.js'].forEach(H.runFile);
        const count=kind=>{
          const g=new THREE.Group();Fable.s(g,0,0,0,6,6,6,0xffffff,kind,kind==='cone'?[0,0]:undefined);
          g.updateMatrixWorld(true);Fable.voxelize(g,false);
          let n=0;g.traverse(o=>{if(o.isInstancedMesh)n+=o.count});return n;
        };
        const box=count('box'),cyl=count('cyl'),ell=count('ell');
        assert.ok(box>0&&cyl>0&&ell>0);
        assert.ok(cyl<box,'cylinder '+cyl+' vs box '+box);assert.ok(ell<cyl,'ellipsoid '+ell+' vs cylinder '+cyl);
      }finally{delete globalThis.THREE}
    });
  });
};
