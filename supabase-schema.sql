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
    emoji TEXT NOT NULL
);

-- 4. Insert Mock Products
INSERT INTO products (id, name, price, barcode, category, emoji) VALUES
  (3, 'Eggs (12 pcs)', 72, '8901030874322', 'Dairy', '🥚'),
  (4, 'Apples (1 kg)', 120, '8901072001422', 'Fruits', '🍎'),
  (5, 'Basmati Rice (5kg)', 380, '8904109600127', 'Grains', '🍚'),
  (6, 'Amul Butter', 55, '8901063103765', 'Dairy', '🧈'),
  (7, 'Tata Salt (1kg)', 24, '8901058003345', 'Spices', '🧂'),
  (8, 'Maggi Noodles', 14, '8901058009989', 'Instant', '🍜'),
  (9, 'Sunflower Oil (1L)', 148, '8906009510019', 'Oils', '🫙'),
  (10, 'Colgate Toothpaste', 99, '8718951233256', 'Personal', '🪥'),
  (11, 'Lays Classic', 20, '8901491503951', 'Snacks', '🥔'),
  (12, 'Biscuits (Parle-G)', 10, '8901063001101', 'Snacks', '🍪')
ON CONFLICT (id) DO NOTHING;

-- 5. Enable Realtime for all tables
alter publication supabase_realtime add table receipts;
alter publication supabase_realtime add table cart_items;
alter publication supabase_realtime add table products;
