-- ============================================================
-- RippleBox MVP Schema (Postgres / RDS or Aurora Serverless v2)
-- Scope: auth, salons, per-salon points, rewards, redemptions,
--        referrals. Extend later for campaigns/notifications/etc.
-- ============================================================

-- ---------- Users & roles ----------

CREATE TYPE user_role AS ENUM ('client', 'salon_owner');

-- Auth is handled by Cognito (see backend/template.yaml UserPool). id is the
-- Cognito user's `sub`, set explicitly by the PostConfirmation trigger - not
-- generated here.
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    role            user_role NOT NULL,
    name            TEXT NOT NULL,
    phone           TEXT,
    avatar_url      TEXT,
    referral_code   TEXT UNIQUE,            -- clients only, but kept nullable here for simplicity
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_referral_code ON users(referral_code);

-- ---------- Salons ----------

CREATE TABLE salons (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- UNIQUE: one owner has exactly one salon everywhere else in the app
    -- (requireOwnedSalonId assumes it) - also doubles as the guard against
    -- PostConfirmation's Lambda trigger being retried by Cognito creating a
    -- second salon row for the same signup.
    owner_user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    address             TEXT,
    -- Owner-set GPS coordinates (captured via the browser's Geolocation API
    -- while physically at the salon - not geocoded from `address`, so this
    -- can be null even when address is filled in). Address-to-coordinates
    -- geocoding is a paid/rate-limited API integration, deferred on purpose.
    latitude            NUMERIC(9,6),
    longitude           NUMERIC(9,6),
    phone               TEXT,
    email               TEXT,
    description         TEXT,
    image_url           TEXT,
    reward_multiplier   NUMERIC(3,2) NOT NULL DEFAULT 1.0,
    rating              NUMERIC(2,1),
    review_count        INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_salons_owner ON salons(owner_user_id);

-- Which services a salon offers, with the price the salon charges for each
-- (normalize further later if needed, e.g. duration, category)
CREATE TABLE salon_services (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id      UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    points_value  INTEGER NOT NULL DEFAULT 0 CHECK (points_value >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client's favorited salons
CREATE TABLE favorite_salons (
    client_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    salon_id    UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    PRIMARY KEY (client_id, salon_id)
);

-- ---------- Per-salon points (the core business rule) ----------

-- Current balance snapshot per client per salon. Kept as a materialized
-- balance for fast reads, but every change MUST also write a row to
-- point_transactions in the same DB transaction - never update this
-- table without the matching ledger entry.
CREATE TABLE salon_points_balance (
    client_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    salon_id    UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    points      INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (client_id, salon_id)
);

-- Immutable audit log of every earn/spend event. This is the source of
-- truth if the balance table ever needs to be rebuilt/reconciled.
CREATE TYPE transaction_type AS ENUM ('earn_visit', 'earn_referral', 'earn_appointment', 'redeem', 'adjustment', 'expiry');

CREATE TABLE point_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    salon_id        UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    type            transaction_type NOT NULL,
    points_delta    INTEGER NOT NULL,       -- positive for earn, negative for redeem/expiry
    reference_id    UUID,                   -- e.g. redemption id or referral id this transaction relates to
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_tx_client_salon ON point_transactions(client_id, salon_id);

-- ---------- Rewards & redemptions ----------

CREATE TABLE rewards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id        UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    points_cost     INTEGER NOT NULL CHECK (points_cost > 0),
    category        TEXT,                  -- discount / freebie / premium / credit
    is_active       BOOLEAN NOT NULL DEFAULT true,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rewards_salon ON rewards(salon_id);

CREATE TABLE redemptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    salon_id        UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    reward_id       UUID NOT NULL REFERENCES rewards(id),
    points_spent    INTEGER NOT NULL,
    redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_redemptions_client_salon ON redemptions(client_id, salon_id);

-- ---------- Visits (what actually triggers points) ----------

-- 'referral' vs 'direct' is the only acquisition channel the app can
-- actually detect (a visit completing a pending referral - see visits.ts).
-- There's no 'marketing' value: campaigns have no attribution/redemption
-- mechanism linking a visit back to a specific campaign, so a 3-way source
-- breakdown would be fabricated. Extend this enum only once that exists.
CREATE TYPE visit_source AS ENUM ('referral', 'direct');

CREATE TABLE visits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    salon_id        UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    logged_by       UUID NOT NULL REFERENCES users(id),  -- salon staff/owner who marked it complete (MVP: manual entry)
    amount_spent    NUMERIC(10,2),
    points_earned   INTEGER NOT NULL DEFAULT 0,
    source          visit_source NOT NULL DEFAULT 'direct',
    visited_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visits_client_salon ON visits(client_id, salon_id);

-- ---------- Referrals ----------

CREATE TYPE referral_status AS ENUM ('pending', 'completed');

CREATE TABLE referrals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id     UUID REFERENCES users(id) ON DELETE SET NULL,  -- null until the friend actually signs up
    salon_id        UUID NOT NULL REFERENCES salons(id),           -- salon chosen by referrer at invite time
    status          referral_status NOT NULL DEFAULT 'pending',
    points_awarded  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_salon ON referrals(salon_id);

-- ---------- Campaigns ----------

CREATE TYPE campaign_type AS ENUM ('referral', 'empty_appointment', 'loyalty');
CREATE TYPE campaign_status AS ENUM ('active', 'paused');

CREATE TABLE campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id            UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    type                campaign_type NOT NULL,
    discount_percent    INTEGER,
    status              campaign_status NOT NULL DEFAULT 'active',
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    -- No campaign-redemption action exists anywhere in the app yet (unlike
    -- rewards), so this only ever reflects real usage (0) rather than being
    -- decorative/fake - nothing increments it until a real redeem flow exists.
    redemptions         INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_salon ON campaigns(salon_id);

-- ---------- Notifications ----------

CREATE TYPE notification_type AS ENUM ('reward', 'referral', 'appointment', 'alert', 'info');

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        notification_type NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

-- ---------- Appointments & payments ----------

CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'declined', 'cancelled');
CREATE TYPE appointment_payment_method AS ENUM ('pay_now', 'pay_later');
-- 'refunded' exists for completeness but nothing in the app issues refunds
-- yet - no cancellation path reverses a 'paid' status. Wire that up once a
-- real refund flow (Stripe refund API + salon-owner UI for it) exists.
CREATE TYPE appointment_payment_status AS ENUM ('unpaid', 'paid', 'refunded');

CREATE TABLE appointments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salon_id                    UUID NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
    client_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- No ON DELETE CASCADE/SET NULL: a service that's ever been booked can't
    -- be hard-deleted (see deleteSalonService), same protected-history
    -- pattern as rewards/redemptions - this FK staying valid is what lets
    -- the service name be looked up live rather than needing a snapshot.
    service_id                  UUID NOT NULL REFERENCES salon_services(id),
    -- Price IS snapshotted (unlike the name) because it's a financial fact
    -- of what the client agreed to pay - same reasoning as
    -- redemptions.points_spent. A later price edit on the service must not
    -- silently change what an existing booking owes.
    price                       NUMERIC(10,2) NOT NULL,
    appointment_date            DATE NOT NULL,
    appointment_time            TEXT NOT NULL,
    status                      appointment_status NOT NULL DEFAULT 'pending',
    payment_method               appointment_payment_method NOT NULL,
    payment_status               appointment_payment_status NOT NULL DEFAULT 'unpaid',
    stripe_payment_intent_id     TEXT,
    -- Snapshotted like price - the service's points_value could change
    -- later, but this records what was actually awarded (or would be
    -- reversed) for this specific booking. Only ever non-zero for a
    -- pay_now booking that successfully awarded points at payment time;
    -- pay_later bookings earn points via a logged visit instead (see
    -- visits.appointment_id below), not at booking time.
    points_awarded               INTEGER NOT NULL DEFAULT 0,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_salon ON appointments(salon_id, appointment_date);
CREATE INDEX idx_appointments_client ON appointments(client_id, appointment_date);

-- Lets a logged visit point back to the specific pre-paid appointment it
-- fulfills, so logVisit can tell points were already awarded at booking
-- time (appointments.points_awarded) and skip awarding them again.
ALTER TABLE visits ADD COLUMN appointment_id UUID REFERENCES appointments(id);

-- One appointment can be linked to at most one visit, ever - a plain UNIQUE
-- constraint would also reject multiple NULLs (most visits have no linked
-- appointment at all), so this is a partial index instead, only enforcing
-- uniqueness among the non-null values.
CREATE UNIQUE INDEX idx_visits_appointment_id_unique ON visits(appointment_id) WHERE appointment_id IS NOT NULL;

-- ============================================================
-- Notes:
-- - Every earn/redeem must run inside a single DB transaction that
--   both updates salon_points_balance AND inserts into point_transactions.
--   Never let one happen without the other.
-- - Redemption logic (pseudocode):
--     BEGIN;
--       SELECT points FROM salon_points_balance
--         WHERE client_id=? AND salon_id=? FOR UPDATE;   -- row lock
--       -- check points >= reward.points_cost in application code
--       UPDATE salon_points_balance SET points = points - :cost WHERE ...;
--       INSERT INTO point_transactions (...) VALUES (..., 'redeem', -:cost, ...);
--       INSERT INTO redemptions (...) VALUES (...);
--     COMMIT;
--   The FOR UPDATE row lock is what prevents double-redemption from
--   two simultaneous requests.
-- ============================================================
