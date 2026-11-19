/**
 * F217: shared bounded filesystem enumerator for offline signed-build review
 * and independent artifact verification. All output files are binary buffers,
 * read from the exact opened descriptor, never path-read after a separate stat.
 *
 * The workspace and its ancestor directories must be private/trusted. This
 * module does NOT prove external delivery, transport authorization or deploy.
 */
import {lstatSync,readdirSync,openSync,fstatSync,readSync,closeSync,constants} from 'node:fs';
import {join,posix} from 'node:path';

const MAX_FILES=500,MAX_BYTES=50*1024*1024,MAX_FILE_BYTES=10*1024*1024;
const MAX_ENTRIES=1000,MAX_DEPTH=20;
const SAFE_NAME=/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,119}$/;
function readDescriptorFile(path,remaining){
  let fd;
  try{
    fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size>MAX_FILE_BYTES||stat.size>remaining)
      throw Error('unsafe bytes');
    let bytes=0;
    const parts=[];
    while(true){
      const chunk=Buffer.allocUnsafe(Math.min(64*1024,MAX_FILE_BYTES-bytes+1,
        remaining-bytes+1));
      const n=readSync(fd,chunk,0,chunk.length,null);
      if(n===0)break;
      bytes+=n;
      if(bytes>MAX_FILE_BYTES||bytes>remaining)throw Error('over budget');
      parts.push(chunk.subarray(0,n));
    }
    return Buffer.concat(parts,bytes);
  }catch{
    throw Error('protected dist: unsafe output file');
  }finally{
    if(fd!==undefined)closeSync(fd);
  }
}
export function readProtectedDist(root='dist'){
  if(typeof root!=='string'||root.length===0||root.includes('\0'))
    throw Error('protected dist: invalid root');
  let entries=0,totalBytes=0;
  const result=[];
  function walk(folder,relative,depth){
    if(depth>MAX_DEPTH)throw Error('protected dist: directory depth exceeded');
    let directory;
    try{directory=lstatSync(folder);}
    catch{throw Error('protected dist: unavailable directory');}
    if(!directory.isDirectory()||directory.isSymbolicLink())
      throw Error('protected dist: unsafe directory');
    let listing;
    try{listing=readdirSync(folder,{withFileTypes:true});}
    catch{throw Error('protected dist: unreadable directory');}
    entries+=listing.length;
    if(entries>MAX_ENTRIES)throw Error('protected dist: entry budget exceeded');
    for(const item of listing){
      if(!SAFE_NAME.test(item.name)||item.name.includes('..'))
        throw Error('protected dist: invalid output entry name');
      const full=join(folder,item.name);
      const relativePath=relative?posix.join(relative,item.name):item.name;
      if(item.isSymbolicLink())
        throw Error('protected dist: symlink output forbidden');
      if(item.isDirectory()){
        walk(full,relativePath,depth+1);
        continue;
      }
      if(!item.isFile())
        throw Error('protected dist: unsupported output entry');
      if(result.length>=MAX_FILES)
        throw Error('protected dist: file budget exceeded');
      const bytes=readDescriptorFile(full,MAX_BYTES-totalBytes);
      totalBytes+=bytes.length;
      result.push(Object.freeze({path:relativePath,bytes}));
    }
  }
  walk(root,'',0);
  return Object.freeze(result);
}
