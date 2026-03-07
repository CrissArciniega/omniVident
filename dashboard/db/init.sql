CREATE DATABASE IF NOT EXISTS omnivident CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE omnivident;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role ENUM('admin','seo','rrss') DEFAULT 'seo',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Tabla de agentes registrados
CREATE TABLE IF NOT EXISTS agents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL,
  state_file_path TEXT NOT NULL,
  output_dir TEXT NOT NULL,
  schedule_description VARCHAR(100),
  schedule_cron VARCHAR(50) DEFAULT '0 7 * * 1,3,5',
  custom_image LONGTEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Historial de ejecuciones
CREATE TABLE IF NOT EXISTS executions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  agent_id INT NOT NULL,
  status ENUM('running','completed','failed') NOT NULL,
  started_at DATETIME,
  completed_at DATETIME,
  duration_seconds INT,
  products_count INT DEFAULT 0,
  content_count INT DEFAULT 0,
  errors TEXT,
  state_snapshot TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Personalización de agentes por usuario (cada admin ve su propia config visual)
CREATE TABLE IF NOT EXISTS user_agent_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  agent_slug VARCHAR(50) NOT NULL,
  custom_name VARCHAR(100) DEFAULT NULL,
  custom_description TEXT DEFAULT NULL,
  custom_icon VARCHAR(50) DEFAULT NULL,
  custom_image LONGTEXT DEFAULT NULL,
  schedule_cron VARCHAR(50) DEFAULT NULL,
  schedule_description VARCHAR(100) DEFAULT NULL,
  UNIQUE KEY uq_user_agent (user_id, agent_slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_slug) REFERENCES agents(slug) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seed: agentes
INSERT INTO agents (slug, name, description, icon, color, state_file_path, output_dir, schedule_description) VALUES
('market-research', 'Estudio de Mercado', 'Recolecta y analiza productos más vendidos de MercadoLibre en Ecuador, México y Colombia. Detecta oportunidades de precio y tendencias.', 'TrendingUp', '#2563EB', '../agente de seo y product hunt/config/state.json', '../agente de seo y product hunt/outputs', 'Semanal — Lunes 8:00 AM'),
('content-rrss', 'Contenido y RRSS', 'Genera guiones para TikTok, Instagram, Facebook, YouTube y Blog. Incluye investigación de keywords, diseño y thumbnails.', 'PenTool', '#7C3AED', '../agente contenido y rrss/output/pipeline_state.json', '../agente contenido y rrss/output', 'Quincenal — Lunes 9:00 AM')
ON DUPLICATE KEY UPDATE name=VALUES(name);
