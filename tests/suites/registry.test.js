'use strict';
const assert=require('assert'),H=require('../harness');
function setup(){H.fresh();H.loadRules();H.loadRegistry();return Fable.content}
const ok={source:'original'};

module.exports=function({suite,test}){
  suite('defineKind',()=>{
    test('registers, gets, lists and counts',()=>{
      const C=setup();
      const k=C.defineKind('gizmos',{label:'Gizmo'});
      assert.strictEqual(C.gizmos,k);
      k.register({id:'a',name:'A',...ok});
      k.registerAll([{id:'b',name:'B',...ok},{id:'c-d',name:'C',...ok}]);
      assert.deepStrictEqual(k.ids(),['a','b','c-d']);
      assert.strictEqual(k.size(),3);
      assert.strictEqual(k.get('b').name,'B');
      assert.strictEqual(k.get('zzz'),null);
      assert.strictEqual(k.get('constructor'),null);
      assert.strictEqual(k.has('a'),true);
      assert.strictEqual(k.has('toString'),false);
      assert.deepStrictEqual(k.filter(d=>d.id!=='a').map(d=>d.id),['b','c-d']);
      assert.deepStrictEqual(C.kindNames(),['gizmos']);
      assert.strictEqual(C.getKind('gizmos'),k);
    });
    test('rejects bad definitions in the existing error style',()=>{
      const C=setup();
      const k=C.defineKind('gizmos',{label:'Gizmo',required:['power']});
      const good={id:'a',name:'A',power:1,...ok};
      assert.throws(()=>k.register(null),/Gizmo "\(unknown\)": a definition must be an object/);
      assert.throws(()=>k.register([]),/must be an object/);
      assert.throws(()=>k.register({...good,id:undefined}),/Gizmo "\(missing\)": id must be lowercase words/);
      assert.throws(()=>k.register({...good,id:'Bad_Id'}),/Gizmo "Bad_Id": id must be lowercase words/);
      assert.throws(()=>k.register({...good,name:''}),/Gizmo "a": needs a display name/);
      assert.throws(()=>k.register({...good,source:undefined}),/Gizmo "a": needs a source tag/);
      assert.throws(()=>k.register({id:'a',name:'A',...ok}),/Gizmo "a": needs "power"/);
      assert.throws(()=>k.register({...good,power:null}),/needs "power"/);
      k.register(good);
      assert.throws(()=>k.register(good),/Gizmo "a": already registered/);
      assert.throws(()=>k.registerAll('x'),/expects an array/);
      assert.strictEqual(k.size(),1);
    });
    test('failed registrations leave nothing behind',()=>{
      const C=setup();
      const k=C.defineKind('gizmos',{label:'Gizmo',validate(d,fail){if(d.power<0)fail('power cannot be negative')}});
      assert.throws(()=>k.register({id:'a',name:'A',power:-1,...ok}),/Gizmo "a": power cannot be negative/);
      assert.strictEqual(k.has('a'),false);
      k.register({id:'a',name:'A',power:1,...ok});
      assert.strictEqual(k.size(),1);
    });
    test('custom validate and normalize hooks run in order',()=>{
      const C=setup();
      const k=C.defineKind('gizmos',{label:'Gizmo',
        normalize(d){if(d.power===undefined)d.power=5},
        validate(d,fail){if(d.power!==5&&d.power!==9)fail('odd power '+d.power)}});
      assert.strictEqual(k.register({id:'a',name:'A',...ok}).power,5);
      assert.throws(()=>k.register({id:'b',name:'B',power:2,...ok}),/odd power 2/);
    });
    test('definitions are deep frozen unless the kind opts out',()=>{
      const C=setup();
      const k=C.defineKind('gizmos',{label:'Gizmo'}),loose=C.defineKind('loose',{label:'Loose',freeze:false});
      const d=k.register({id:'a',name:'A',list:[{x:1}],...ok});
      assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.list)&&Object.isFrozen(d.list[0]));
      assert.ok(!Object.isFrozen(loose.register({id:'a',name:'A',...ok})));
    });
    test('sourced:false kinds need no source tag',()=>{
      const C=setup();
      const k=C.defineKind('bits',{label:'Bit',sourced:false});
      k.register({id:'a',name:'A'});
      assert.strictEqual(k.size(),1);
    });
    test('refuses bad or clashing kind names and bad specs',()=>{
      const C=setup();
      assert.throws(()=>C.defineKind('Bad-Name',{label:'x'}),/camelCase/);
      assert.throws(()=>C.defineKind('',{label:'x'}),/camelCase/);
      ['maps','monsters','characters','encounters','zones','manifest','groups','whenReady','validate','defineKind'].forEach(n=>
        assert.throws(()=>C.defineKind(n,{label:'x'}),/already used/,n));
      assert.throws(()=>C.defineKind('okay',{}),/needs a label/);
      assert.throws(()=>C.defineKind('okay',{label:'O',validate:3}),/validate must be a function/);
      assert.throws(()=>C.defineKind('okay',{label:'O',required:'id'}),/required must be an array/);
      assert.throws(()=>C.defineKind('okay',{label:'O',refs:[{path:'a'}]}),/refs\[0\] needs a path and a kind/);
      C.defineKind('okay',{label:'O'});
      assert.throws(()=>C.defineKind('okay',{label:'O'}),/already used/);
    });
    test('the existing registries are untouched',()=>{
      const C=setup();
      assert.ok(C.maps&&C.monsters&&C.characters&&C.encounters&&C.zones);
      assert.strictEqual(Fable.maps,C.maps);
      C.monsters.register({id:'m',name:'M',factory(){}});
      assert.strictEqual(C.monsters.get('m').name,'M');
    });
  });

  suite('source filter',()=>{
    test('skips disallowed sources but still validates them',()=>{
      const C=setup();
      C.setAllowedSources(['srd52']);
      const k=C.defineKind('gizmos',{label:'Gizmo'});
      assert.ok(k.register({id:'a',name:'A',source:'srd52'}));
      assert.strictEqual(k.register({id:'b',name:'B',source:'other-book'}),null);
      assert.deepStrictEqual(k.ids(),['a']);
      assert.deepStrictEqual(k.skipped(),['b']);
      assert.throws(()=>k.register({id:'b',name:'B',source:'other-book'}),/already registered/);
      assert.throws(()=>k.register({id:'c',name:'',source:'other-book'}),/needs a display name/);
      assert.ok(C.validate().warnings.some(w=>/1 Gizmo definition\(s\) skipped/.test(w)));
    });
    test('excluded content that is still referenced shows up as a broken reference',()=>{
      const C=setup();
      C.setAllowedSources(['srd52']);
      C.defineKind('gizmos',{label:'Gizmo'});
      C.defineKind('widgets',{label:'Widget',refs:[{path:'gizmo',kind:'gizmos'}]});
      C.gizmos.register({id:'a',name:'A',source:'other-book'});
      C.widgets.register({id:'w',name:'W',source:'srd52',gizmo:'a'});
      assert.throws(()=>C.validateAll(),/Widget "w": gizmo refers to unknown Gizmo "a"/);
    });
    test('configuration rules',()=>{
      const C=setup();
      assert.strictEqual(C.getAllowedSources(),null);
      assert.strictEqual(C.isSourceAllowed('anything'),true);
      assert.throws(()=>C.setAllowedSources('srd52'),/null or an array/);
      assert.throws(()=>C.setAllowedSources(['']),/null or an array/);
      C.setAllowedSources(['srd52','original']);
      assert.deepStrictEqual(C.getAllowedSources(),['srd52','original']);
      assert.strictEqual(C.isSourceAllowed('x'),false);
      C.setAllowedSources(null);
      assert.strictEqual(C.isSourceAllowed('x'),true);
      C.defineKind('gizmos',{label:'Gizmo'}).register({id:'a',name:'A',...ok});
      assert.throws(()=>C.setAllowedSources(['srd52']),/before any content is registered/);
    });
  });

  suite('validateAll',()=>{
    function world(){
      const C=setup();
      C.defineKind('features',{label:'Feature'});
      C.defineKind('items',{label:'Item'});
      C.defineKind('classes',{label:'Class',refs:[
        {path:'features.*',kind:'features'},
        {path:'startingEquipment.*.item',kind:'items'},
        {path:'subclass',kind:'classes'}
      ]});
      C.features.registerAll([{id:'second-wind',name:'Second Wind',...ok},{id:'action-surge',name:'Action Surge',...ok}]);
      C.items.register({id:'longsword',name:'Longsword',...ok});
      return C;
    }
    test('passes when every reference resolves',()=>{
      const C=world();
      C.classes.register({id:'fighter',name:'Fighter',...ok,features:{1:['second-wind'],2:['action-surge']},startingEquipment:{a:[{item:'longsword'},{gp:5}],b:{gp:155}}});
      const r=C.validateAll();
      assert.strictEqual(r.ok,true);
      assert.deepStrictEqual(r.errors,[]);
    });
    test('reports each broken reference with its path',()=>{
      const C=world();
      C.classes.register({id:'fighter',name:'Fighter',...ok,
        features:{1:['second-wind','typo-feature'],2:['action-surge']},
        startingEquipment:{a:[{item:'longsword'},{item:'nope'}]}});
      const r=C.validate();
      assert.strictEqual(r.ok,false);
      assert.deepStrictEqual(r.errors,[
        'Class "fighter": features.1[1] refers to unknown Feature "typo-feature"',
        'Class "fighter": startingEquipment.a[1].item refers to unknown Item "nope"'
      ]);
      assert.throws(()=>C.validateAll(),/Content validation failed \(2 problems\):\n - Class "fighter": features\.1\[1\] refers to unknown Feature "typo-feature"\n - Class "fighter": startingEquipment\.a\[1\]\.item/);
    });
    test('a single problem is worded in the singular',()=>{
      const C=world();
      C.classes.register({id:'fighter',name:'Fighter',...ok,features:{1:['x']}});
      assert.throws(()=>C.validateAll(),/\(1 problem\)/);
    });
    test('handles flat lists, single ids, self references and optional fields',()=>{
      const C=world();
      C.classes.register({id:'rogue',name:'Rogue',...ok,features:['second-wind']});
      C.classes.register({id:'fighter',name:'Fighter',...ok,features:['action-surge'],subclass:'rogue'});
      C.classes.register({id:'bard',name:'Bard',...ok,features:['action-surge'],subclass:'ghost'});
      assert.deepStrictEqual(C.validate().errors,['Class "bard": subclass refers to unknown Class "ghost"']);
    });
    test('reports values that are not ids, and a list where one was expected',()=>{
      const C=world();
      C.classes.register({id:'a',name:'A',...ok,features:{1:[5,{x:1}]},subclass:7});
      C.classes.register({id:'b',name:'B',...ok,features:'text'});
      assert.deepStrictEqual(C.validate().errors,[
        'Class "a": features.1[0] must be an id (text), got number',
        'Class "a": features.1[1] must be an id (text), got an object',
        'Class "a": subclass must be an id (text), got number',
        'Class "b": features expected a list or object here'
      ]);
    });
    test('a reference to an unknown kind is reported once',()=>{
      const C=setup();
      C.defineKind('widgets',{label:'Widget',refs:[{path:'x',kind:'nonexistent'}]});
      C.widgets.registerAll([{id:'a',name:'A',...ok,x:'q'},{id:'b',name:'B',...ok,x:'q'}]);
      const e=C.validate().errors;
      assert.strictEqual(e.length,1);
      assert.match(e[0],/"nonexistent", which is not a known kind/);
    });
    test('kinds may be defined and filled in any order',()=>{
      const C=setup();
      C.defineKind('a',{label:'A',refs:[{path:'b',kind:'b'}]});
      C.a.register({id:'x',name:'X',...ok,b:'y'});
      C.defineKind('b',{label:'B'});
      assert.ok(!C.validate().ok);
      C.b.register({id:'y',name:'Y',...ok});
      assert.ok(C.validate().ok);
    });
    test('crossCheck gets lookups and can fail or throw',()=>{
      const C=setup();
      C.defineKind('feats',{label:'Feat'});
      C.defineKind('choices',{label:'Choice',crossCheck(def,x){
        const n=x.list('feats').filter(f=>f.category===def.category).length;
        if(!n)x.fail('no feat has category "'+def.category+'"');
        if(def.boom)throw new Error('exploded');
        if(!x.has('feats','alert')&&def.needsAlert)x.fail('alert is missing');
        if(x.get('feats','alert')&&def.id==='c1')x.fail('found alert');
      }});
      C.feats.register({id:'alert',name:'Alert',...ok,category:'origin'});
      C.choices.register({id:'c1',name:'C1',...ok,category:'origin'});
      C.choices.register({id:'c2',name:'C2',...ok,category:'epic',boom:true});
      assert.deepStrictEqual(C.validate().errors,[
        'Choice "c1": found alert',
        'Choice "c2": no feat has category "epic"',
        'Choice "c2": exploded'
      ]);
    });
    test('checks the older registries too: encounters refer to maps, characters and monsters',()=>{
      const C=setup();
      const enc=(over)=>Object.assign({id:'e',name:'E',map:'m',playerCharacter:'hero',enemies:[{monster:'gob',spawnZone:'z',count:1}]},over);
      C.maps.register({id:'m',name:'M',environments:['forest'],bounds:{x:50,z:50},seed:1,build(){},playerSpawn:{x:0,z:20,w:5,d:5},enemySpawns:[{id:'z',x:0,z:-20,w:5,d:5}]});
      C.monsters.register({id:'gob',name:'Gob',factory(){}});
      C.characters.register({id:'hero',name:'Hero',factory(){}});
      C.encounters.register(enc());
      assert.ok(C.validate().ok);
      C.encounters.register(enc({id:'e2',map:'nomap',playerCharacter:'nohero',enemies:[{monster:'nogob',spawnZone:'z',count:1}]}));
      C.encounters.register(enc({id:'e3',playerCharacter:undefined}));
      assert.deepStrictEqual(C.validate().errors,[
        'Encounter "e2": map refers to unknown maps "nomap"',
        'Encounter "e2": playerCharacter refers to unknown characters "nohero"',
        'Encounter "e2": enemies[0].monster refers to unknown monsters "nogob"'
      ]);
    });
    test('lookup and has work across old and new registries',()=>{
      const C=setup();
      C.defineKind('gizmos',{label:'Gizmo'}).register({id:'a',name:'A',...ok});
      C.monsters.register({id:'m',name:'M',factory(){}});
      assert.ok(C.has('gizmos','a')&&C.has('monsters','m'));
      assert.ok(!C.has('gizmos','b')&&!C.has('nothing','a')&&!C.has('zones','a'));
      assert.strictEqual(C.lookup('monsters','m').name,'M');
    });
  });
};
