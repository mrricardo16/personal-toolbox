"use strict";
const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"test-v164-indefinite-insanity-window.js");
let s=fs.readFileSync(file,"utf8");
const old='await test("diagnostics 读取包含窗口且不修改 canonical state",async()=>{const before=JSON.stringify(api.state()),pack=api.diagnostic();assert(pack.sanLossResolution.indefiniteInsanity);assert.equal(JSON.stringify(api.state()),before)});';
const next='await test("diagnostics 读取包含窗口且不修改 SAN canonical state",async()=>{const beforeRevision=api.revision(),beforeSanity=JSON.stringify(api.snapshot()),pack=api.diagnostic();assert(pack.sanLossResolution.indefiniteInsanity);assert.equal(api.revision(),beforeRevision);assert.equal(JSON.stringify(api.snapshot()),beforeSanity)});';
if(!s.includes(old))throw new Error("diagnostic assertion block not found");
s=s.replace(old,next);fs.writeFileSync(file,s,"utf8");console.log("V164_DIAGNOSTIC_TEST_PATCH:PASS");