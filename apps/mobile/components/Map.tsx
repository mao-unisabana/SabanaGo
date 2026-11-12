import { useEffect, useMemo, useRef, type ComponentType, type Ref } from 'react'
import { View } from 'react-native'
import { theme } from '../lib/theme'
import { WebView as RNWebView, type WebViewProps } from 'react-native-webview'

// react-native-webview@14 aún no cuadra con los tipos de clase de React 19.3
// (la sobrecarga del constructor resuelve props a `never`). El runtime está bien;
// esto solo re-declara el componente con sus props para que tsc lo acepte.
const WebView = RNWebView as unknown as ComponentType<WebViewProps & { ref?: Ref<RNWebView> }>

export type LatLng = [number, number]
export type Mode = 'view' | 'spot' | 'row' | 'zone' | 'lane'

/** Contorno de un parqueadero a pintar sobre el mapa. */
export interface ZoneGeo {
  id: string
  ring: LatLng[] // [lng, lat], abierto
  active: boolean
}

export type SpotStatus = 'free' | 'occupied' | 'no_data'

export interface SpotFeature {
  type: 'Feature'
  id: number
  properties: { id: number; batch: number; status: SpotStatus }
  geometry: { type: 'Polygon'; coordinates: number[][][] }
}

export interface Counts {
  free: number
  occupied: number
  noData: number
  total: number
}

/** Etiqueta de un parqueadero inactivo que se pinta sobre el mapa. */
export interface LotLabel {
  id: string
  name: string
  free: number
  total: number
  center: LatLng // [lng, lat] (listo para MapLibre)
}

// Estilo "Voyager" de CARTO (vectorial, MapLibre) — el mapa de Parchate. Su
// style.json y sus vector-tiles son keyless; CARTO solo cerró los tiles raster.
const CARTO_VOYAGER = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'

interface Props {
  userLoc?: LatLng | null
  fallback?: LatLng
  zoom?: number
  /** 'view': alterna/selecciona · 'spot': añade uno · 'row': fila · 'zone': contorno. */
  mode?: Mode
  /** Orientación (grados) de los espacios sueltos ('spot'). */
  angle?: number
  undoNonce?: number
  clearNonce?: number
  /** Incrementa para cerrar el trazo en curso (zona o carril). */
  finishNonce?: number
  /** Carriles del parqueadero activo (polilíneas [lng,lat]). */
  lanes?: LatLng[][]
  /** Parqueadero activo: sus espacios se dibujan y se editan. */
  activeId?: string | null
  activeSpots?: SpotFeature[]
  /** Parqueaderos inactivos: se pintan como etiquetas tocables. */
  labels?: LotLabel[]
  /** Contornos de todos los parqueaderos que tengan zona. */
  zones?: ZoneGeo[]
  /** Cupo destino [lng,lat]: traza la línea desde el usuario y lo resalta. */
  target?: LatLng | null
  /** El activo cambió sus espacios (dibujar/ocupar/deshacer/borrar). */
  onSpots?: (spots: SpotFeature[]) => void
  /** Se cerró una zona: anillo [lng,lat] para el parqueadero activo. */
  onZone?: (ring: LatLng[]) => void
  /** Se cerró un carril: polilínea [lng,lat] para el parqueadero activo. */
  onLane?: (line: LatLng[]) => void
  /** Tocaron la etiqueta o la zona de otro parqueadero. */
  onSelectLot?: (id: string) => void
}

const DEFAULT_CENTER: LatLng = [4.6534, -74.0836]

/**
 * Mapa real (MapLibre + estilo Voyager de CARTO, keyless) dentro de un WebView.
 * Dibuja los espacios del parqueadero ACTIVO (editables) y una etiqueta por cada
 * parqueadero inactivo; tocar una etiqueta selecciona ese parqueadero. Los datos
 * los posee React Native (que persiste); aquí solo se pintan e inyectan.
 */
