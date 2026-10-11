import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selection,moveSelection,resizeSelection,settings} from '../src/photo-tools/selection.ts';
test('crop rectangle and export settings round trip for square and portrait',()=>{
 for(const ratio of [1,35/45]) {const r=selection(1200,600,ratio,3,75,30);const state=settings(r,1200,600);assert.ok(Math.abs(state.zoom-3)<1e-8);assert.ok(Math.abs(state.x-75)<1e-8);assert.ok(Math.abs(state.y-30)<1e-8);}
});
test('moving the box is bounded by the full image',()=>{
 const rect=selection(1200,600,1,2,50,50);const moved=moveSelection(rect,5000,-5000,1200,600);assert.equal(moved.x,900);assert.equal(moved.y,0);
});
test('all four corners resize with a fixed opposite corner and preserve proportions',()=>{
 const r={x:300,y:100,width:280,height:360};
 for(const corner of ['nw','ne','sw','se']){
 const next=resizeSelection(r,corner,40,30,1200,800);assert.ok(Math.abs(next.width/next.height-280/360)<1e-8);
 assert.ok(Math.abs((corner.endsWith('e')?next.x:next.x+next.width)-(corner.endsWith('e')?r.x:r.x+r.width))<1e-8);
 assert.ok(Math.abs((corner.startsWith('s')?next.y:next.y+next.height)-(corner.startsWith('s')?r.y:r.y+r.height))<1e-8);
 }
});
test('resizing cannot leave image boundaries or collapse selection',()=>{
 const r=selection(1200,600,1,2,50,50);
 for(const corner of ['nw','ne','sw','se'])for(const delta of [-5000,5000]){
 const next=resizeSelection(r,corner,delta,delta,1200,600);assert.ok(next.width>=50-1e-8);assert.ok(next.x>=-1e-8 && next.y>=-1e-8 && next.x+next.width<=1200+1e-8 && next.y+next.height<=600+1e-8);
 }
});
