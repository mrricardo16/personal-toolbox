"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
function patch(rel,transform){const file=path.join(root,rel);const before=fs.readFileSync(file,"utf8"),after=transform(before);if(after===before)throw new Error(`No release patch applied to ${rel}`);fs.writeFileSync(file,after,"utf8")}
patch("src/scenarios/library.js",s=>s.replace('const APP_VERSION = "1.6.3";','const APP_VERSION = "1.6.4";'));
patch("build/test-v163-san-loss-resolution.js",s=>s.replace('assert.equal(api.APP_VERSION,"1.6.3");','{const v=api.APP_VERSION.split(".").map(Number);assert(v[0]>1||(v[0]===1&&(v[1]>6||(v[1]===6&&v[2]>=3))));}'));
patch("build/test-real-api-v1513.js",s=>{
  let out=s.replace('"san-loss-resolution.js"];','"san-loss-resolution.js","indefinite-insanity-window.js"];');
  out=out.replace('SAN_LOSS_RESOLUTION_VERSION,ready:__ready','SAN_LOSS_RESOLUTION_VERSION,INDEFINITE_INSANITY_WINDOW_VERSION,ready:__ready');
  out=out.replace('assert.equal(api.APP_VERSION,"1.6.3");','assert.equal(api.APP_VERSION,"1.6.4");');
  out=out.replace('assert.equal(api.SAN_LOSS_RESOLUTION_VERSION,"1.0");','assert.equal(api.SAN_LOSS_RESOLUTION_VERSION,"1.0");assert.equal(api.INDEFINITE_INSANITY_WINDOW_VERSION,"1.0");');
  return out;
});
console.log("V164_RELEASE_PATCH:PASS");