export function Map({
  userLoc,
  fallback = DEFAULT_CENTER,
  zoom = 18,
  mode = 'view',
  angle = 0,
  undoNonce = 0,
  clearNonce = 0,
  finishNonce = 0,
  activeId = null,
  activeSpots = [],
  labels = [],
  zones = [],
  target = null,
  lanes = [],
  onSpots,
  onZone,
  onLane,
  onSelectLot,
}: Props) {
  const ref = useRef<RNWebView>(null)
  // Espacios del activo en un ref: se inyectan al CAMBIAR de parqueadero, no en
  // cada edición (esas vienen del propio WebView y re-inyectar las pisaría).
  const activeSpotsRef = useRef(activeSpots)
  activeSpotsRef.current = activeSpots
  const lastLabels = useRef('')
  const lastZones = useRef('')
  const lastLanes = useRef('')

  const html = useMemo(() => buildHtml(fallback, zoom), [fallback, zoom])

  useEffect(() => {
    inject(ref, `window.setActive&&window.setActive(${JSON.stringify(activeSpotsRef.current)})`)
  }, [activeId])

  useEffect(() => {
    const json = JSON.stringify(labels)
    if (json === lastLabels.current) return
    lastLabels.current = json
    inject(ref, `window.setLots&&window.setLots(${json})`)
  }, [labels])

  useEffect(() => {
    const json = JSON.stringify(zones)
    if (json === lastZones.current) return
    lastZones.current = json
    inject(ref, `window.setZones&&window.setZones(${json})`)
  }, [zones])

  useEffect(() => {
    if (finishNonce) inject(ref, `window.finishDraft&&window.finishDraft()`)
  }, [finishNonce])

  useEffect(() => {
    const json = JSON.stringify(lanes)
    if (json === lastLanes.current) return
    lastLanes.current = json
    inject(ref, `window.setLanes&&window.setLanes(${json})`)
  }, [lanes])

  useEffect(() => {
    if (target && userLoc)
      inject(ref, `window.setTarget&&window.setTarget(${target[0]},${target[1]},${userLoc[1]},${userLoc[0]})`)
    else inject(ref, `window.clearTarget&&window.clearTarget()`)
  }, [target, userLoc])

  useEffect(() => {
    if (userLoc) inject(ref, `window.setUser&&window.setUser(${userLoc[1]},${userLoc[0]})`)
  }, [userLoc])

  useEffect(() => {
    inject(ref, `window.setMode&&window.setMode(${JSON.stringify(mode)})`)
  }, [mode])

  useEffect(() => {
    inject(ref, `window.setAngle&&window.setAngle(${angle})`)
  }, [angle])

  useEffect(() => {
    if (undoNonce) inject(ref, `window.undoLast&&window.undoLast()`)
  }, [undoNonce])

  useEffect(() => {
    if (clearNonce) inject(ref, `window.clearSpots&&window.clearSpots()`)
  }, [clearNonce])

  // Al cargar, empuja todo el estado actual (los inject previos pudieron ser no-op).
  function onLoadEnd() {
    inject(ref, `window.setMode&&window.setMode(${JSON.stringify(mode)})`)
    inject(ref, `window.setAngle&&window.setAngle(${angle})`)
    inject(ref, `window.setActive&&window.setActive(${JSON.stringify(activeSpotsRef.current)})`)
    inject(ref, `window.setLots&&window.setLots(${JSON.stringify(labels)})`)
    inject(ref, `window.setZones&&window.setZones(${JSON.stringify(zones)})`)
    inject(ref, `window.setLanes&&window.setLanes(${JSON.stringify(lanes)})`)
    if (userLoc) inject(ref, `window.setUser&&window.setUser(${userLoc[1]},${userLoc[0]})`)
    if (target && userLoc)
      inject(ref, `window.setTarget&&window.setTarget(${target[0]},${target[1]},${userLoc[1]},${userLoc[0]})`)
  }

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <WebView
        ref={ref}
        originWhitelist={['*']}
        source={{ html }}
        onLoadEnd={onLoadEnd}
        onMessage={(e: { nativeEvent: { data: string } }) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data)
            if (msg.t === 'spots') onSpots?.(msg.spots as SpotFeature[])
            else if (msg.t === 'zone') onZone?.(msg.zone as LatLng[])
            else if (msg.t === 'lane') onLane?.(msg.line as LatLng[])
            else if (msg.t === 'selectLot') onSelectLot?.(msg.id as string)
          } catch {
            // mensaje no-JSON: ignorar
          }
        }}
        style={{ flex: 1, backgroundColor: theme.background }}
      />
    </View>
  )
}

