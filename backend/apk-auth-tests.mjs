import assert from 'node:assert/strict';let handler,role='admin',active=true,must_change_password=false,valid=true;
globalThis.Deno={env:{get:k=>({SUPABASE_URL:'https://test.local',SUPABASE_SERVICE_ROLE_KEY:'secret'})[k]},serve:f=>handler=f};
globalThis.fetch=async u=>u.includes('/auth/v1/user')?Response.json(valid?{id:'synthetic'}:{},{status:valid?200:401}):Response.json([{role,active,must_change_password}]);
await import('./apk-admin-auth.ts');
const call=(token='synthetic')=>handler(new Request('https://test.local',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{}}));
assert.equal((await call(null)).status,401);role='reseller';assert.equal((await call()).status,403);role='admin';active=false;assert.equal((await call()).status,403);active=true;must_change_password=true;assert.equal((await call()).status,403);must_change_password=false;valid=false;assert.equal((await call()).status,401);valid=true;const r=await call();assert.equal(r.status,200);assert.deepEqual(await r.json(),{role:'admin',user_id:'synthetic'});console.log('PASS: only active admin with validated session and changed initial password can authorize APK upload');
