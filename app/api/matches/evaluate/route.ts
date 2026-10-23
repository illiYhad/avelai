import { FEATURES, FEATURE_DISABLED_MESSAGE } from '@/lib/featureFlags';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!FEATURES.legacyApi) {
    return Response.json({ error: FEATURE_DISABLED_MESSAGE }, { status: 503 });
  }
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseServiceKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        // Match Evaluation Logic...
        return NextResponse.json({ success: true, data: body });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}