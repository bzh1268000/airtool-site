import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const XP_FALLBACKS: Record<string, number> = {
  booking_confirmed:  3,
  booking_approved:   3,
  booking_in_use:     2,
  booking_completed:  5,
  booking_disputed:  -5,
  booking_cancelled: -1,
  review_written:     2,
  dispute_won:        2,
  dispute_lost:     -10,
}

const STATUS_EVENTS: Record<string, { renter?: string; owner?: string }> = {
  confirmed:  { renter: 'booking_confirmed' },
  approved:   { owner:  'booking_approved'  },
  in_use:     { renter: 'booking_in_use',    owner: 'booking_in_use'    },
  completed:  { renter: 'booking_completed', owner: 'booking_completed' },
  disputed:   { renter: 'booking_disputed',  owner: 'booking_disputed'  },
  cancelled:  { renter: 'booking_cancelled', owner: 'booking_cancelled' },
}

export async function POST(req: Request) {
  try {
    const { booking_id, new_status } = await req.json()

    if (!booking_id || !new_status) {
      return NextResponse.json(
        { error: 'booking_id and new_status are required' },
        { status: 400 }
      )
    }

    const events = STATUS_EVENTS[new_status]
    if (!events) {
      return NextResponse.json({ awarded: [] })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('id, user_email, owner_email')
      .eq('id', booking_id)
      .single()

    if (bErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key, value')
      .like('key', 'xp_rule.%')

    const xpMap: Record<string, number> = { ...XP_FALLBACKS }
    settings?.forEach(s => {
      const k = s.key.replace('xp_rule.', '')
      xpMap[k] = parseInt(s.value)
    })

    const inserts = []

    if (events.renter && booking.user_email) {
      const { data: renterProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', booking.user_email)
        .single()

      if (renterProfile) {
        inserts.push({
          user_id:    renterProfile.id,
          role:       'renter',
          event_type: events.renter,
          points:     xpMap[events.renter] ?? 0,
          booking_id: booking_id,
          notes:      `Booking #${booking_id} → ${new_status}`,
        })
      }
    }

    if (events.owner && booking.owner_email) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', booking.owner_email)
        .single()

      if (ownerProfile) {
        inserts.push({
          user_id:    ownerProfile.id,
          role:       'owner',
          event_type: events.owner,
          points:     xpMap[events.owner] ?? 0,
          booking_id: booking_id,
          notes:      `Booking #${booking_id} → ${new_status}`,
        })
      }
    }

    if (inserts.length === 0) {
      return NextResponse.json({ awarded: [] })
    }

    const { error: xpErr } = await supabase
      .from('experience_points')
      .insert(inserts)

    if (xpErr) {
      console.error('XP insert error:', xpErr)
      return NextResponse.json({ error: xpErr.message }, { status: 500 })
    }

    return NextResponse.json({ awarded: inserts })

  } catch (err) {
    console.error('XP award error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
