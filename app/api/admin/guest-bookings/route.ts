import { NextResponse } from 'next/server';
import { requireStaffApi } from '@/lib/require-staff-api';

type GuestBookingStatus = 'booked' | 'attended' | 'no_show';

function normalizeContact(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;
  const { supabase } = staffAuth;

  try {
    const staffTenantId = staffAuth.profile.tenant_id as string | null;
    if (!staffTenantId) {
      return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const recent = searchParams.get('recent') === '1';

    if (recent) {
      const { data, error } = await supabase
        .from('guest_athletes')
        .select('id, full_name, whatsapp, instagram, created_at')
        .eq('tenant_id', staffTenantId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return NextResponse.json({ guests: data ?? [] });
    }

    if (!classId) {
      return NextResponse.json({ error: 'Missing classId' }, { status: 400 });
    }

    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, tenant_id')
      .eq('id', classId)
      .maybeSingle();

    if (classError || !classData || classData.tenant_id !== staffTenantId) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('guest_bookings')
      .select(`
        id, status, guest_athlete_id,
        guest:guest_athlete_id (id, full_name, whatsapp, instagram)
      `)
      .eq('class_id', classId)
      .eq('tenant_id', staffTenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const guests = (data ?? []).map((row) => {
      const guest = Array.isArray(row.guest) ? row.guest[0] : row.guest;
      return {
        id: row.id,
        status: row.status as GuestBookingStatus,
        guest_athlete_id: row.guest_athlete_id as string,
        full_name: guest?.full_name ?? 'Guest',
        whatsapp: guest?.whatsapp ?? null,
        instagram: guest?.instagram ?? null,
      };
    });

    return NextResponse.json({ guests });
  } catch (error: unknown) {
    console.error('List guest bookings error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;
  const { supabase } = staffAuth;

  try {
    const body = await request.json();
    const classId = body.classId as string | undefined;
    const guestAthleteId = body.guestAthleteId as string | undefined;
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const whatsapp = normalizeContact(body.whatsapp);
    const instagram = normalizeContact(body.instagram);
    const staffTenantId = staffAuth.profile.tenant_id as string | null;
    const staffUserId = staffAuth.user.id;

    if (!classId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!guestAthleteId && !fullName) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!staffTenantId) {
      return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
    }

    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, max_capacity, tenant_id')
      .eq('id', classId)
      .maybeSingle();

    if (classError || !classData || classData.tenant_id !== staffTenantId) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const { data: occupancy, error: occError } = await supabase.rpc(
      'class_active_occupancy',
      { p_class_id: classId },
    );
    if (occError) throw occError;
    if ((occupancy as number) >= classData.max_capacity) {
      return NextResponse.json({ error: 'Class is at full capacity' }, { status: 409 });
    }

    let resolvedGuestId = guestAthleteId ?? null;
    let guestRow: {
      id: string;
      full_name: string;
      whatsapp: string | null;
      instagram: string | null;
    } | null = null;

    if (resolvedGuestId) {
      const { data: existingGuest, error: guestError } = await supabase
        .from('guest_athletes')
        .select('id, full_name, whatsapp, instagram')
        .eq('id', resolvedGuestId)
        .eq('tenant_id', staffTenantId)
        .maybeSingle();

      if (guestError) throw guestError;
      if (!existingGuest) {
        return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
      }
      guestRow = existingGuest;
    } else {
      const { data: createdGuest, error: createError } = await supabase
        .from('guest_athletes')
        .insert({
          tenant_id: staffTenantId,
          full_name: fullName,
          whatsapp,
          instagram,
          created_by: staffUserId,
        })
        .select('id, full_name, whatsapp, instagram')
        .single();

      if (createError) throw createError;
      guestRow = createdGuest;
      resolvedGuestId = createdGuest.id;
    }

    const { data: existingBooking } = await supabase
      .from('guest_bookings')
      .select('id')
      .eq('class_id', classId)
      .eq('guest_athlete_id', resolvedGuestId)
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json(
        { error: 'Guest is already on this class' },
        { status: 409 },
      );
    }

    const { data: booking, error: bookingError } = await supabase
      .from('guest_bookings')
      .insert({
        tenant_id: staffTenantId,
        class_id: classId,
        guest_athlete_id: resolvedGuestId,
        status: 'booked',
      })
      .select('id, status, guest_athlete_id')
      .single();

    if (bookingError) throw bookingError;

    return NextResponse.json({
      guest: {
        id: booking.id,
        status: booking.status as GuestBookingStatus,
        guest_athlete_id: booking.guest_athlete_id as string,
        full_name: guestRow!.full_name,
        whatsapp: guestRow!.whatsapp,
        instagram: guestRow!.instagram,
      },
    });
  } catch (error: unknown) {
    console.error('Create guest booking error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;
  const { supabase } = staffAuth;

  try {
    const body = await request.json();
    const guestBookingId = body.guestBookingId as string | undefined;
    const status = body.status as GuestBookingStatus | undefined;
    const staffTenantId = staffAuth.profile.tenant_id as string | null;

    if (!guestBookingId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!['booked', 'attended', 'no_show'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (!staffTenantId) {
      return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('guest_bookings')
      .select('id, tenant_id')
      .eq('id', guestBookingId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing || existing.tenant_id !== staffTenantId) {
      return NextResponse.json({ error: 'Guest booking not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('guest_bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', guestBookingId)
      .eq('tenant_id', staffTenantId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Update guest booking error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const staffAuth = await requireStaffApi();
  if ('error' in staffAuth) return staffAuth.error;
  const { supabase } = staffAuth;

  try {
    const body = await request.json();
    const guestBookingId = body.guestBookingId as string | undefined;
    const staffTenantId = staffAuth.profile.tenant_id as string | null;

    if (!guestBookingId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!staffTenantId) {
      return NextResponse.json({ error: 'Missing tenant context.' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('guest_bookings')
      .select('id, tenant_id')
      .eq('id', guestBookingId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing || existing.tenant_id !== staffTenantId) {
      return NextResponse.json({ error: 'Guest booking not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('guest_bookings')
      .delete()
      .eq('id', guestBookingId)
      .eq('tenant_id', staffTenantId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete guest booking error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
