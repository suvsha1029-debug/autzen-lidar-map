'use client';
import { useEffect, useRef, useState } from 'react';
import { Layers3, RotateCcw, Plus, Minus, MoveUpRight, Scan, MapPin, ExternalLink, Orbit, Mountain, MousePointer2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createViewer, type MapViewer, type MapMeta } from './viewer';

export default function Home() {
  const canvas=useRef<HTMLCanvasElement>(null), engine=useRef<MapViewer|null>(null);
  const [meta,setMeta]=useState<MapMeta|null>(null),[error,setError]=useState('');
  const [mode,setMode]=useState('elevation'),[size,setSize]=useState(2.1),[height,setHeight]=useState(1),[ground,setGround]=useState(false),[spin,setSpin]=useState(false);
  useEffect(()=>{
    let cancelled=false;const controller=new AbortController();
    Promise.all([fetch('./data/metadata.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Survey details could not be loaded.');return r.json();}),fetch('./data/points.bin',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Point cloud could not be loaded.');return r.arrayBuffer();})]).then(([m,b])=>{if(cancelled||!canvas.current)return;engine.current=createViewer(canvas.current,b,m);setMeta(m);}).catch(e=>{if(!cancelled)setError(e.message||'Unable to open the 3D view.');});
    return()=>{cancelled=true;controller.abort();engine.current?.dispose();engine.current=null;};
  },[]);
  useEffect(()=>{engine.current?.configure({mode,size,height,ground,spin});},[mode,size,height,ground,spin,meta]);
  useEffect(()=>{
    type Context={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>Promise<unknown>},options:{signal:AbortSignal})=>void|Promise<void>};
    const context=(document as Document & {modelContext?:Context}).modelContext;
    if(!context?.registerTool||!meta)return;
    const lifecycle=new AbortController();
    try{void Promise.resolve(context.registerTool({name:'configure_lidar_view',description:'Set the visible LiDAR map camera, color mode, vertical scale, and ground filter.',inputSchema:{type:'object',properties:{camera:{type:'string',enum:['top','perspective']},color:{type:'string',enum:['elevation','rgb','class']},verticalScale:{type:'number',minimum:1,maximum:4},groundOnly:{type:'boolean'}},required:['camera','color','verticalScale','groundOnly'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{
      const v=input as {camera:'top'|'perspective';color:string;verticalScale:number;groundOnly:boolean};
      if(!v||!['top','perspective'].includes(v.camera)||!['elevation','rgb','class'].includes(v.color)||!Number.isFinite(v.verticalScale)||v.verticalScale<1||v.verticalScale>4||typeof v.groundOnly!=='boolean'||Object.keys(v).some(k=>!['camera','color','verticalScale','groundOnly'].includes(k)))throw Error('Invalid map settings.');
      if(!engine.current)throw Error('Map is not ready.');
      setMode(v.color);setHeight(v.verticalScale);setGround(v.groundOnly);setSpin(false);engine.current.preset(v.camera);
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      return {camera:v.camera,color:v.color,verticalScale:v.verticalScale,groundOnly:v.groundOnly,visiblePointCount:v.groundOnly?meta.classCounts['2']||0:meta.pointCount};
    }},{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser API. */}
    return()=>lifecycle.abort();
  },[meta]);
  return <main className="app-shell">
    <header className="masthead"><div className="brand"><span className="brand-mark"><Layers3 size={23}/></span><strong>FIELD<span> / </span>ATLAS</strong><span className="brand-label">LiDAR explorer</span></div><div className="live-label"><i/>Open survey data</div></header>
    <div className="workspace"><aside className="control-panel">
      <div className="place"><div className="eyebrow">OREGON, UNITED STATES</div><h1>Autzen<br/>from above.</h1><p>A landscape of measured points.</p><div className="location"><MapPin size={15}/>Eugene · stadium & surroundings</div></div>
      <div className="survey-stat"><span className="stat-number">{meta?((ground ? meta.classCounts['2'] || 0 : meta.pointCount)/1000).toFixed(0):'—'}<small>k</small></span><div>LiDAR returns<br/><span>in this view</span></div><Scan size={29}/></div>
      <section><h2><Layers3 size={16}/>Appearance</h2><label className="control-label" id="color-label">Color by</label><Select value={mode} onValueChange={v=>v&&setMode(v)}><SelectTrigger aria-labelledby="color-label" className="map-select"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="elevation">Elevation</SelectItem><SelectItem value="rgb">Survey RGB</SelectItem><SelectItem value="class">Point classification</SelectItem></SelectContent></Select>
      <div className="slider-heading"><label id="size-label">Point size</label><output>{size.toFixed(1)} px</output></div><Slider aria-labelledby="size-label" min={1} max={5} step={.1} value={[size]} onValueChange={v=>setSize(Array.isArray(v)?v[0]:v)}/>
      <div className="slider-heading"><label id="height-label">Vertical scale</label><output>{height.toFixed(1)}×</output></div><Slider aria-labelledby="height-label" min={1} max={4} step={.1} value={[height]} onValueChange={v=>setHeight(Array.isArray(v)?v[0]:v)}/>{height>1&&<p className="small-note">Heights are exaggerated for visibility.</p>}</section>
      <section className="toggles"><label htmlFor="ground">Ground returns only<Switch id="ground" checked={ground} onCheckedChange={setGround}/></label><label htmlFor="spin">Slow camera orbit<Switch id="spin" checked={spin} onCheckedChange={setSpin}/></label></section>
      <section><h2><Mountain size={16}/>Survey extent</h2><dl><div><dt>Coverage</dt><dd>{meta?`${meta.width.toFixed(0)} × ${meta.depth.toFixed(0)} m`:'Loading…'}</dd></div><div><dt>Elevation</dt><dd>{meta?`${meta.minElevation.toFixed(1)}–${meta.maxElevation.toFixed(1)} m`:'—'}</dd></div><div><dt>Coordinates</dt><dd>Local metric view</dd></div></dl></section>
      <div className="source"><span className="eyebrow">SOURCE & METHOD</span><p>PDAL open Autzen LiDAR sample. Original returns are cropped and sampled for this viewer; no terrain is invented.</p><a href="https://github.com/PDAL/data/tree/main/autzen" target="_blank" rel="noreferrer">Explore the source<ExternalLink size={13}/></a><a href="./data/metadata.json" target="_blank" rel="noreferrer">Survey metadata<ExternalLink size={13}/></a></div>
    </aside><section className="map-panel" aria-label="Interactive 3D LiDAR map">
      <canvas ref={canvas} tabIndex={0} aria-label="3D point cloud. Drag to orbit, right drag to pan, scroll to zoom. Arrow keys pan, plus and minus zoom, R resets."/>
      <div className="map-top"><div className="map-caption"><span className="map-tag">3D POINT CLOUD</span><p>Autzen Stadium <span>/</span> Eugene</p></div><div className="view-buttons"><button onClick={()=>{engine.current?.preset('perspective');setSpin(false);}}><Orbit size={16}/>3D</button><button onClick={()=>{engine.current?.preset('top');setSpin(false);}}><MoveUpRight size={16}/>Top</button></div></div>
      {!meta&&<div className="loading-card" role="status"><Scan size={28}/><strong>{error?'The map couldn’t open':'Opening the survey'}</strong><p>{error||'Loading real LiDAR returns…'}</p>{error&&<button onClick={()=>window.location.reload()}>Try again</button>}</div>}
      <div className="map-tools"><button aria-label="Zoom in" title="Zoom in" onClick={()=>engine.current?.zoom(.8)}><Plus/></button><button aria-label="Zoom out" title="Zoom out" onClick={()=>engine.current?.zoom(1.25)}><Minus/></button><span/><button aria-label="Reset camera" title="Reset camera" onClick={()=>{engine.current?.preset('perspective');setSpin(false);}}><RotateCcw size={20}/></button></div>
      <div className="legend">{mode==='elevation'?<><span>ELEVATION · METERS</span><div className="ramp"/><div className="legend-values"><span>{meta?.minElevation.toFixed(0)??'—'}</span><span>{meta?.maxElevation.toFixed(0)??'—'}</span></div></>:mode==='class'?<><span>POINT CLASSIFICATION</span><p><i style={{background:'#48ccb4'}}/>Ground</p><p><i style={{background:'#9cb3ca'}}/>Unclassified returns</p></>:<><span>SURVEY RGB</span><p>Colors stored in the source scan</p></>}</div>
      <div className="navigation-hint"><MousePointer2 size={15}/><span>Drag to orbit</span><b>·</b><span>Scroll to zoom</span><b>·</b><span>Right-drag to pan</span></div>
      <div className="map-footer"><span><i/>{meta?'Survey ready':error?'Load failed':'Loading survey'}</span><span>North is up in top view · 1× = true scale</span></div>
    </section></div>
  </main>;
}
