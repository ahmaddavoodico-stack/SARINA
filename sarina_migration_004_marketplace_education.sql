-- SARINA Migration 004: Marketplace and Education
-- PostgreSQL 15+
-- Depends on migrations 001, 002 and 003.

BEGIN;

-- ---------------------------------------------------------------------------
-- Marketplace taxonomy and seller catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    code VARCHAR(80) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_category_localizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
    language_code VARCHAR(12) NOT NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    UNIQUE (category_id, language_code)
);

CREATE TABLE IF NOT EXISTS marketplace_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    product_code VARCHAR(100),
    product_type VARCHAR(40) NOT NULL DEFAULT 'physical'
        CHECK (product_type IN ('physical', 'digital', 'service')),
    status VARCHAR(24) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
    brand_name VARCHAR(180),
    requires_expert_review BOOLEAN NOT NULL DEFAULT FALSE,
    review_status VARCHAR(24) NOT NULL DEFAULT 'not_required'
        CHECK (review_status IN ('not_required', 'pending', 'approved', 'rejected')),
    origin_country_code CHAR(2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (seller_organization_id, product_code)
);

CREATE TABLE IF NOT EXISTS marketplace_product_localizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
    language_code VARCHAR(12) NOT NULL,
    name VARCHAR(220) NOT NULL,
    short_description VARCHAR(500),
    description TEXT,
    usage_instructions TEXT,
    safety_information TEXT,
    UNIQUE (product_id, language_code)
);

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
    sku VARCHAR(120) NOT NULL UNIQUE,
    variant_name VARCHAR(180),
    attributes JSONB NOT NULL DEFAULT '{}'::JSONB,
    currency_code CHAR(3) NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    compare_at_price NUMERIC(14,2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    media_type VARCHAR(24) NOT NULL CHECK (media_type IN ('image', 'document', 'video_reference')),
    alt_text VARCHAR(300),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    location_name VARCHAR(180) NOT NULL,
    country_code CHAR(2),
    address_text TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    inventory_location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
    quantity_on_hand NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    quantity_reserved NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (quantity_reserved <= quantity_on_hand),
    UNIQUE (variant_id, inventory_location_id)
);

CREATE TABLE IF NOT EXISTS inventory_stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id UUID NOT NULL REFERENCES inventory_stock(id) ON DELETE RESTRICT,
    movement_type VARCHAR(24) NOT NULL
        CHECK (movement_type IN ('receipt', 'reservation', 'release', 'sale', 'return', 'adjustment')),
    quantity_delta NUMERIC(14,3) NOT NULL,
    reference_type VARCHAR(40),
    reference_id UUID,
    notes TEXT,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Orders, payment references, fulfillment and returns
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS marketplace_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(64) NOT NULL UNIQUE,
    buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    country_code CHAR(2),
    currency_code CHAR(3) NOT NULL,
    status VARCHAR(28) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'processing', 'partially_fulfilled',
                          'fulfilled', 'cancelled', 'completed', 'refunded')),
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
    shipping_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (shipping_total >= 0),
    tax_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
    grand_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
    shipping_address JSONB,
    billing_address JSONB,
    customer_note TEXT,
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    seller_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(220) NOT NULL,
    sku_snapshot VARCHAR(120) NOT NULL,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    line_discount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
    line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0),
    currency_code CHAR(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE RESTRICT,
    provider_code VARCHAR(80) NOT NULL,
    provider_transaction_reference VARCHAR(180),
    payment_method_type VARCHAR(40),
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    currency_code CHAR(3) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'initiated'
        CHECK (status IN ('initiated', 'authorized', 'captured', 'failed', 'cancelled', 'refunded')),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_fulfillments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE RESTRICT,
    seller_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    fulfillment_status VARCHAR(24) NOT NULL DEFAULT 'pending'
        CHECK (fulfillment_status IN ('pending', 'packed', 'shipped', 'delivered', 'cancelled')),
    carrier_name VARCHAR(120),
    tracking_reference VARCHAR(180),
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_fulfillment_items (
    fulfillment_id UUID NOT NULL REFERENCES order_fulfillments(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES marketplace_order_items(id) ON DELETE RESTRICT,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (fulfillment_id, order_item_id)
);

CREATE TABLE IF NOT EXISTS order_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE RESTRICT,
    order_item_id UUID REFERENCES marketplace_order_items(id) ON DELETE RESTRICT,
    requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason_code VARCHAR(80),
    description TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'approved', 'rejected', 'received', 'refunded', 'closed')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Education catalog and learner progress
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS educational_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES educational_categories(id) ON DELETE SET NULL,
    code VARCHAR(80) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS educational_category_localizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES educational_categories(id) ON DELETE CASCADE,
    language_code VARCHAR(12) NOT NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    UNIQUE (category_id, language_code)
);