function inject(ref: React.RefObject<RNWebView | null>, js: string) {
  ref.current?.injectJavaScript(`${js};true;`)
}

function buildHtml(center: LatLng, zoom: number): string {
  // MapLibre usa [lng, lat] (al revés que nuestro [lat, lng]).
  const c = `[${center[1]},${center[0]}]`
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.1/dist/maplibre-gl.css"/>
<style>
html,body,#map{height:100%;margin:0;background:${theme.background}}
.lot{display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;
  background:${theme.surface}F5;border:2px solid ${theme.primary};border-radius:12px;
  padding:5px 10px;box-shadow:0 3px 10px rgba(0,0,0,.25);
  font:700 13px -apple-system,Roboto,sans-serif;color:${theme.text}}
.lot span{font-weight:700;font-size:11px;color:${theme.free}}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/maplibre-gl@5.24.1/dist/maplibre-gl.js"></script>
<script>
var map=new maplibregl.Map({container:'map',style:'${CARTO_VOYAGER}',center:${c},zoom:${zoom},attributionControl:{compact:true}});
var MODE='view', ANGLE=0, spots=[], nextId=1, batch=0, draft=[], LANES=[];
var userMarker=null, rowStart=null, startMarker=null;
var pendingActive=null, pendingLabels=null, pendingZones=null, pendingRoute=null, pendingLanes=null, lotMarkers=[];

// Rayado diagonal para no_data: fondo gris con franjas claras.
function stripesImage(){
  var c=document.createElement('canvas'); c.width=c.height=16;
  var x=c.getContext('2d');
  x.fillStyle='${theme.noData}'; x.fillRect(0,0,16,16);
  x.strokeStyle='rgba(255,255,255,.6)'; x.lineWidth=3;
  x.beginPath(); x.moveTo(-4,4); x.lineTo(4,-4); x.moveTo(0,16); x.lineTo(16,0); x.moveTo(12,20); x.lineTo(20,12); x.stroke();
  return x.getImageData(0,0,16,16);
}
function fc(){return {type:'FeatureCollection',features:spots};}
function refresh(){var s=map.getSource('spots'); if(s) s.setData(fc()); post();}
function post(){
  if(!window.ReactNativeWebView) return;
  window.ReactNativeWebView.postMessage(JSON.stringify({t:'spots',spots:spots}));
}
// Rectángulo ~2.5m x 5m centrado en [lng,lat], rotado 'deg' grados (metros→grados).
function rect(lng,lat,deg){
  var hW=2.5/2, hL=5/2, a=deg*Math.PI/180;
  var mLat=111320, mLng=111320*Math.cos(lat*Math.PI/180);
  var corners=[[-hW,-hL],[hW,-hL],[hW,hL],[-hW,hL]];
  var ring=corners.map(function(p){
    var x=p[0]*Math.cos(a)-p[1]*Math.sin(a);
    var y=p[0]*Math.sin(a)+p[1]*Math.cos(a);
    return [lng + x/mLng, lat + y/mLat];
  });
  ring.push(ring[0]);
  return ring;
}
function addSpot(lng,lat,deg,b){
  spots.push({type:'Feature',id:nextId,properties:{id:nextId,batch:b,status:'free'},
    geometry:{type:'Polygon',coordinates:[rect(lng,lat,deg)]}});
  nextId++;
}
function makeRow(A,B){
  var lat=A[1], mLat=111320, mLng=111320*Math.cos(lat*Math.PI/180);
  var dx=(B[0]-A[0])*mLng, dy=(B[1]-A[1])*mLat;
  var len=Math.hypot(dx,dy); if(len<1.5) return;
  var ux=dx/len, uy=dy/len, deg=Math.atan2(dy,dx)*180/Math.PI;
  var spacing=4.5, n=Math.max(1,Math.floor(len/spacing)); // 2.5m de cuadro + ~2m de hueco
  batch++;
  for(var i=0;i<n;i++){ var d=(i+0.5)*spacing; addSpot(A[0]+(ux*d)/mLng, A[1]+(uy*d)/mLat, deg, batch); }
  refresh();
}

function applyActive(arr){
  spots=arr||[];
  nextId=spots.length?Math.max.apply(null,spots.map(function(f){return f.properties.id;}))+1:1;
  batch=spots.length?Math.max.apply(null,spots.map(function(f){return f.properties.batch||0;}))+1:0;
  if(map.getSource('spots')) refresh();
}
function zonesFc(arr){
  return {type:'FeatureCollection',features:(arr||[]).filter(function(z){return z.ring&&z.ring.length>=3;}).map(function(z){
    return {type:'Feature',properties:{id:z.id,active:!!z.active},
      geometry:{type:'Polygon',coordinates:[z.ring.concat([z.ring[0]])]}};
  })};
}
function draftFc(){
  var f=[];
  draft.forEach(function(p){f.push({type:'Feature',properties:{},geometry:{type:'Point',coordinates:p}});});
  if(draft.length>=2) f.push({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:draft}});
  // El relleno de polígono solo tiene sentido para ZONA, no para carril.
  if(MODE==='zone'&&draft.length>=3) f.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[draft.concat([draft[0]])]}});
  return {type:'FeatureCollection',features:f};
}
function refreshDraft(){var s=map.getSource('zone-draft'); if(s) s.setData(draftFc());}
function lanesFc(arr){
  return {type:'FeatureCollection',features:(arr||[]).filter(function(l){return l&&l.length>=2;}).map(function(l){
    return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:l}};
  })};
}
function renderLabels(arr){
  lotMarkers.forEach(function(m){m.remove();}); lotMarkers=[];
  (arr||[]).forEach(function(L){
    var el=document.createElement('div');
    el.className='lot';
    el.innerHTML='<b>'+L.name+'</b><span>'+L.free+'/'+L.total+' libres</span>';
    el.addEventListener('click',function(ev){
      ev.stopPropagation();
      if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({t:'selectLot',id:L.id}));
    });
    lotMarkers.push(new maplibregl.Marker({element:el}).setLngLat(L.center).addTo(map));
  });
}

