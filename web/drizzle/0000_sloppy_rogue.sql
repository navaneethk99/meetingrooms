ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "require_sign_in" boolean DEFAULT false NOT NULL;
