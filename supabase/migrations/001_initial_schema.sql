-- ============================================================================
-- PraiseFlow Database Schema
-- Version: 1.0.0
-- Description: Complete database schema for worship team scheduling app
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- SECTION 2: CUSTOM TYPES (ENUMs)
-- ============================================================================

-- Membership role within a team (permission level)
CREATE TYPE membership_role_enum AS ENUM ('owner', 'admin', 'member');

-- Team member status
CREATE TYPE member_status_enum AS ENUM ('active', 'inactive', 'pending');

-- Service/event status
CREATE TYPE service_status_enum AS ENUM ('draft', 'published', 'completed', 'cancelled');

-- Assignment response status
CREATE TYPE assignment_status_enum AS ENUM ('pending', 'confirmed', 'declined');

-- Invitation status
CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- Ownership transfer status
CREATE TYPE transfer_status_enum AS ENUM ('pending', 'completed', 'cancelled', 'expired');

-- Proficiency level for roles
CREATE TYPE proficiency_level_enum AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- Calendar sync provider
CREATE TYPE calendar_provider_enum AS ENUM ('google', 'apple', 'outlook');

-- ============================================================================
-- SECTION 3: TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: users
-- Description: Extended user profile, linked to auth.users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    preferred_language TEXT DEFAULT 'ko' CHECK (preferred_language IN ('en', 'ko')),
    kakao_id TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE users IS 'Extended user profiles linked to Supabase auth';
COMMENT ON COLUMN users.preferred_language IS 'User language preference: en (English) or ko (Korean)';
COMMENT ON COLUMN users.kakao_id IS 'KakaoTalk ID for Korean users';

-- ----------------------------------------------------------------------------
-- Table: teams
-- Description: Worship teams/groups
-- ----------------------------------------------------------------------------
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    color TEXT DEFAULT '#D4A574',
    timezone TEXT DEFAULT 'America/Los_Angeles' NOT NULL,
    settings JSONB DEFAULT '{
        "default_service_duration": 90,
        "reminder_hours_before": 24,
        "allow_member_swap": true,
        "require_decline_reason": false,
        "auto_publish_services": false
    }'::JSONB,
    invite_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE teams IS 'Worship teams that users can belong to';
COMMENT ON COLUMN teams.settings IS 'Team-specific settings as JSON';
COMMENT ON COLUMN teams.invite_code IS 'Shareable code for joining the team';

-- ----------------------------------------------------------------------------
-- Table: team_members
-- Description: Junction table linking users to teams with membership info
-- ----------------------------------------------------------------------------
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    membership_role membership_role_enum DEFAULT 'member' NOT NULL,
    status member_status_enum DEFAULT 'active' NOT NULL,
    nickname TEXT,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Each user can only be in a team once
    UNIQUE (team_id, user_id)
);

COMMENT ON TABLE team_members IS 'Links users to teams with their membership role';
COMMENT ON COLUMN team_members.membership_role IS 'Permission level: owner, admin, or member';
COMMENT ON COLUMN team_members.nickname IS 'Optional display name within this team';

-- ----------------------------------------------------------------------------
-- Constraint: Only one owner per team
-- Description: Ensures exactly one owner exists per team
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX unique_team_owner
ON team_members (team_id)
WHERE membership_role = 'owner';

-- ----------------------------------------------------------------------------
-- Table: roles
-- Description: Musical positions/roles within a team
-- ----------------------------------------------------------------------------
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_ko TEXT,
    description TEXT,
    min_required INTEGER DEFAULT 0 CHECK (min_required >= 0),
    max_allowed INTEGER CHECK (max_allowed IS NULL OR max_allowed >= min_required),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true NOT NULL,
    color TEXT,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Role names must be unique within a team
    UNIQUE (team_id, name)
);

COMMENT ON TABLE roles IS 'Musical positions available within each team';
COMMENT ON COLUMN roles.min_required IS 'Minimum number of this role needed per service';
COMMENT ON COLUMN roles.max_allowed IS 'Maximum allowed (NULL = unlimited)';
COMMENT ON COLUMN roles.display_order IS 'Order for displaying roles in UI';

