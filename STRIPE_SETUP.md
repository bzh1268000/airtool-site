# Stripe Integration Setup

## 1. Supabase — run this SQL in the SQL Editor

```sql
-- Add payment columns to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at           TIMESTAMPTZ;
```

## 2. Environment variables — add to .env.local

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Supabase service role (for server-side webhook writes — bypasses RLS)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Your site URL (used for Stripe success/cancel redirect URLs)
NEXT_PUBLIC_SITE_URL=https://airtool.nz
```

## 3. Stripe Dashboard setup

1. Go to https://dashboard.stripe.com/test/webhooks
2. Add endpoint: `https://airtool.nz/api/webhook/stripe`
3. Select event: `checkout.session.completed`
4. Copy the signing secret → paste as STRIPE_WEBHOOK_SECRET

## 4. Local testing with Stripe CLI

```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

## 5. Payment flow

1. Renter submits booking → status: `pending`
2. Owner approves → status: `approved`  
3. Renter confirms → status: `confirmed`
4. Renter clicks "Pay Now" → POST /api/checkout → Stripe Checkout
5. Stripe webhook fires `checkout.session.completed` → status: `in_use`, `paid_at` set
6. After return → status: `completed`
