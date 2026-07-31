import { readFileSync } from "fs";
const TOKEN = process.env.GH_TOKEN;
const REPO = "magaowen/magaowen";
const API = "https://api.github.com";
const HEADERS = { Authorization: "Bearer " + TOKEN, Accept: "application/vnd.github+json", "User-Agent": "wb-deploy", "Content-Type": "application/json" };
const files = [ "_routes.json" ];
async function gh(method, path, body){ const res=await fetch(API+path,{method,headers:HEADERS,body:body?JSON.stringify(body):undefined}); const txt=await res.text(); let j={}; try{j=JSON.parse(txt)}catch(e){} if(!res.ok) throw new Error(method+" "+path+" -> "+res.status+" "+(j.message||txt.slice(0,200))); return j; }
const ref=await gh("GET",`/repos/${REPO}/git/refs/heads/main`);
const baseSha=ref.object.sha;
const baseCommit=await gh("GET",`/repos/${REPO}/git/commits/${baseSha}`);
const baseTree=baseCommit.tree.sha;
const tree=[];
for(const f of files){ const content=readFileSync(f,"utf8"); const b=await gh("POST",`/repos/${REPO}/git/blobs`,{content,encoding:"utf-8"}); tree.push({path:f,mode:"100644",type:"blob",sha:b.sha}); }
const newTree=await gh("POST",`/repos/${REPO}/git/trees`,{base_tree:baseTree,tree});
const newCommit=await gh("POST",`/repos/${REPO}/git/commits`,{message:"deploy: add _routes.json to route /api/* to functions",tree:newTree.sha,parents:[baseSha]});
await gh("PATCH",`/repos/${REPO}/git/refs/heads/main`,{sha:newCommit.sha});
console.log("DEPLOY_PUSHED_OK", newCommit.sha);
