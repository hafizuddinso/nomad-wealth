import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const resendKey=Deno.env.get("RESEND_API_KEY")!,from=Deno.env.get("EMAIL_FROM_ADDRESS")!;
  const today=new Date();const max=new Date();max.setDate(max.getDate()+7);
  const {data:rows,error}=await admin.from("reminders").select("id,user_id,title,due_date,remind_days_before,last_sent_at")
    .eq("email_enabled",true).eq("status","pending").lte("due_date",max.toISOString().slice(0,10));
  if(error)return Response.json({error:error.message},{status:400});
  let sent=0;
  for(const row of rows||[]){
    const due=new Date(`${row.due_date}T12:00:00Z`);
    const notify=new Date(due);notify.setUTCDate(notify.getUTCDate()-row.remind_days_before);
    if(notify>today||row.last_sent_at)continue;
    const {data:user}=await admin.auth.admin.getUserById(row.user_id);
    const email=user.user?.email;if(!email)continue;
    const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${resendKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({from,to:[email],subject:`Reminder: ${row.title}`,html:`<h2>${row.title}</h2><p>This item is due on ${row.due_date}.</p><p>Open Nomad Wealth to review it.</p>`})});
    if(r.ok){sent++;await admin.from("reminders").update({last_sent_at:new Date().toISOString()}).eq("id",row.id)}
  }
  return Response.json({sent});
});
