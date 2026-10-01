import {spawn} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const backend=join(root,'backend');
const frontend=join(root,'frontend');
const next=join(frontend,'node_modules','next','dist','bin','next');
const localPython=process.platform==='win32'?join(root,'.venv','Scripts','python.exe'):join(root,'.venv','bin','python');
const python=existsSync(localPython)?localPython:'python';

if(!existsSync(next)){
  console.error('Frontend packages are missing. Run: cd frontend; npm install');
  process.exitCode=1;
}else{
  async function fetchText(url){
    try{const response=await fetch(url,{signal:AbortSignal.timeout(1200)});return response.ok?await response.text():null}
    catch{return null}
  }
  async function freePort(start){
    for(let port=start;port<start+100;port++){
      const free=await new Promise(resolve=>{
        const server=createServer();
        server.once('error',()=>resolve(false));
        server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));
      });
      if(free)return port;
    }
    throw new Error(`No free development port found near ${start}`);
  }

  const [health,openapi,web]=await Promise.all([
    fetchText('http://127.0.0.1:8000/health'),
    fetchText('http://127.0.0.1:8000/openapi.json'),
    fetchText('http://127.0.0.1:3000')
  ]);
  const digest=createHash('sha256');
  for(const name of ['main.py','ml.py','models.py','database.py'])digest.update(readFileSync(join(backend,'app',name)));
  const expectedBuildId=digest.digest('hex').slice(0,16);
  let healthData=null;
  try{if(health)healthData=JSON.parse(health)}catch{}
  const apiReusable=healthData?.status==='ok'&&healthData.build_id===expectedBuildId&&!!openapi?.includes('/sessions/{sid}/challenge');
  const oldApi=health!==null&&!apiReusable;
  const apiPort=apiReusable?8000:await freePort(oldApi?8001:8000);
  const webReusable=apiPort===8000&&!!web?.includes('MarketLab');
  const webPort=webReusable?3000:await freePort(web===null?3000:3001);
  const children=[];

  console.log('\nMarketLab');
  if(apiPort!==8000)console.log(`Port 8000 is in use; leaving that process alone and starting this backend on ${apiPort}.`);
  if(web!==null&&!webReusable)console.log(`Another frontend is using port 3000; opening this version on ${webPort}.`);
  console.log(`Open http://localhost:${webPort}`);
  console.log(`API docs: http://localhost:${apiPort}/docs`);
  if(!apiReusable||!webReusable)console.log('Press Ctrl+C to stop the servers started here.\n');

  if(!apiReusable)children.push(['Backend',spawn(python,['-m','uvicorn','app.main:app','--reload','--host','127.0.0.1','--port',String(apiPort)],{
    cwd:backend,stdio:'inherit',env:{...process.env,JWT_SECRET:process.env.JWT_SECRET||'blindmarket-local-development-only'}
  })]);
  if(!webReusable)children.push(['Frontend',spawn(process.execPath,[next,'dev','-p',String(webPort)],{
    cwd:frontend,stdio:'inherit',env:{...process.env,NEXT_PUBLIC_API_URL:`http://localhost:${apiPort}`,MARKETLAB_NEXT_DIST_DIR:webPort===3000?'.next':`.next-${webPort}`}
  })]);

  let stopping=false;
  function stop(code=0){
    if(stopping)return;
    stopping=true;
    for(const [,child] of children)if(child.exitCode===null)child.kill();
    setTimeout(()=>process.exit(code),500).unref();
  }
  process.on('SIGINT',()=>stop());
  process.on('SIGTERM',()=>stop());
  for(const [name,child] of children){
    child.on('error',error=>{console.error(`${name} could not start: ${error.message}`);stop(1)});
    child.on('exit',code=>{if(!stopping){console.error(`${name} stopped (${code}).`);stop(code||1)}});
  }
}
