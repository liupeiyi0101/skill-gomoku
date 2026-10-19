// Non-browser check of the production HTTP assets and WebSocket endpoint.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
const base=process.argv[2]||'http://localhost:4173';
const response=await fetch(base);assert.equal(response.status,200);
const html=await response.text();assert.ok(html.includes('Swap2'));
const assets=[...new Set([...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css|svg|png))"/g)].map(match=>match[1]))];
for(const asset of assets){const result=await fetch(new URL(asset,base));assert.equal(result.status,200,asset);if(asset.endsWith('.js'))assert.ok(result.headers.get('content-type').includes('javascript'));}
const info=await fetch(base+'/api/lan-info').then(r=>r.json());assert.ok(Array.isArray(info.addresses));
const missing=await fetch(base+'/not-a-real-file.txt');assert.equal(missing.status,404);
const sessions=[];
async function client(){const ws=new WebSocket(base.replace(/^http/,'ws')+'/ws',{origin:base}),pending=new Map();let serial=0,session=null,room=null;ws.on('message',raw=>{const message=JSON.parse(raw);if(message.type==='session')session=message.session;if(message.type==='state')room=message.room;const job=pending.get(message.id);if(job&&(message.type==='ack'||message.type==='error')){pending.delete(message.id);clearTimeout(job.timer);message.type==='ack'?job.resolve():job.reject(new Error(message.message));}});await once(ws,'open');sessions.push(ws);return {get session(){return session;},get room(){return room;},send(data){return new Promise((resolve,reject)=>{const id=String(++serial);const timer=setTimeout(()=>reject(new Error('Smoke request timed out')),3000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({...data,id}));});}};}
try{const a=await client(),b=await client();await a.send({type:'create',name:'自动检查 A'});await b.send({type:'join',code:a.session.code,name:'自动检查 B'});await new Promise(r=>setTimeout(r,30));await a.send({type:'action',revision:a.room.revision,action:{type:'place',x:7,y:7}});await new Promise(r=>setTimeout(r,30));assert.equal(b.room.game.board[112],1);await a.send({type:'leave'});console.log(`Production smoke passed: HTML, ${assets.length} assets, LAN info, 404, two-player WebSocket synchronization.`);}finally{for(const ws of sessions)ws.close();}
