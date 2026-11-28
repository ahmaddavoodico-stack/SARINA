type AudioRecord={id:string;blob:Blob;expiresAt:number};

const DB_NAME="sarina-chat-audio";
const STORE_NAME="audio";

function openDatabase():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME,{keyPath:"id"});};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error??new Error("CHAT_AUDIO_DB_OPEN_FAILED"));
 });
}

export async function saveChatAudio(id:string|number,blob:Blob):Promise<void>{
 const db=await openDatabase();
 await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(STORE_NAME,"readwrite");
  tx.objectStore(STORE_NAME).put({id:String(id),blob,expiresAt:Date.now()+24*60*60*1000} satisfies AudioRecord);
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error??new Error("CHAT_AUDIO_SAVE_FAILED"));
  tx.onabort=()=>reject(tx.error??new Error("CHAT_AUDIO_SAVE_ABORTED"));
 });
 db.close();
}

export async function loadChatAudio(id:string|number):Promise<Blob|null>{
 const db=await openDatabase();
 const record=await new Promise<AudioRecord|null>((resolve,reject)=>{
  const tx=db.transaction(STORE_NAME,"readonly");
  const request=tx.objectStore(STORE_NAME).get(String(id));
  request.onsuccess=()=>resolve((request.result as AudioRecord|undefined)??null);
  request.onerror=()=>reject(request.error??new Error("CHAT_AUDIO_READ_FAILED"));
 });
 if(record&&record.expiresAt>Date.now()){db.close();return record.blob;}
 await new Promise<void>(resolve=>{
  const tx=db.transaction(STORE_NAME,"readwrite");
  tx.objectStore(STORE_NAME).delete(String(id));
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>resolve();
 });
 db.close();
 return null;
}

export async function moveChatAudio(fromId:string|number,toId:string|number):Promise<void>{
 if(String(fromId)===String(toId))return;
 const blob=await loadChatAudio(fromId);
 if(!blob)return;
 await saveChatAudio(toId,blob);
 const db=await openDatabase();
 await new Promise<void>(resolve=>{
  const tx=db.transaction(STORE_NAME,"readwrite");
  tx.objectStore(STORE_NAME).delete(String(fromId));
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>resolve();
 });
 db.close();
}
