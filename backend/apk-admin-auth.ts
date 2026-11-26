const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
Deno.serve(async(req:Request)=>{
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply({message:'Método não permitido.'},405);
 const bearer=req.headers.get('authorization');if(!bearer?.startsWith('Bearer '))return reply({message:'Entre como administrador.'},401);
 try{
  const response=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:bearer},signal:AbortSignal.timeout(10000)});
  if(!response.ok)return reply({message:'Sessão expirada.'},401);
  const user=await response.json();
  const roleResponse=await fetch(base+'/rest/v1/portal_staff?user_id=eq.'+encodeURIComponent(user.id)+'&select=role,active,must_change_password',{headers:{apikey:service,Authorization:'Bearer '+service},signal:AbortSignal.timeout(10000)});
  if(!roleResponse.ok)return reply({message:'Verificação indisponível.'},503);
  const roles=await roleResponse.json(),role=roles[0];
  if(role?.role!=='admin'||role.active!==true||role.must_change_password===true)return reply({message:'Operação exclusiva do administrador.'},403);
  return reply({role:'admin',user_id:user.id});
 }catch{return reply({message:'Verificação indisponível.'},503);}
});
