import type * as THREE from 'three';

export type RenderBounds = { left:number; top:number; width:number; height:number };
/** Internal scenes share one transparent renderer and its visibility/frame budget. */
export interface SharedSceneView {
  id:string;
  element:HTMLElement;
  scene:THREE.Scene;
  camera:THREE.Camera;
  toneMapping?:THREE.ToneMapping;
  toneMappingExposure?:number;
  measure(viewport:{width:number;height:number}):RenderBounds|null;
  update(now:number,dt:number):void;
  isAnimating():boolean;
  setEnabled(value:boolean):void;
  setHeroMode(mode:'paper'|'field'):void;
  setQuality?(detail:number):void;
  presented?():void;
  dispose():void;
}