CREATE TABLE IF NOT EXISTS educational_content_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    provider_name VARCHAR(180) NOT NULL,
    provider_type VARCHAR(32) NOT NULL DEFAULT 'organization'
        CHECK (provider_type IN ('organization', 'expert', 'Sarina', 'external')),
    website_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS educational_contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES educational_categories(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES educational_content_providers(id) ON DELETE SET NULL,
    content_type VARCHAR(24) NOT NULL
        CHECK (content_type IN ('article', 'video', 'course', 'podcast', 'guide')),
    status VARCHAR(24) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
    difficulty_level VARCHAR(20)
        CHECK (difficulty_level IS NULL OR difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_duration_minutes INTEGER CHECK (estimated_duration_minutes IS NULL OR estimated_duration_minutes >= 0),
    thumbnail_storage_key TEXT,
    external_provider VARCHAR(80),
    external_content_reference TEXT,
    age_min SMALLINT CHECK (age_min IS NULL OR age_min >= 0),
    age_max SMALLINT CHECK (age_max IS NULL OR age_max >= 0),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (age_min IS NULL OR age_max IS NULL OR age_max >= age_min)
);

CREATE TABLE IF NOT EXISTS educational_content_localizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES educational_contents(id) ON DELETE CASCADE,
    language_code VARCHAR(12) NOT NULL,
    title VARCHAR(240) NOT NULL,
    summary VARCHAR(600),
    body TEXT,
    transcript TEXT,
    UNIQUE (content_id, language_code)
);

CREATE TABLE IF NOT EXISTS educational_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES educational_contents(id) ON DELETE CASCADE,
    lesson_order INTEGER NOT NULL,
    duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    external_content_reference TEXT,
    is_preview BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (content_id, lesson_order)
);

CREATE TABLE IF NOT EXISTS educational_lesson_localizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES educational_lessons(id) ON DELETE CASCADE,
    language_code VARCHAR(12) NOT NULL,
    title VARCHAR(240) NOT NULL,
    body TEXT,
    UNIQUE (lesson_id, language_code)
);

CREATE TABLE IF NOT EXISTS user_content_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES educational_contents(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES educational_lessons(id) ON DELETE SET NULL,
    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (progress_percent >= 0 AND progress_percent <= 100),
    last_position_seconds INTEGER CHECK (last_position_seconds IS NULL OR last_position_seconds >= 0),
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, content_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS user_content_bookmarks (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES educational_contents(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);

CREATE TABLE IF NOT EXISTS educational_content_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES educational_contents(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'visible'
        CHECK (status IN ('visible', 'hidden', 'under_review')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, content_id)
);

-- ---------------------------------------------------------------------------
-- Sponsored placements: explicit disclosure and controlled publishing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sponsored_placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    title VARCHAR(220) NOT NULL,
    placement_type VARCHAR(32) NOT NULL
        CHECK (placement_type IN ('product', 'educational_content', 'campaign')),
    product_id UUID REFERENCES marketplace_products(id) ON DELETE SET NULL,
    educational_content_id UUID REFERENCES educational_contents(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('draft', 'pending_review', 'approved', 'active', 'paused', 'ended', 'rejected')),
    disclosure_text VARCHAR(240) NOT NULL DEFAULT 'Sponsored',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    targeting_rules JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
    CHECK (
        (placement_type = 'product' AND product_id IS NOT NULL AND educational_content_id IS NULL)
        OR (placement_type = 'educational_content' AND educational_content_id IS NOT NULL AND product_id IS NULL)
        OR (placement_type = 'campaign' AND product_id IS NULL AND educational_content_id IS NULL)
    )
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_products_seller_status
    ON marketplace_products (seller_organization_id, status);
CREATE INDEX IF NOT EXISTS idx_products_category
    ON marketplace_products (category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product_active
    ON product_variants (product_id, is_active);
CREATE INDEX IF NOT EXISTS idx_stock_movements_stock_created
    ON inventory_stock_movements (stock_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created
    ON marketplace_orders (buyer_user_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created
    ON marketplace_orders (status, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_seller
    ON marketplace_order_items (seller_organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_order
    ON payment_records (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_education_category_status
    ON educational_contents (category_id, status);
CREATE INDEX IF NOT EXISTS idx_education_provider
    ON educational_contents (provider_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user
    ON user_content_progress (user_id, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sponsored_status_dates
    ON sponsored_placements (status, starts_at, ends_at);

COMMIT;
