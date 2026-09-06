import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type MapMeta={pointCount:number;width:number;depth:number;minElevation:number;maxElevation:number;classCounts:Record<string,number>};
type Settings={mode:string;size:number;height:number;ground:boolean;spin:boolean};
export type MapViewer={configure:(s:Settings)=>void;preset:(s:'top'|'perspective')=>void;zoom:(f:number)=>void;dispose:()=>void};

export function createViewer(canvas:HTMLCanvasElement,buffer:ArrayBuffer,meta:MapMeta):MapViewer {
  if(buffer.byteLength!==meta.pointCount*16)throw Error('The survey download is incomplete. Please reload.');
  const count=meta.pointCount, xyz=new Float32Array(count*3), rgb=new Float32Array(count*3), elevation=new Float32Array(count*3), classes=new Float32Array(count*3), groundIds:number[]=[];
  const data=new DataView(buffer), palette=['#3976b8','#48babe','#b5e279','#ffc164','#f3868b'].map(c=>new THREE.Color(c));
  const classPalette:Record<number,THREE.Color>={2:new THREE.Color('#48ccb4'),3:new THREE.Color('#a8d66d'),4:new THREE.Color('#a8d66d'),5:new THREE.Color('#a8d66d'),6:new THREE.Color('#ffb969')};
  const other=new THREE.Color('#9cb3ca'),color=new THREE.Color();
  const range=Math.max(.01,meta.maxElevation-meta.minElevation);
  for(let i=0;i<count;i++){
    const offset=i*16;
    xyz[i*3]=data.getFloat32(offset,true);xyz[i*3+1]=data.getFloat32(offset+4,true);xyz[i*3+2]=data.getFloat32(offset+8,true);
    color.setRGB(data.getUint8(offset+12)/255,data.getUint8(offset+13)/255,data.getUint8(offset+14)/255,THREE.SRGBColorSpace).toArray(rgb,i*3);
    const t=THREE.MathUtils.clamp(xyz[i*3+1]/range,0,1)*4, k=Math.min(3,Math.floor(t));
    color.copy(palette[k]).lerp(palette[k+1],t-k).toArray(elevation,i*3);
    const cls=data.getUint8(offset+15);(classPalette[cls]||other).toArray(classes,i*3);if(cls===2)groundIds.push(i);
  }
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});}catch{throw Error('WebGL is unavailable. Enable browser hardware acceleration and reload.');}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.1,15000);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=20;controls.maxDistance=4000;controls.maxPolarAngle=Math.PI*.495;controls.autoRotateSpeed=.35;controls.keyPanSpeed=20;controls.listenToKeyEvents(canvas);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(xyz,3));geometry.setAttribute('color',new THREE.BufferAttribute(elevation,3));geometry.computeBoundingSphere();
  const material=new THREE.PointsMaterial({size:2.1,sizeAttenuation:false,vertexColors:true});
  // Circular splats retain point-cloud character without square fragments.
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n if(length(gl_PointCoord-vec2(0.5))>0.5) discard;');};
  const points=new THREE.Points(geometry,material);scene.add(points);
  const grid=new THREE.GridHelper(1200,12,0x314451,0x20313e);grid.position.y=-2;scene.add(grid);
  const borderPoints=[[-425,0,-400],[425,0,-400],[425,0,400],[-425,0,400],[-425,0,-400]].map(p=>new THREE.Vector3(...p as [number,number,number]));
  const borderGeometry=new THREE.BufferGeometry().setFromPoints(borderPoints),borderMaterial=new THREE.LineBasicMaterial({color:0x65888c,transparent:true,opacity:.5});scene.add(new THREE.Line(borderGeometry,borderMaterial));
  // A metric scale and north arrow are map annotations, not reconstructed surfaces.
  const north=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(475,0,-270),100,0xa7eb80,16,9);scene.add(north);
  let currentMode='elevation',currentGround=false,disposed=false;
  const preset=(kind:'top'|'perspective')=>{
    controls.autoRotate=false;controls.target.set(0,12,0);
    const aspect=canvas.clientWidth/Math.max(1,canvas.clientHeight),fit=Math.max(meta.depth,meta.width/Math.max(.35,aspect));
    if(kind==='top')camera.position.set(0,fit*1.4,1);
    else camera.position.set(fit*.64,fit*.8,fit*.92);
    controls.update();
  };
  const zoom=(factor:number)=>{const delta=camera.position.clone().sub(controls.target);const d=THREE.MathUtils.clamp(delta.length()*factor,controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(delta.setLength(d));controls.update();};
  const key=(event:KeyboardEvent)=>{if(event.key==='+'||event.key==='='){event.preventDefault();zoom(.85);}if(event.key==='-'){event.preventDefault();zoom(1.18);}if(event.key.toLowerCase()==='r'){event.preventDefault();preset('perspective');}};
  canvas.addEventListener('keydown',key);
  const focus=()=>canvas.focus({preventScroll:true});canvas.addEventListener('pointerdown',focus);
  const resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();preset('perspective');
  let last=performance.now();renderer.setAnimationLoop(now=>{if(disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden)return;controls.update(dt);renderer.render(scene,camera);});
  renderer.render(scene,camera);
  return {
    configure(s){if(disposed)return;if(s.mode!==currentMode){geometry.setAttribute('color',new THREE.BufferAttribute(s.mode==='rgb'?rgb:s.mode==='class'?classes:elevation,3));currentMode=s.mode;}if(s.ground!==currentGround){geometry.setIndex(s.ground?groundIds:null);currentGround=s.ground;}points.scale.y=s.height;material.size=s.size;controls.autoRotate=s.spin;},preset,zoom,
    dispose(){disposed=true;renderer.setAnimationLoop(null);observer.disconnect();canvas.removeEventListener('keydown',key);canvas.removeEventListener('pointerdown',focus);controls.dispose();geometry.dispose();material.dispose();grid.geometry.dispose();(grid.material as THREE.Material).dispose();borderGeometry.dispose();borderMaterial.dispose();north.dispose();renderer.dispose();}
  };
}
