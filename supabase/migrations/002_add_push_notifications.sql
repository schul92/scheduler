-- Migration: Add Push Notification Support
-- Description: Adds push token storage and notification preferences

-- Add push token fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_type TEXT; -- 'ios' or 'android'

-- Add team-level notification toggle to team_members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

-- Create index for efficient push token lookups
CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(push_token) WHERE push_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.push_token IS 'Expo Push Token for sending push notifications';
COMMENT ON COLUMN users.push_token_updated_at IS 'Timestamp when push token was last updated';
COMMENT ON COLUMN users.device_type IS 'Device platform: ios or android';
COMMENT ON COLUMN team_members.notifications_enabled IS 'Whether member wants notifications for this team';
