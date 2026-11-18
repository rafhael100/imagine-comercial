/**
 * F310: read one operator snapshot from an owner-only POSIX directory.
 * Unlike shared public-build readers, this one requires 0600/0700 isolation.
 * Open exactly one descriptor, validate it after open and read no more than
 * the existing 100 KiB cap. No network, output file or source-data logging.
 */
import {closeSync,constants,fstatSync,openSync,readSync,statSync} from 'node:fs';
import {dirname,isAbsolute} from 'node:path';
import {TextDecoder} from 'node:util';

export function readOperatorPrivateSnapshot(path,maxBytes=100*1024){
 const fail=()=>{throw Error('F310: private operator snapshot unavailable');};
 let fd;
 try{
  if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0')||
     !Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>100*1024||
     typeof process.getuid!=='function')fail();
  const uid=process.getuid();
  const dir=statSync(dirname(path));
  if(!dir.isDirectory()||dir.uid!==uid||(dir.mode&0o077)!==0)fail();
  fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  const st=fstatSync(fd);
  if(!st.isFile()||st.uid!==uid||(st.mode&0o777)!==0o600||
     (st.mode&0o7000)!==0||st.nlink!==1||
     st.size<1||st.size>maxBytes)fail();
  const parts=[];
  let total=0;
  for(;;){
   const chunk=Buffer.allocUnsafe(Math.min(65536,maxBytes-total+1));
   const length=readSync(fd,chunk,0,chunk.length,null);
   if(length===0)break;
   total+=length;
   if(total>maxBytes)fail();
   parts.push(chunk.subarray(0,length));
  }
  return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true})
   .decode(Buffer.concat(parts,total));
 }catch{
  // Do not echo the caller's path, bytes or the underlying filesystem error.
  fail();
 }finally{
  if(fd!==undefined)closeSync(fd);
 }
}
