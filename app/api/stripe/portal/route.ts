import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.replace("Bearer ", "");
  if (!accessToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: plan } = await supabase
    .from("user_plans")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!plan?.stripe_customer_id) {
    return NextResponse.json({ error: "no_customer" }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: plan.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/mypage`,
  });

  return NextResponse.json({ url: session.url });
}
