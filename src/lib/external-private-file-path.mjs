/**
 * F310: resolve an operator-owned file outside this checkout, independently
 * of the working directory. Resolve the existing parent before returning
 * the path so a directory alias cannot redirect later IO into the repository.
 * The caller must still enforce its regular-file / O_NOFOLLOW / O_EXCL rules.
 */
import {realpathSync} from 'node:fs';
import {basename,dirname,isAbsolute,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const checkoutPath=fileURLToPath(new URL('../../',import.meta.url));

export function resolveExternalPrivateFilePath(path){
 if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0'))
  throw Error('F310: external private file required');
 // Let the filesystem resolve symlink/.. ordering in the supplied parent;
 // lexical normalization first could select a different file than requested.
 const physical=join(realpathSync.native(dirname(path)),basename(path));
 const checkout=realpathSync.native(checkoutPath);
 if(physical===checkout||physical.startsWith(checkout+sep))
  throw Error('F310: external private file required');
 return physical;
}