map.on('load',function(){
  if(pendingActive){applyActive(pendingActive);pendingActive=null;}
  // Zonas (contornos) — debajo de todo.
  map.addSource('zones',{type:'geojson',data:zonesFc(pendingZones)});
  map.addLayer({id:'zones-fill',type:'fill',source:'zones',
    paint:{'fill-color':['case',['get','active'],'${theme.primary}','${theme.primaryLight}'],
           'fill-opacity':['case',['get','active'],0.1,0.22]}});
  map.addLayer({id:'zones-line',type:'line',source:'zones',
    paint:{'line-color':'${theme.primary}','line-width':2,'line-dasharray':[2,1]}});
  // Carriles del parqueadero activo.
  map.addSource('lanes',{type:'geojson',data:lanesFc(pendingLanes||LANES)});
  if(pendingLanes){LANES=pendingLanes;pendingLanes=null;}
  map.addLayer({id:'lanes-line',type:'line',source:'lanes',
    paint:{'line-color':'${theme.lane}','line-width':3,'line-dasharray':[1,1],'line-opacity':0.7}});
  // Espacios — encima de las zonas.
  map.addSource('spots',{type:'geojson',data:fc()});
  // Estado desconocido (o no_data) nunca se pinta como libre.
  var KNOWN=['match',['get','status'],['free','occupied'],true,false];
  map.addImage('stripes',stripesImage());
  map.addLayer({id:'spots-fill',type:'fill',source:'spots',filter:KNOWN,
    paint:{'fill-color':['match',['get','status'],'occupied','${theme.occupied}','${theme.freeFill}'],'fill-opacity':0.9}});
  map.addLayer({id:'spots-nodata',type:'fill',source:'spots',filter:['!',KNOWN],
    paint:{'fill-pattern':'stripes','fill-opacity':0.9}});
  map.addLayer({id:'spots-line',type:'line',source:'spots',
    paint:{'line-color':['match',['get','status'],'free','${theme.free}','occupied','${theme.occupied}','${theme.noData}'],'line-width':1.5}});
  // ✕ blanca sobre los ocupados (glifos del estilo de CARTO).
  map.addLayer({id:'spots-x',type:'symbol',source:'spots',filter:['==',['get','status'],'occupied'],
    layout:{'text-field':'✕','text-font':['Montserrat SemiBold','Open Sans Bold'],'text-size':14,'text-allow-overlap':true,'text-ignore-placement':true},
    paint:{'text-color':'#ffffff'}});
  // Ruta al cupo (línea + punto destino) — encima de los espacios.
  map.addSource('route',{type:'geojson',data:pendingRoute||{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'route-line',type:'line',source:'route',filter:['==','$type','LineString'],
    paint:{'line-color':'${theme.primary}','line-width':4,'line-dasharray':[1.5,1]}});
  map.addLayer({id:'route-pt',type:'circle',source:'route',filter:['==','$type','Point'],
    paint:{'circle-radius':11,'circle-color':'${theme.free}','circle-stroke-color':'#fff','circle-stroke-width':3}});
  pendingRoute=null;
  // Borrador de zona en curso — encima de todo.
  map.addSource('zone-draft',{type:'geojson',data:draftFc()});
  map.addLayer({id:'zd-fill',type:'fill',source:'zone-draft',
    filter:['==','$type','Polygon'],paint:{'fill-color':'${theme.primary}','fill-opacity':0.15}});
  map.addLayer({id:'zd-line',type:'line',source:'zone-draft',
    filter:['==','$type','LineString'],paint:{'line-color':'${theme.primary}','line-width':2}});
  map.addLayer({id:'zd-pts',type:'circle',source:'zone-draft',
    filter:['==','$type','Point'],paint:{'circle-radius':5,'circle-color':'${theme.primary}','circle-stroke-color':'#fff','circle-stroke-width':2}});
  pendingZones=null;
  if(pendingLabels){renderLabels(pendingLabels);pendingLabels=null;}
  post();
});

function clearStart(){ if(startMarker){startMarker.remove();startMarker=null;} rowStart=null; }

function box(p,r){return [[p.x-r,p.y-r],[p.x+r,p.y+r]];}

// Pega un punto al carril más cercano (vértice o tramo) si está a <6m — así los
// carriles se enganchan sin tener que acertar la coordenada exacta.
function snapToLanes(p){
  var best=null, bd=6;
  for(var i=0;i<LANES.length;i++){ var l=LANES[i];
    for(var j=1;j<l.length;j++){ var r=projectOnSeg(p,l[j-1],l[j]); if(r.d<bd){bd=r.d;best=r.pt;} }
  }
  return best||p;
}
map.on('click',function(e){
  if(MODE==='lane'){ draft.push(snapToLanes([e.lngLat.lng,e.lngLat.lat])); refreshDraft(); return; }
  if(MODE==='zone'){ draft.push([e.lngLat.lng,e.lngLat.lat]); refreshDraft(); return; }
  if(MODE==='spot'){ batch++; addSpot(e.lngLat.lng,e.lngLat.lat,ANGLE,batch); refresh(); return; }
  if(MODE==='row'){
    if(!rowStart){
      rowStart=[e.lngLat.lng,e.lngLat.lat];
      var el=document.createElement('div');
      el.style.cssText='width:12px;height:12px;background:${theme.primary};border:2px solid #fff;border-radius:50%';
      startMarker=new maplibregl.Marker({element:el}).setLngLat(rowStart).addTo(map);
      return;
    }
    makeRow(rowStart,[e.lngLat.lng,e.lngLat.lat]); clearStart(); return;
  }
  // 'view': un espacio tiene prioridad (alternar libre/ocupado)...
  var p=e.point;
  var hit=map.queryRenderedFeatures(box(p,8),{layers:['spots-fill','spots-nodata']});
  if(hit.length){
    var id=hit[0].properties.id;
    spots.forEach(function(f){if(f.properties.id===id)
      f.properties.status=f.properties.status==='free'?'occupied':'free';});
    refresh(); return;
  }
  // ...si no, tocar la zona de otro parqueadero lo selecciona.
  var zh=map.queryRenderedFeatures(box(p,8),{layers:['zones-fill']}).filter(function(f){return !f.properties.active;});
  if(zh.length&&window.ReactNativeWebView)
    window.ReactNativeWebView.postMessage(JSON.stringify({t:'selectLot',id:zh[0].properties.id}));
});

window.setMode=function(m){
  MODE=m; clearStart(); draft=[]; refreshDraft(); // cambiar de modo descarta el borrador
  map.getCanvas().style.cursor=(m==='view')?'':'crosshair';
};
// Cierra el trazo en curso: zona (polígono) o carril (polilínea), según el modo.
window.finishDraft=function(){
  var pts=draft.slice(); draft=[]; refreshDraft();
  if(!window.ReactNativeWebView) return;
  if(MODE==='zone'&&pts.length>=3) window.ReactNativeWebView.postMessage(JSON.stringify({t:'zone',zone:pts}));
  else if(MODE==='lane'&&pts.length>=2) window.ReactNativeWebView.postMessage(JSON.stringify({t:'lane',line:pts}));
};
window.setLanes=function(arr){
  LANES=arr||[];
  if(map.getSource('lanes')) map.getSource('lanes').setData(lanesFc(LANES)); else pendingLanes=arr;
};
window.setZones=function(arr){
  if(map.getSource('zones')) map.getSource('zones').setData(zonesFc(arr)); else pendingZones=arr;
};
function metersBetween(a,b){ // [lng,lat]
  var toR=Math.PI/180,R=6371000,dLat=(b[1]-a[1])*toR,dLng=(b[0]-a[0])*toR;
  var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a[1]*toR)*Math.cos(b[1]*toR)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return 2*R*Math.asin(Math.sqrt(h));
}
// Proyección de p sobre el segmento a-b (grados, lng escalado por cos(lat)).
function projectOnSeg(p,a,b){
  var cx=Math.cos(p[1]*Math.PI/180);
  var ax=(a[0]-p[0])*cx, ay=a[1]-p[1], bx=(b[0]-p[0])*cx, by=b[1]-p[1];
  var dx=bx-ax, dy=by-ay, len2=dx*dx+dy*dy;
  var tt=len2?-(ax*dx+ay*dy)/len2:0; tt=Math.max(0,Math.min(1,tt));
  var pt=[a[0]+(b[0]-a[0])*tt, a[1]+(b[1]-a[1])*tt];
  return {pt:pt, d:metersBetween(p,pt)};
}
// Ruta por las VÍAS del propio mapa: lee las líneas de la capa 'roads' del basemap,
// arma un grafo y corre Dijkstra. Engancha usuario y cupo al punto más cercano
// SOBRE una vía (proyección). null si no hay vía a <150m (→ el llamador usa recta).
function computeRoute(u,t){
  var pad=0.003;
  var minLng=Math.min(u[0],t[0])-pad,maxLng=Math.max(u[0],t[0])+pad;
  var minLat=Math.min(u[1],t[1])-pad,maxLat=Math.max(u[1],t[1])+pad;
  var nodes={}, adj={}, segs=[];
  function key(c){return c[0].toFixed(5)+','+c[1].toFixed(5);}
  // Une nodos a <6m: así dos carriles (o carril y vía) que casi se tocan quedan conectados.
  function node(c){
    for(var nk in nodes){ if(metersBetween(nodes[nk],c)<6) return nk; }
    var k=key(c); nodes[k]=c; adj[k]=[]; return k;
  }
  function edge(a,b){var ka=node(a),kb=node(b); if(ka===kb)return; var w=metersBetween(a,b);
    adj[ka].push({to:kb,w:w}); adj[kb].push({to:ka,w:w});}
  function addLine(line){
    for(var i=1;i<line.length;i++){
      var a=line[i-1],b=line[i];
      if((a[0]<minLng&&b[0]<minLng)||(a[0]>maxLng&&b[0]>maxLng)||(a[1]<minLat&&b[1]<minLat)||(a[1]>maxLat&&b[1]>maxLat))continue;
      edge(a,b); segs.push({a:a,b:b});
    }
  }
  // Carriles dibujados (prioridad para el interior del parqueadero)...
  LANES.forEach(function(l){ if(l&&l.length>=2) addLine(l); });
  // ...más las vías del propio mapa (para la aproximación).
  var feats=null;
  try{ feats=map.querySourceFeatures('protomaps',{sourceLayer:'roads'}); }catch(e){}
  if(feats) feats.forEach(function(f){
    var g=f.geometry; if(!g)return;
    var lines=g.type==='LineString'?[g.coordinates]:(g.type==='MultiLineString'?g.coordinates:[]);
    lines.forEach(addLine);
  });
  if(!segs.length) return null;
  // Engancha un punto al grafo por el punto más cercano sobre alguna vía.
  function connect(p){
    var best=null;
    for(var i=0;i<segs.length;i++){ var r=projectOnSeg(p,segs[i].a,segs[i].b);
      if(!best||r.d<best.d){ best={d:r.d,pt:r.pt,a:segs[i].a,b:segs[i].b}; } }
    if(!best||best.d>150) return null;
    edge(best.pt,best.a); edge(best.pt,best.b); edge(p,best.pt);
    return node(p); // clave real del nodo (puede haberse unido a uno existente)
  }
  var sK=connect(u), eK=connect(t);
  if(!sK||!eK) return null;
  var keys=Object.keys(nodes);
  var dist={},prev={},vis={}; keys.forEach(function(k){dist[k]=Infinity;}); dist[sK]=0;
  while(true){
    var cur=null,cd=Infinity;
    for(var k in dist){ if(!vis[k]&&dist[k]<cd){cd=dist[k];cur=k;} }
    if(cur===null||cur===eK)break;
    vis[cur]=true;
    adj[cur].forEach(function(ed){ if(vis[ed.to])return; var nd=dist[cur]+ed.w; if(nd<dist[ed.to]){dist[ed.to]=nd;prev[ed.to]=cur;} });
  }
  if(dist[eK]===Infinity) return null;
  var path=[],c=eK; while(c){path.unshift(nodes[c]); c=prev[c];}
  return path; // ya incluye u (inicio) y t (fin) como nodos enganchados
}
window.setTarget=function(tLng,tLat,uLng,uLat){
  var u=[uLng,uLat],t=[tLng,tLat];
  function draw(coords){
    var data={type:'FeatureCollection',features:[
      {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}},
      {type:'Feature',properties:{},geometry:{type:'Point',coordinates:t}}
    ]};
    if(map.getSource('route')) map.getSource('route').setData(data); else pendingRoute=data;
  }
  draw([u,t]); // recta inmediata, mientras cargan los tiles del corredor
  try{ map.fitBounds([[Math.min(uLng,tLng),Math.min(uLat,tLat)],[Math.max(uLng,tLng),Math.max(uLat,tLat)]],
    {padding:90,maxZoom:19,duration:600}); }catch(e){}
  // Cuando el corredor termina de cargar, intenta la ruta por vías.
  map.once('idle',function(){ var r=computeRoute(u,t); if(r) draw(r); });
};
window.clearTarget=function(){ var s=map.getSource('route'); if(s) s.setData({type:'FeatureCollection',features:[]}); };
window.setAngle=function(d){ANGLE=+d||0;};
window.undoLast=function(){
  if(!spots.length) return;
  var last=spots[spots.length-1].properties.batch;
  spots=spots.filter(function(f){return f.properties.batch!==last;});
  refresh();
};
window.clearSpots=function(){spots=[];nextId=1;batch=0;clearStart();refresh();};
window.setActive=function(arr){ if(map.isStyleLoaded()&&map.getSource('spots')) applyActive(arr); else pendingActive=arr; };
window.setLots=function(arr){ if(map.isStyleLoaded()&&map.getSource('spots')) renderLabels(arr); else pendingLabels=arr; };
window.setUser=function(lng,lat){
  function go(){
    map.flyTo({center:[lng,lat],zoom:${zoom}});
    if(!userMarker){
      var el=document.createElement('div');
      el.innerHTML='<svg width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" fill="${theme.primary}" stroke="#fff" stroke-width="3"/></svg>';
      el.style.filter='drop-shadow(0 2px 3px rgba(0,0,0,.35))';
      userMarker=new maplibregl.Marker({element:el}).setLngLat([lng,lat]).addTo(map);
    } else userMarker.setLngLat([lng,lat]);
  }
  if(map.isStyleLoaded()) go(); else map.once('load',go);
};
true;
</script></body></html>`
}
