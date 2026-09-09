import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/require-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const body = await request.json();
    const { bookingId, status } = body;

    if (!bookingId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Update Booking Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const body = await request.json();
    const { classId, userId } = body;
    const staffTenantId = staffAuth.profile.tenant_id as string | null;

    if (!classId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!staffTenantId) {
      return NextResponse.json(
        { error: 'Missing tenant context.' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('class_id', classId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Athlete is already booked for this class' },
        { status: 409 }
      );
    }

    const { data: classData, error: classError } = await supabaseAdmin
      .from('classes')
      .select('max_capacity, tenant_id, bookings:bookings(count)')
      .eq('id', classId)
      .single();

    if (classError || !classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const classTenantId = (classData as { tenant_id?: string | null }).tenant_id ?? null;
    if (classTenantId !== staffTenantId) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const { data: athleteProfile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('id', userId)
      .maybeSingle();

    if (!athleteProfile || athleteProfile.tenant_id !== staffTenantId) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const bookingCount = classData.bookings?.[0]?.count ?? 0;
    if (bookingCount >= classData.max_capacity) {
      return NextResponse.json(
        { error: 'Class is at full capacity' },
        { status: 409 }
      );
    }

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        class_id: classId,
        user_id: userId,
        status: 'booked',
        tenant_id: staffTenantId,
      })
      .select(`
        id, status, tenant_id,
        profiles:user_id (id, full_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    const bookingTenantId = (booking as { tenant_id?: string | null }).tenant_id ?? null;
    if (!bookingTenantId) {
      throw new Error('Booking tenant_id was not set correctly.');
    }

    const profile = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;

    return NextResponse.json({
      booking: {
        id: booking.id,
        status: booking.status,
        profiles: profile,
      },
    });
  } catch (error: unknown) {
    console.error('Create Booking Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;

  try {
    const body = await request.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete Booking Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
