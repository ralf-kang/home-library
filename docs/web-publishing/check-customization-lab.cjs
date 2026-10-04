// Uses an already-running lab. Creates and drops ONLY a uniquely named test DB.
// Credentials remain in process memory; they are never written or printed.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const root=path.resolve(__dirname,'../..'), node=process.execPath;
const dbName='hl_appearance_check_'+crypto.randomBytes(5).toString('hex');
if(!/^hl_appearance_check_[a-f0-9]{10}$/.test(dbName))throw new Error('Unsafe database name');
const report={date:'2026-10-05',database:dbName,checks:[],cleanup:{},notes:'Existing cluster session retained. No deployment or existing data changes.'};
let tunnel,server,prisma,created=false,password='',url='';
const redact=s=>String(s).replaceAll(url || '\u0000','[DATABASE_URL]').replaceAll(password || '\u0000','[REDACTED]');
function ssh(command){const r=spawnSync('ssh',['-o','BatchMode=yes','root@192.168.100.100',command],{encoding:'utf8',windowsHide:true,timeout:60000});if(r.status!==0)throw new Error('Lab command failed: '+redact(r.stderr));return r.stdout.trim()}
function psql(sql){return ssh(`kubectl -n home-library exec deployment/home-library-db -- psql -U home_library_app -d postgres -v ON_ERROR_STOP=1 -c '${sql}'`)}
function run(args,cwd,env){return new Promise((resolve,reject)=>{const c=spawn(node,args,{cwd,env,windowsHide:true});let output='';c.stdout.on('data',b=>output+=b);c.stderr.on('data',b=>output+=b);c.on('error',reject);c.on('close',code=>code===0?resolve(output):reject(new Error(redact(output.slice(-5000)))));})}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchTimed(target,options={}){return fetch(target,{...options,signal:AbortSignal.timeout(90000)})}
(async()=>{
  const encoded=ssh("kubectl -n home-library get secret home-library-env -o jsonpath='{.data.DATABASE_URL}'");
  const original=new URL(Buffer.from(encoded,'base64').toString('utf8'));password=decodeURIComponent(original.password);
  const clusterIp=ssh("kubectl -n home-library get service shared-postgres -o jsonpath='{.spec.clusterIP}'");
  if(!/^\d+\.\d+\.\d+\.\d+$/.test(clusterIp))throw new Error('Unexpected service address');
  tunnel=spawn('ssh',['-N','-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-L',`127.0.0.1:15439:${clusterIp}:5432`,'root@192.168.100.100'],{windowsHide:true,stdio:'ignore'});
  await pause(1200);if(tunnel.exitCode!==null)throw new Error('Test tunnel did not start');
  psql('CREATE DATABASE '+dbName);created=true;
  original.hostname='127.0.0.1';original.port='15439';original.pathname='/'+dbName;url=original.toString();
  const env={...process.env,DATABASE_URL:url,APPEARANCE_TEST_DATABASE_URL:url,PATH:path.dirname(node)+';'+process.env.PATH};
  console.log('Isolated PostgreSQL created; checking schema and persistence.');
  await run([path.join(root,'node_modules/prisma/build/index.js'),'db','push','--skip-generate'],root,env);
  // The additive SQL must also be safely repeatable after db push.
  await run([path.join(root,'node_modules/prisma/build/index.js'),'db','execute','--file','prisma/sql/20261005-library-appearance.sql','--schema','prisma/schema.prisma'],root,env);
  report.checks.push({name:'Prisma schema + repeatable additive SQL',ok:true});
  const result=await run([path.join(root,'node_modules/vitest/vitest.mjs'),'run','tests/library-appearance.integration.test.ts'],root,env);
  report.checks.push({name:'3 PostgreSQL persistence/isolation/reset integration tests',ok:true});console.log(redact(result.slice(-900)));
  prisma=new PrismaClient({datasources:{db:{url}}});
  const user=await prisma.user.create({data:{googleSub:'dev:customize@appearance.test',email:'customize@appearance.test',name:'꾸미기 검증'}});
  const household=await prisma.household.create({data:{name:'꾸미기 검증 서재'}});
  await prisma.member.create({data:{userId:user.id,householdId:household.id,name:'꾸미기 검증',role:'CHILD',libraryAppearance:{version:1,theme:'indigo',cover:'journal',finish:'walnut',density:'compact',heading:'저장된 나의 서재',showTitles:true}}});
  // Separate build cache prevents collision with anyone using the working tree.
  const scratch=path.join('C:/hyper-v/.tmp',dbName);
  fs.mkdirSync(scratch,{recursive:true});
  for(const item of ['src','public','prisma'])fs.cpSync(path.join(root,item),path.join(scratch,item),{recursive:true});
  for(const item of ['package.json','tsconfig.json','postcss.config.mjs','next.config.ts','next-env.d.ts'])if(fs.existsSync(path.join(root,item)))fs.copyFileSync(path.join(root,item),path.join(scratch,item));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(scratch,'node_modules'),'junction');
  const appEnv={...env,AUTH_SECRET:crypto.randomBytes(32).toString('hex'),ENABLE_DEV_LOGIN:'1',APP_URL:'http://127.0.0.1:3505',COOKIE_SECURE:'',NODE_ENV:'development',NODE_OPTIONS:'--max-old-space-size=512'};
  server=spawn(node,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3505'],{cwd:scratch,env:appEnv,windowsHide:true});
  let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
  let ready=false;for(let i=0;i<60;i++){if(server.exitCode!==null)throw new Error('Test app failed: '+redact(logs.slice(-3000)));if(logs.includes('Ready in')){ready=true;break}await pause(500)}
  if(!ready)throw new Error('Test app startup timed out');
  console.log('Checking unauthenticated and authenticated customize routes.');
  const anonymous=await fetchTimed('http://127.0.0.1:3505/customize',{redirect:'manual'});
  if(![302,303,307,308].includes(anonymous.status)||!anonymous.headers.get('location')?.includes('/login'))throw new Error('Unauthenticated customize did not redirect to login');
  report.checks.push({name:'Anonymous customize redirects to login',ok:true});
  const login=await fetchTimed('http://127.0.0.1:3505/api/auth/dev',{method:'POST',body:new URLSearchParams({email:'customize@appearance.test',next:'/customize'}),redirect:'manual'});
  const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');if(!cookie)throw new Error('Test sign-in did not set a session');
  for(const route of ['/customize','/shelves','/dashboard']){
    const r=await fetchTimed('http://127.0.0.1:3505'+route,{headers:{Cookie:cookie}});const html=await r.text();
    const expected=route==='/customize'?'나의 서재 꾸미기':'저장된 나의 서재';
    if(r.status!==200||!html.includes(expected)||!html.includes('data-density="compact"'))throw new Error('Personalized page check failed: '+route+' '+r.status+' '+redact(logs.slice(-1000)));
    report.checks.push({name:'SSR personalized '+route,ok:true,status:r.status});
  }
  report.allPassed=true;console.log('Customization database and HTTP checks passed.');
})().catch(e=>{report.allPassed=false;report.error=redact(e.message);process.exitCode=1;console.error(report.error)}).finally(async()=>{
  if(server?.pid){spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});report.cleanup.localAppStopped=true}
  if(prisma)await prisma.$disconnect();
  if(created){try{psql('DROP DATABASE '+dbName+' WITH (FORCE)');report.cleanup.testDatabaseDropped=true}catch(e){report.cleanup.error=redact(e.message);report.allPassed=false;process.exitCode=1}}
  if(tunnel){tunnel.kill();report.cleanup.tunnelStopped=true}
  fs.writeFileSync(path.join(__dirname,'customization-validation-report.json'),JSON.stringify(report,null,2));
  console.log('Cleanup: '+JSON.stringify(report.cleanup));
});
