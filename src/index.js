import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { finiteBounds, framingDistance, resizeDistance } from './framing.js';

let instance=0;
export function mountLab(host, createExperiment, options={}) {
  const prefix=`graphics-tool-${++instance}`;
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
  host.classList.add('graphics-workbench');
  const workspace=el('div','graphics-workbench__workspace'),panel=el('div','graphics-workbench__controls'),view=el('div','graphics-workbench__view'),viewport=el('div','graphics-workbench__viewport'),toolbar=el('div','graphics-workbench__toolbar'),status=el('p','graphics-workbench__status','Preparing geometry…');
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  view.append(viewport,toolbar,status);workspace.append(panel,view);host.append(workspace);
  let renderer;
  try { renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); }
  catch(error) { workspace.remove(); throw error; }
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x142321,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
  renderer.localClippingEnabled=true;
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Interactive 3D viewport. Drag to orbit, scroll to zoom. Tool instructions and controls are alongside the viewport.');viewport.append(canvas);
  const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
  scene.add(new THREE.HemisphereLight(0xe9f6e5,0x364847,1.65));
  for(const [x,y,z,power] of [[5,9,7,2.0],[-7,4,-5,.9]]){const light=new THREE.DirectionalLight(0xffffff,power);light.position.set(x,y,z);scene.add(light);}
  const camera=new THREE.PerspectiveCamera(38,1,.01,1000);camera.position.set(6,4,7);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.13;controls.minDistance=.15;controls.maxDistance=100;controls.target.set(0,0,0);
  const listeners=[],frames=new Set(),downloads=new Set();let dirty=true,disposed=false,visible=true,contextLost=false,elapsed=0,last=performance.now(),raf,statusText='Preparing geometry…';
  const invalidate=()=>{dirty=true;};
  function listen(target,type,fn,config){target.addEventListener(type,fn,config);listeners.push(()=>target.removeEventListener(type,fn,config));return fn;}
  controls.addEventListener('change',invalidate);
  const id=()=>`${prefix}-${panel.querySelectorAll('input,select,button').length}`;
  function field(label){const wrap=el('label','graphics-workbench__field'),caption=el('span','graphics-workbench__label',label);wrap.append(caption);panel.append(wrap);return {wrap,caption};}
  function action(fn){return (...args)=>{try{const r=fn(...args);if(r?.catch)r.catch(error=>setStatus(`Unable to complete: ${error.message}`));invalidate();}catch(error){setStatus(`Unable to complete: ${error.message}`);}};}
  const ui={
    button(label,fn,{primary=false}={}){const b=el('button',primary?'is-primary':'',label);b.type='button';listen(b,'click',action(fn));panel.append(b);return b;},
    range(label,{min,max,step=1,value,onChange}){const {wrap,caption}=field(label),input=el('input'),output=el('output');input.type='range';input.id=id();input.min=min;input.max=max;input.step=step;input.value=value;wrap.htmlFor=input.id;input.setAttribute('aria-label',label);output.htmlFor=input.id;output.setAttribute('aria-hidden','true');output.value=String(value);caption.append(output);wrap.append(input);listen(input,'input',action(()=>{output.value=input.value;onChange(Number(input.value));}));return input;},
    select(label,values,value,onChange){const {wrap}=field(label),s=el('select');s.id=id();for(const item of values){const o=el('option','',typeof item==='string'?item:item.label);o.value=typeof item==='string'?item:item.value;s.append(o);}s.value=value;wrap.append(s);listen(s,'change',action(()=>onChange(s.value)));return s;},
    toggle(label,value,onChange){const {wrap,caption}=field(label),i=el('input');wrap.classList.add('graphics-workbench__toggle');i.type='checkbox';i.checked=value;i.id=id();wrap.insertBefore(i,caption);listen(i,'change',action(()=>onChange(i.checked)));return i;},
    file(label,onFile,{accept='.obj'}={}){const {wrap}=field(label),i=el('input');i.type='file';i.accept=accept;i.id=id();wrap.append(i);listen(i,'change',action(()=>i.files[0]&&onFile(i.files[0])));return i;},
    note(text){const p=el('p','graphics-workbench__note',text);panel.append(p);return p;},
    section(text){const h=el('h3','graphics-workbench__section',text);panel.append(h);return h;},
  };
  function setStatus(text){statusText=text;if(!contextLost)status.textContent=text;invalidate();}
  listen(canvas,'webglcontextlost',event=>{event.preventDefault();contextLost=true;status.textContent='Graphics paused. Waiting for the browser to restore the 3D view…';});
  listen(canvas,'webglcontextrestored',()=>{contextLost=false;last=performance.now();status.textContent=statusText;invalidate();});
  function clippingPlanes(distance){camera.near=Math.max(.001,distance/1000);camera.far=Math.max(100,distance*40);controls.maxDistance=Math.max(30,distance*5);}
  function fit(object=root){
    const box=finiteBounds(object);if(!box)return;
    const center=box.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(1,.72,1.1).normalize();
    const d=framingDistance(box,center,direction,camera.up,camera.fov,camera.aspect);
    controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,d);clippingPlanes(d);camera.updateProjectionMatrix();controls.update();invalidate();
  }
  function download(filename,content,mime='text/plain'){const blob=content instanceof Blob?content:new Blob([content],{type:mime});const url=URL.createObjectURL(blob);downloads.add(url);const a=el('a');a.href=url;a.download=filename;a.click();setTimeout(()=>{URL.revokeObjectURL(url);downloads.delete(url);},10000);}
  const pointer=event=>{const r=canvas.getBoundingClientRect();return new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);};
  const raycaster=new THREE.Raycaster();
  const ctx={THREE,scene,root,camera,renderer,canvas,controls,ui,setStatus,listen,invalidate,fit,pointer,download,
    reducedMotion:options.reducedMotion??matchMedia('(prefers-reduced-motion: reduce)').matches,
    palette:{body:0xb8cd99,accent:0xd99976,dark:0x20382e,metal:0xa6bab2,cream:0xe7ece1},
    onFrame(fn){frames.add(fn);return()=>frames.delete(fn);},
    pick(event,objects=root.children){root.updateWorldMatrix(true,true);camera.updateMatrixWorld();raycaster.setFromCamera(pointer(event),camera);return raycaster.intersectObjects(Array.isArray(objects)?objects:[objects],true);},
    exportOBJ(object=root,filename='model.obj'){object.updateWorldMatrix(true,true);download(filename,new OBJExporter().parse(object),'text/plain');},
  };
  function toolButton(label,fn){const b=el('button','',label);b.type='button';listen(b,'click',action(fn));toolbar.append(b);}
  const rotate=amount=>{const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),amount);camera.position.copy(controls.target).add(offset);controls.update();invalidate();};
  toolButton('Rotate left',()=>rotate(-Math.PI/12));toolButton('Rotate right',()=>rotate(Math.PI/12));
  listen(canvas,'keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();rotate(event.key==='ArrowLeft'?-Math.PI/12:Math.PI/12);}else if(event.key==='Home'){event.preventDefault();fit();}});
  toolButton('Reset view',()=>fit());toolButton('Save PNG',()=>{renderer.render(scene,camera);canvas.toBlob(blob=>blob&&download('experiment.png',blob,'image/png'));});
  const hint=el('span','','Drag to orbit · scroll to zoom');toolbar.append(hint);
  function resize(){
    const width=viewport.clientWidth,height=viewport.clientHeight;if(!width||!height)return;
    const aspect=width/height;
    if(Math.abs(aspect-camera.aspect)>1e-6){
      try{const box=finiteBounds(root);if(box){const {direction,distance}=resizeDistance(box,controls.target,camera.position,camera.up,camera.fov,camera.aspect,aspect);camera.position.copy(controls.target).addScaledVector(direction,distance);clippingPlanes(distance);}}
      catch(error){setStatus(error.message);}
    }
    renderer.setSize(width,height,false);camera.aspect=aspect;camera.updateProjectionMatrix();controls.update();invalidate();
  }
  const observer=new ResizeObserver(resize);observer.observe(viewport);resize();
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=performance.now();if(visible)invalidate();},{rootMargin:'100px'});intersection.observe(viewport);
  let experiment;
  try{experiment=createExperiment(ctx)||{};fit();}catch(error){dispose();throw error;}
  const animate=now=>{if(disposed)return;raf=requestAnimationFrame(animate);const dt=Math.min(1/30,(now-last)/1000);last=now;if(!visible||document.hidden||contextLost)return;elapsed+=dt;for(const frame of frames)frame(dt,elapsed);if(controls.update())dirty=true;if(dirty){renderer.render(scene,camera);dirty=false;}};raf=requestAnimationFrame(animate);
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);experiment?.dispose?.();observer.disconnect();intersection.disconnect();listeners.forEach(off=>off());frames.clear();controls.dispose();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();downloads.forEach(URL.revokeObjectURL);host.replaceChildren();};
  return {dispose,ctx};
}
