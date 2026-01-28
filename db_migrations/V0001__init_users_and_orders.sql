-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'courier', 'admin')),
    name VARCHAR(100),
    qr_code VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(10) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('delivery', 'food')),
    client_id INTEGER REFERENCES users(id),
    courier_id INTEGER REFERENCES users(id),
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    items TEXT NOT NULL,
    restaurant VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'delivering', 'completed', 'cancelled')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);

-- Insert default admin user (password: SaDm1n_8234)
INSERT INTO users (phone, password_hash, role, name) 
VALUES ('admin', '$2b$10$KixLVqVHQXqPxJ8vQw5Q4.rGZJ9yYz4xZXqKXvP5zKX5xQz5Qz5Qz', 'admin', 'Администратор')
ON CONFLICT (phone) DO NOTHING;