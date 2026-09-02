-- Pointage de presence et heures de prestation
ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS daily_minutes INT NOT NULL DEFAULT 480;
ALTER TABLE employee_profiles ADD COLUMN IF NOT EXISTS grace_late_minutes INT NOT NULL DEFAULT 15;

CREATE TYPE "AttendancePunchType" AS ENUM ('ENTREE', 'SORTIE', 'PAUSE_DEBUT', 'PAUSE_FIN');
CREATE TYPE "AttendanceSource" AS ENUM ('MOBILE', 'WEB', 'KIOSK', 'MANUEL');
CREATE TYPE "PresenceStatus" AS ENUM ('PRESENT', 'RETARD', 'ABSENT', 'CONGE', 'MISSION', 'INCOMPLET', 'REPOS');

CREATE TABLE IF NOT EXISTS attendance_punches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  punched_at TIMESTAMPTZ NOT NULL,
  type "AttendancePunchType" NOT NULL,
  source "AttendanceSource" NOT NULL DEFAULT 'MOBILE',
  shift_id UUID REFERENCES shift_assignments(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS attendance_punches_user_id_punched_at_idx ON attendance_punches(user_id, punched_at);

CREATE TABLE IF NOT EXISTS attendance_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status "PresenceStatus" NOT NULL DEFAULT 'INCOMPLET',
  shift_id UUID REFERENCES shift_assignments(id),
  planned_minutes INT NOT NULL DEFAULT 0,
  worked_minutes INT NOT NULL DEFAULT 0,
  break_minutes INT NOT NULL DEFAULT 0,
  overtime_minutes INT NOT NULL DEFAULT 0,
  late_minutes INT NOT NULL DEFAULT 0,
  early_leave_minutes INT NOT NULL DEFAULT 0,
  first_in_at TIMESTAMPTZ,
  last_out_at TIMESTAMPTZ,
  notes TEXT,
  adjusted_by_id UUID REFERENCES users(id),
  adjustment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS attendance_days_date_status_idx ON attendance_days(date, status);
