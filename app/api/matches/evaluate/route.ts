import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseServiceKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await request.json();

        // Match Evaluation Logic...
        return NextResponse.json({ success: true, data: body });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}