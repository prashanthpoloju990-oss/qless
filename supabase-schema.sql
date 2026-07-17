-- Supabase Schema for QLESS Smart Shopping

-- 1. Create Receipts Table
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    total NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('paid', 'verified')),
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Cart Items Table (for admin panel live view)
CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    quantity INTEGER NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Products Table (Mock catalog replacement)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    barcode TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    emoji TEXT NOT NULL,
    stock INTEGER DEFAULT 100,
    offer TEXT
);

-- 4. Insert Mock Products
INSERT INTO products (id, name, price, barcode, category, emoji, stock, offer) VALUES
  (3, 'Eggs (12 pcs)', 72, '8901030874322', 'Dairy', '🥚', 100, 'Buy 1 Get 1'),
  (4, 'Apples (1 kg)', 120, '8901072001422', 'Fruits', '🍎', 100, NULL),
  (5, 'Basmati Rice (5kg)', 380, '8904109600127', 'Grains', '🍚', 100, NULL),
  (6, 'Amul Butter', 55, '8901063103765', 'Dairy', '🧈', 100, '₹5 OFF'),
  (7, 'Tata Salt (1kg)', 24, '8901058003345', 'Spices', '🧂', 100, NULL),
  (8, 'Maggi Noodles', 14, '8901058009989', 'Instant', '🍜', 100, NULL),
  (9, 'Sunflower Oil (1L)', 148, '8906009510019', 'Oils', '🫙', 100, NULL),
  (10, 'Colgate Toothpaste', 99, '8718951233256', 'Personal', '🪥', 100, NULL),
  (11, 'Lays Classic', 20, '8901491503951', 'Snacks', '🥔', 100, NULL),
  (12, 'Biscuits (Parle-G)', 10, '8901063001101', 'Snacks', '🍪', 100, NULL)
ON CONFLICT (id) DO NOTHING;

-- 5. Enable Realtime for all tables
alter publication supabase_realtime add table receipts;
alter publication supabase_realtime add table cart_items;
alter publication supabase_realtime add table products;

-- 6. Add stock decay function
CREATE OR REPLACE FUNCTION decay_stock(p_session_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE products p
  SET stock = GREATEST(0, p.stock - c.quantity)
  FROM cart_items c
  WHERE p.id = c.product_id AND c.session_id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Disable Row Level Security (RLS) for demo client access
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items DISABLE ROW LEVEL SECURITY;