-- ----------------------------------------------------------------------------
-- Table: member_roles
-- Description: Which musical roles each team member can play
-- ----------------------------------------------------------------------------
CREATE TABLE member_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    proficiency_level proficiency_level_enum DEFAULT 'intermediate',
    is_primary BOOLEAN DEFAULT false NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- A member can only have each role once
    UNIQUE (team_member_id, role_id)
);

COMMENT ON TABLE member_roles IS 'Maps team members to the musical roles they can perform';
COMMENT ON COLUMN member_roles.is_primary IS 'Whether this is the members primary/preferred role';
COMMENT ON COLUMN member_roles.proficiency_level IS 'Skill level for this role';

-- ----------------------------------------------------------------------------
-- Table: services
-- Description: Scheduled worship services/events
-- ----------------------------------------------------------------------------
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    service_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    status service_status_enum DEFAULT 'draft' NOT NULL,
    notes TEXT,
    rehearsal_date DATE,
    rehearsal_time TIME,
    location TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE services IS 'Scheduled worship services and events';
COMMENT ON COLUMN services.status IS 'draft: not visible to members, published: visible and accepting responses';
COMMENT ON COLUMN services.published_at IS 'When the service was first published to members';

-- ----------------------------------------------------------------------------
-- Table: service_assignments
-- Description: Role assignments for each service
-- ----------------------------------------------------------------------------
CREATE TABLE service_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    status assignment_status_enum DEFAULT 'pending' NOT NULL,
    decline_reason TEXT,
    notes TEXT,
    responded_at TIMESTAMPTZ,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- A member can only be assigned to each role once per service
    UNIQUE (service_id, team_member_id, role_id)
);

COMMENT ON TABLE service_assignments IS 'Tracks who is assigned to which role for each service';
COMMENT ON COLUMN service_assignments.decline_reason IS 'Reason provided when declining an assignment';

-- ----------------------------------------------------------------------------
-- Table: availability
-- Description: Member availability for scheduling
-- ----------------------------------------------------------------------------
CREATE TABLE availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN DEFAULT true NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- One availability entry per user per team per date
    UNIQUE (user_id, team_id, date)
);

COMMENT ON TABLE availability IS 'Tracks member availability for scheduling purposes';
COMMENT ON COLUMN availability.reason IS 'Optional reason for unavailability';

-- ----------------------------------------------------------------------------
-- Table: team_invitations
-- Description: Pending invitations to join teams
-- ----------------------------------------------------------------------------
CREATE TABLE team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status invitation_status_enum DEFAULT 'pending' NOT NULL,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    message TEXT,
    role_suggestion membership_role_enum DEFAULT 'member',
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Must have either email or phone
    CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

COMMENT ON TABLE team_invitations IS 'Pending invitations for users to join teams';
COMMENT ON COLUMN team_invitations.token IS 'Unique token for accepting invitation via link';
COMMENT ON COLUMN team_invitations.role_suggestion IS 'Suggested membership role upon acceptance';

-- ----------------------------------------------------------------------------
-- Table: ownership_transfers
-- Description: Tracks ownership transfer requests
-- ----------------------------------------------------------------------------
CREATE TABLE ownership_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status transfer_status_enum DEFAULT 'pending' NOT NULL,
    reason TEXT,
    initiated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Cannot transfer to yourself
    CHECK (from_user_id != to_user_id)
);

COMMENT ON TABLE ownership_transfers IS 'Tracks team ownership transfer requests';
COMMENT ON COLUMN ownership_transfers.expires_at IS 'Transfer request expires if not completed';

