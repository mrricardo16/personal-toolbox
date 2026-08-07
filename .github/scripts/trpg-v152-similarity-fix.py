from pathlib import Path
p=Path('trpg-dm-assistant/src/scenario-engine.js')
s=p.read_text(encoding='utf-8')
a='function narrativeSimilarity(a,b){const aa=a instanceof Set?a:narrativeFingerprintTokens(a),bb=b instanceof Set?b:narrativeFingerprintTokens(b);if(!aa.size||!bb.size)return 0;let common=0;for(const token of aa)if(bb.has(token))common++;return common/(aa.size+bb.size-common)}'
b='function narrativeSimilarity(a,b){const aa=a instanceof Set?a:narrativeFingerprintTokens(a),bb=b instanceof Set?b:narrativeFingerprintTokens(b);if(!aa.size||!bb.size)return 0;let common=0;for(const token of aa)if(bb.has(token))common++;return(2*common)/(aa.size+bb.size)}'
if s.count(a)!=1: raise SystemExit(f'narrativeSimilarity anchor mismatch: {s.count(a)}')
p.write_text(s.replace(a,b,1),encoding='utf-8')
print('v1.5.2 narrative similarity switched to Dice coefficient')
