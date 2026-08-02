import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const authHeader=req.headers.get("Authorization")!;
    const userClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authHeader}}});
    const {data:{user}}=await userClient.auth.getUser();
    if(!user)return new Response("Unauthorized",{status:401});

    const {invitation_id}=await req.json();
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:inv,error}=await admin.from("workspace_invitations")
      .select("id,email,relationship,role,workspace_id,finance_workspaces(name)")
      .eq("id",invitation_id).eq("invited_by",user.id).single();
    if(error)throw error;

    const resendKey=Deno.env.get("RESEND_API_KEY");
    const from=Deno.env.get("EMAIL_FROM_ADDRESS");
    const appUrl=Deno.env.get("APP_URL");
    if(!resendKey||!from||!appUrl)throw new Error("Email secrets are not configured");

    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Authorization":`Bearer ${resendKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        from,
        to:[inv.email],
        subject:`You were invited to ${inv.finance_workspaces.name} on Nomad Wealth`,
        html:`<h2>Nomad Wealth invitation</h2>
          <p>You have been invited as a <strong>${inv.role}</strong> to the shared workspace <strong>${inv.finance_workspaces.name}</strong>.</p>
          <p>Relationship: ${inv.relationship||"trusted person"}</p>
          <p><a href="${appUrl}">Open Nomad Wealth</a>, create an account or sign in using this email address, and the workspace will appear automatically.</p>`
      })
    });
    if(!response.ok)throw new Error(await response.text());
    return Response.json({ok:true});
  } catch(error) {
    return Response.json({error:error.message},{status:400});
  }
});