-- ----------------------------------------------------------------------------
-- Table: calendar_sync
-- Description: External calendar integration tracking
-- ----------------------------------------------------------------------------
CREATE TABLE calendar_sync (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_assignment_id UUID NOT NULL REFERENCES service_assignments(id) ON DELETE CASCADE,
    provider calendar_provider_enum NOT NULL,
    external_event_id TEXT NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- One sync entry per assignment per provider
    UNIQUE (service_assignment_id, provider)
);

COMMENT ON TABLE calendar_sync IS 'Tracks calendar sync status with external providers';
COMMENT ON COLUMN calendar_sync.external_event_id IS 'Event ID in the external calendar system';

-- ============================================================================
-- SECTION 4: INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_kakao_id ON users(kakao_id) WHERE kakao_id IS NOT NULL;
CREATE INDEX idx_users_full_name_trgm ON users USING gin(full_name gin_trgm_ops);

-- Teams indexes
CREATE INDEX idx_teams_owner_id ON teams(owner_id);
CREATE INDEX idx_teams_invite_code ON teams(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX idx_teams_name_trgm ON teams USING gin(name gin_trgm_ops);

-- Team members indexes
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_role ON team_members(membership_role);
CREATE INDEX idx_team_members_status ON team_members(status);
CREATE INDEX idx_team_members_team_user ON team_members(team_id, user_id);

-- Roles indexes
CREATE INDEX idx_roles_team_id ON roles(team_id);
CREATE INDEX idx_roles_display_order ON roles(team_id, display_order);
CREATE INDEX idx_roles_active ON roles(team_id) WHERE is_active = true;

-- Member roles indexes
CREATE INDEX idx_member_roles_team_member_id ON member_roles(team_member_id);
CREATE INDEX idx_member_roles_role_id ON member_roles(role_id);
CREATE INDEX idx_member_roles_primary ON member_roles(team_member_id) WHERE is_primary = true;

-- Services indexes
CREATE INDEX idx_services_team_id ON services(team_id);
CREATE INDEX idx_services_date ON services(service_date);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_services_team_date ON services(team_id, service_date);
CREATE INDEX idx_services_upcoming ON services(team_id, service_date)
    WHERE status IN ('draft', 'published');

-- Service assignments indexes
CREATE INDEX idx_service_assignments_service_id ON service_assignments(service_id);
CREATE INDEX idx_service_assignments_team_member_id ON service_assignments(team_member_id);
CREATE INDEX idx_service_assignments_role_id ON service_assignments(role_id);
CREATE INDEX idx_service_assignments_status ON service_assignments(status);
CREATE INDEX idx_service_assignments_pending ON service_assignments(team_member_id)
    WHERE status = 'pending';

-- Availability indexes
CREATE INDEX idx_availability_user_team ON availability(user_id, team_id);
CREATE INDEX idx_availability_team_date ON availability(team_id, date);
CREATE INDEX idx_availability_unavailable ON availability(team_id, date)
    WHERE is_available = false;

-- Team invitations indexes
CREATE INDEX idx_team_invitations_team_id ON team_invitations(team_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(email) WHERE email IS NOT NULL;
CREATE INDEX idx_team_invitations_phone ON team_invitations(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_invitations_pending ON team_invitations(team_id)
    WHERE status = 'pending';

-- Ownership transfers indexes
CREATE INDEX idx_ownership_transfers_team_id ON ownership_transfers(team_id);
CREATE INDEX idx_ownership_transfers_from_user ON ownership_transfers(from_user_id);
CREATE INDEX idx_ownership_transfers_to_user ON ownership_transfers(to_user_id);
CREATE INDEX idx_ownership_transfers_pending ON ownership_transfers(team_id)
    WHERE status = 'pending';

-- Calendar sync indexes
CREATE INDEX idx_calendar_sync_user_id ON calendar_sync(user_id);
CREATE INDEX idx_calendar_sync_assignment ON calendar_sync(service_assignment_id);

-- ============================================================================
-- SECTION 5: FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: update_updated_at_column
-- Description: Automatically updates updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Function: handle_new_user
-- Description: Creates a user profile when a new auth user signs up
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Function: handle_new_team
-- Description: Adds owner as team member and seeds default roles
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_team()
RETURNS TRIGGER AS $$
BEGIN
    -- Add the owner as a team member
    INSERT INTO team_members (team_id, user_id, membership_role, status)
    VALUES (NEW.id, NEW.owner_id, 'owner', 'active');

    -- Seed default musical roles
    INSERT INTO roles (team_id, name, name_ko, display_order, color) VALUES
        (NEW.id, 'Worship Leader', '인도자', 1, '#E74C3C'),
        (NEW.id, 'Vocals', '보컬', 2, '#9B59B6'),
        (NEW.id, 'Piano', '피아노', 3, '#3498DB'),
        (NEW.id, 'Synthesizer', '신디사이저', 4, '#1ABC9C'),
        (NEW.id, 'Drums', '드럼', 5, '#E67E22'),
        (NEW.id, 'Bass', '베이스', 6, '#2ECC71'),
        (NEW.id, 'Electric Guitar', '일렉기타', 7, '#F39C12'),
        (NEW.id, 'Acoustic Guitar', '어쿠스틱', 8, '#D4A574'),
        (NEW.id, 'Sound', '음향', 9, '#95A5A6');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Function: generate_invite_code
-- Description: Generates a unique 8-character invite code
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Function: set_team_invite_code
-- Description: Sets invite code when team is created
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_team_invite_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    IF NEW.invite_code IS NULL THEN
        LOOP
            new_code := generate_invite_code();
            SELECT EXISTS(SELECT 1 FROM teams WHERE invite_code = new_code) INTO code_exists;
            EXIT WHEN NOT code_exists;
        END LOOP;
        NEW.invite_code := new_code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Function: transfer_team_ownership
-- Description: Safely transfers team ownership between users
-- Parameters:
--   p_team_id: The team to transfer
--   p_new_owner_id: The user ID of the new owner
-- Returns: Boolean indicating success
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION transfer_team_ownership(
    p_team_id UUID,
    p_new_owner_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_owner_id UUID;
    v_new_owner_member_id UUID;
    v_current_owner_member_id UUID;
BEGIN
    -- Get the current owner
    SELECT owner_id INTO v_current_owner_id
    FROM teams
    WHERE id = p_team_id;

    IF v_current_owner_id IS NULL THEN
        RAISE EXCEPTION 'Team not found: %', p_team_id;
    END IF;

    -- Check if new owner is the same as current
    IF v_current_owner_id = p_new_owner_id THEN
        RAISE EXCEPTION 'User is already the owner of this team';
    END IF;

    -- Verify new owner is an active member of the team
    SELECT id INTO v_new_owner_member_id
    FROM team_members
    WHERE team_id = p_team_id
      AND user_id = p_new_owner_id
      AND status = 'active';

    IF v_new_owner_member_id IS NULL THEN
        RAISE EXCEPTION 'New owner must be an active member of the team';
    END IF;

    -- Get current owner's team_member record
    SELECT id INTO v_current_owner_member_id
    FROM team_members
    WHERE team_id = p_team_id
      AND user_id = v_current_owner_id;

    -- Start the transfer (within a transaction)
    -- 1. Update team's owner_id
    UPDATE teams
    SET owner_id = p_new_owner_id,
        updated_at = NOW()
    WHERE id = p_team_id;

    -- 2. Update new owner's membership_role to 'owner'
    UPDATE team_members
    SET membership_role = 'owner',
        updated_at = NOW()
    WHERE id = v_new_owner_member_id;

    -- 3. Demote previous owner to 'admin'
    UPDATE team_members
    SET membership_role = 'admin',
        updated_at = NOW()
    WHERE id = v_current_owner_member_id;

    -- 4. Update any pending transfer records
    UPDATE ownership_transfers
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE team_id = p_team_id
      AND to_user_id = p_new_owner_id
      AND status = 'pending';

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Function: check_can_leave_team
-- Description: Checks if a user can leave a team (owners cannot leave)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_can_leave_team()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent owner from leaving (they must transfer ownership first)
    IF OLD.membership_role = 'owner' THEN
        RAISE EXCEPTION 'Team owner cannot leave. Transfer ownership first.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Function: validate_service_assignment
-- Description: Validates that assignment references valid team relationships
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_service_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_service_team_id UUID;
    v_member_team_id UUID;
    v_role_team_id UUID;
BEGIN
    -- Get the team_id from the service
    SELECT team_id INTO v_service_team_id
    FROM services
    WHERE id = NEW.service_id;

    -- Get the team_id from the team_member
    SELECT team_id INTO v_member_team_id
    FROM team_members
    WHERE id = NEW.team_member_id;

    -- Get the team_id from the role
    SELECT team_id INTO v_role_team_id
    FROM roles
    WHERE id = NEW.role_id;

    -- Verify all belong to the same team
    IF v_service_team_id != v_member_team_id OR v_service_team_id != v_role_team_id THEN
        RAISE EXCEPTION 'Service, team member, and role must all belong to the same team';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SECTION 6: TRIGGERS
-- ============================================================================

-- Auto-create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-setup team on creation (add owner, seed roles)
CREATE TRIGGER on_team_created
    AFTER INSERT ON teams
    FOR EACH ROW EXECUTE FUNCTION handle_new_team();

-- Generate invite code before team insert
CREATE TRIGGER before_team_insert
    BEFORE INSERT ON teams
    FOR EACH ROW EXECUTE FUNCTION set_team_invite_code();

-- Prevent owner from being deleted from team
CREATE TRIGGER before_team_member_delete
    BEFORE DELETE ON team_members
    FOR EACH ROW EXECUTE FUNCTION check_can_leave_team();

-- Validate service assignments
CREATE TRIGGER before_service_assignment_insert
    BEFORE INSERT ON service_assignments
    FOR EACH ROW EXECUTE FUNCTION validate_service_assignment();

CREATE TRIGGER before_service_assignment_update
    BEFORE UPDATE ON service_assignments
    FOR EACH ROW EXECUTE FUNCTION validate_service_assignment();

-- Updated_at triggers for all tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_roles_updated_at
    BEFORE UPDATE ON member_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_assignments_updated_at
    BEFORE UPDATE ON service_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_availability_updated_at
    BEFORE UPDATE ON availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_invitations_updated_at
    BEFORE UPDATE ON team_invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ownership_transfers_updated_at
    BEFORE UPDATE ON ownership_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_sync_updated_at
    BEFORE UPDATE ON calendar_sync
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 7: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownership_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS Policies: users
-- ----------------------------------------------------------------------------

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

-- Users can view profiles of people in their teams
CREATE POLICY "Users can view team members profiles"
    ON users FOR SELECT
    USING (
        id IN (
            SELECT tm2.user_id
            FROM team_members tm1
            JOIN team_members tm2 ON tm1.team_id = tm2.team_id
            WHERE tm1.user_id = auth.uid()
        )
    );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- RLS Policies: teams
-- ----------------------------------------------------------------------------

-- Users can view teams they belong to
CREATE POLICY "Users can view their teams"
    ON teams FOR SELECT
    USING (
        id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- Any authenticated user can create a team
CREATE POLICY "Users can create teams"
    ON teams FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Only owner/admin can update team
CREATE POLICY "Owner and admin can update team"
    ON teams FOR UPDATE
    USING (
        id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

-- Only owner can delete team
CREATE POLICY "Only owner can delete team"
    ON teams FOR DELETE
    USING (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS Policies: team_members
-- ----------------------------------------------------------------------------

-- Users can view members of their teams
CREATE POLICY "Users can view team members"
    ON team_members FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- Owner/admin can add members
CREATE POLICY "Owner and admin can add members"
    ON team_members FOR INSERT
    WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
        OR user_id = auth.uid() -- Allow self-join via invitation
    );

-- Owner/admin can update members (but not change owner's role)
CREATE POLICY "Owner and admin can update members"
    ON team_members FOR UPDATE
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

-- Users can leave teams (delete their own membership)
CREATE POLICY "Users can leave teams"
    ON team_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

-- ----------------------------------------------------------------------------
-- RLS Policies: roles
-- ----------------------------------------------------------------------------

-- Users can view roles for their teams
CREATE POLICY "Users can view team roles"
    ON roles FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- Owner/admin can manage roles
CREATE POLICY "Owner and admin can create roles"
    ON roles FOR INSERT
    WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Owner and admin can update roles"
    ON roles FOR UPDATE
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Owner and admin can delete roles"
    ON roles FOR DELETE
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

-- ----------------------------------------------------------------------------
-- RLS Policies: member_roles
-- ----------------------------------------------------------------------------

-- Users can view member roles in their teams
CREATE POLICY "Users can view member roles"
    ON member_roles FOR SELECT
    USING (
        team_member_id IN (
            SELECT tm2.id
            FROM team_members tm1
            JOIN team_members tm2 ON tm1.team_id = tm2.team_id
            WHERE tm1.user_id = auth.uid()
        )
    );

-- Users can manage their own roles, owner/admin can manage any
CREATE POLICY "Users can manage own member roles"
    ON member_roles FOR INSERT
    WITH CHECK (
        team_member_id IN (
            SELECT id FROM team_members WHERE user_id = auth.uid()
        )
        OR team_member_id IN (
            SELECT tm2.id
            FROM team_members tm1
            JOIN team_members tm2 ON tm1.team_id = tm2.team_id
            WHERE tm1.user_id = auth.uid()
            AND tm1.membership_role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can update own member roles"
    ON member_roles FOR UPDATE
    USING (
        team_member_id IN (
            SELECT id FROM team_members WHERE user_id = auth.uid()
        )
        OR team_member_id IN (
            SELECT tm2.id
            FROM team_members tm1
            JOIN team_members tm2 ON tm1.team_id = tm2.team_id
            WHERE tm1.user_id = auth.uid()
            AND tm1.membership_role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can delete own member roles"
    ON member_roles FOR DELETE
    USING (
        team_member_id IN (
            SELECT id FROM team_members WHERE user_id = auth.uid()
        )
        OR team_member_id IN (
            SELECT tm2.id
            FROM team_members tm1
            JOIN team_members tm2 ON tm1.team_id = tm2.team_id
            WHERE tm1.user_id = auth.uid()
            AND tm1.membership_role IN ('owner', 'admin')
        )
    );

-- ----------------------------------------------------------------------------
-- RLS Policies: services
-- ----------------------------------------------------------------------------

-- Members can view published services, owner/admin can view all
CREATE POLICY "Members can view services"
    ON services FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
        AND (
            status IN ('published', 'completed')
            OR team_id IN (
                SELECT team_id FROM team_members
                WHERE user_id = auth.uid()
                AND membership_role IN ('owner', 'admin')
            )
        )
    );

-- Owner/admin can create services
CREATE POLICY "Owner and admin can create services"
    ON services FOR INSERT
    WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

-- Owner/admin can update services
CREATE POLICY "Owner and admin can update services"
    ON services FOR UPDATE
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

-- Owner/admin can delete services
CREATE POLICY "Owner and admin can delete services"
    ON services FOR DELETE
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

-- ----------------------------------------------------------------------------
-- RLS Policies: service_assignments
-- ----------------------------------------------------------------------------

-- Users can view assignments for services they can see
CREATE POLICY "Users can view service assignments"
    ON service_assignments FOR SELECT
    USING (
        service_id IN (
            SELECT s.id FROM services s
            JOIN team_members tm ON s.team_id = tm.team_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- Owner/admin can create assignments
CREATE POLICY "Owner and admin can create assignments"
    ON service_assignments FOR INSERT
    WITH CHECK (
        service_id IN (
            SELECT s.id FROM services s
            JOIN team_members tm ON s.team_id = tm.team_id
            WHERE tm.user_id = auth.uid()
            AND tm.membership_role IN ('owner', 'admin')
        )
    );

-- Owner/admin can update any, members can update their own status
CREATE POLICY "Users can update assignments"
    ON service_assignments FOR UPDATE
    USING (
        -- Own assignment
        team_member_id IN (
            SELECT id FROM team_members WHERE user_id = auth.uid()
        )
        OR
        -- Or is owner/admin
        service_id IN (
            SELECT s.id FROM services s
            JOIN team_members tm ON s.team_id = tm.team_id
            WHERE tm.user_id = auth.uid()
            AND tm.membership_role IN ('owner', 'admin')
        )
    );

-- Owner/admin can delete assignments
CREATE POLICY "Owner and admin can delete assignments"
    ON service_assignments FOR DELETE
    USING (
        service_id IN (
            SELECT s.id FROM services s
            JOIN team_members tm ON s.team_id = tm.team_id
            WHERE tm.user_id = auth.uid()
            AND tm.membership_role IN ('owner', 'admin')
        )
    );

-- ----------------------------------------------------------------------------
-- RLS Policies: availability
-- ----------------------------------------------------------------------------

-- Users can view availability for their teams
CREATE POLICY "Users can view team availability"
    ON availability FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members WHERE user_id = auth.uid()
        )
    );

-- Users can manage their own availability
CREATE POLICY "Users can manage own availability"
    ON availability FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own availability"
    ON availability FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own availability"
    ON availability FOR DELETE
    USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS Policies: team_invitations
-- ----------------------------------------------------------------------------

-- Owner/admin can view invitations for their teams
CREATE POLICY "Owner and admin can view invitations"
    ON team_invitations FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
        -- Or the invitation is for this user
        OR email = (SELECT email FROM users WHERE id = auth.uid())
    );

-- Owner/admin can create invitations
CREATE POLICY "Owner and admin can create invitations"
    ON team_invitations FOR INSERT
    WITH CHECK (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

-- Owner/admin can update invitations
CREATE POLICY "Owner and admin can update invitations"
    ON team_invitations FOR UPDATE
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

-- Owner/admin can delete invitations
CREATE POLICY "Owner and admin can delete invitations"
    ON team_invitations FOR DELETE
    USING (
        team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role IN ('owner', 'admin')
        )
    );

-- ----------------------------------------------------------------------------
-- RLS Policies: ownership_transfers
-- ----------------------------------------------------------------------------

-- Involved parties can view transfer requests
CREATE POLICY "Users can view their transfer requests"
    ON ownership_transfers FOR SELECT
    USING (
        from_user_id = auth.uid()
        OR to_user_id = auth.uid()
    );

-- Only current owner can initiate transfer
CREATE POLICY "Owner can initiate transfer"
    ON ownership_transfers FOR INSERT
    WITH CHECK (
        from_user_id = auth.uid()
        AND team_id IN (
            SELECT team_id FROM team_members
            WHERE user_id = auth.uid()
            AND membership_role = 'owner'
        )
    );

-- Involved parties can update transfer
CREATE POLICY "Involved parties can update transfer"
    ON ownership_transfers FOR UPDATE
    USING (
        from_user_id = auth.uid()
        OR to_user_id = auth.uid()
    );

-- ----------------------------------------------------------------------------
-- RLS Policies: calendar_sync
-- ----------------------------------------------------------------------------

-- Users can manage their own calendar syncs
CREATE POLICY "Users can view own calendar sync"
    ON calendar_sync FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create own calendar sync"
    ON calendar_sync FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own calendar sync"
    ON calendar_sync FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own calendar sync"
    ON calendar_sync FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- SECTION 8: GRANTS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant access to tables for authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant limited access for anonymous users (for invite acceptance)
GRANT SELECT ON teams TO anon;
GRANT SELECT ON team_invitations TO anon;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
