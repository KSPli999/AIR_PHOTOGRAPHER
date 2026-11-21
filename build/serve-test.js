const http=require('http'),fs=require('fs');
const f=process.env.HOME+'/work/airspace/docs/index.html';
http.createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html; charset=utf-8'});r.end(fs.readFileSync(f));}).listen(3113,'127.0.0.1',()=>console.log('http://127.0.0.1:3113'));
