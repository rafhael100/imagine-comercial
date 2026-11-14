/**
 * F204: one safe, bounded, strict-UTF-8 file reader shared by the
 * build and OFFLINE release review CLI. No HTTP, no secrets in errors.
 */
import {openSync,fstatSync,readSync,closeSync,constants} from 'node:fs';
import {TextDecoder} from 'node:util';
export function readApprovedFile(path, maxBytes, label) {
  if (typeof path !== 'string' || path.length < 1 || path.includes('\0')) {
    throw new Error('build catalog: invalid ' + label + ' path');
  }
  // F194: one descriptor for check and read; no symlink at final path.
  // A concurrent replacement of path cannot change the opened inode.
  let fd;
  try {
    fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.size>maxBytes)throw Error('unsafe');
    const chunks=[];
    let total=0;
    while(true){
      const chunk=Buffer.allocUnsafe(Math.min(65536,maxBytes-total+1));
      const bytes=readSync(fd,chunk,0,chunk.length,null);
      if(bytes===0)break;
      total+=bytes;
      if(total>maxBytes)throw Error('oversize');
      chunks.push(chunk.subarray(0,bytes));
    }
    return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true})
      .decode(Buffer.concat(chunks,total));
  }catch{
    // Error messages must not reveal paths, payload content or key material.
    throw new Error('build catalog: unsafe ' + label + ' file');
  }finally{
    if(fd!==undefined)closeSync(fd);
  }
}

