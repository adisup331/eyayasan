import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserContext } from '@/lib/auth';

// OAuth callback (Google). Menukar `code` menjadi sesi (cookie), lalu mengarahkan:
// - belum punya profil member  -> /complete-profile (isi detail)
// - sudah punya profil/super    -> / (guard dashboard akan rute lebih lanjut)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  const ctx = await getUserContext();
  if (ctx && !ctx.member && !ctx.isSuperAdmin) {
    return NextResponse.redirect(`${origin}/complete-profile`);
  }
  return NextResponse.redirect(`${origin}/`);
}
