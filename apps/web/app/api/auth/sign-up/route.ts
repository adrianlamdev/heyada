import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";
import { createRateLimiter, rateLimit } from "@/lib/rate-limit";

const signupRateLimiter = createRateLimiter({
  tokens: 5,
  window: "15 m",
  prefix: "@upstash/ratelimit/auth:signup",
});

const formSchema = z.object({
  email: z
    .string()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" }),
});

export async function POST(req: NextRequest) {
  const rateLimitResult = await rateLimit(
    req,
    "auth:signup",
    signupRateLimiter,
  );
  if (rateLimitResult) {
    return rateLimitResult;
  }

  // TODO: add validation
  const { email, password } = await req.json();

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return NextResponse.json({ error: signUpError.message }, { status: 400 });
  }

  if (signUpData.user) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await supabase.auth.updateUser({
      data: {
        email_verified: false,
      },
    });

    return NextResponse.json({
      success: true,
      requiresVerification: true,
    });
  }

  return NextResponse.json({ success: true });
}
