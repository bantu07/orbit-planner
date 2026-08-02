-- Orbit Daily Planner — MySQL schema
-- Run this once against a fresh database: mysql -u root -p orbit_planner < schema.sql

CREATE TABLE IF NOT EXISTS users (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  username            VARCHAR(64)  NOT NULL UNIQUE,
  password_hash       VARCHAR(255) NOT NULL,          -- bcrypt hash, never plaintext/reversible
  master_passphrase_hash VARCHAR(255) NOT NULL,       -- bcrypt hash of the account-recovery passphrase
  failed_attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked              BOOLEAN NOT NULL DEFAULT FALSE,
  last_activity_at    DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT NOT NULL,
  name      VARCHAR(64) NOT NULL,
  color     VARCHAR(16) NOT NULL DEFAULT '#3DF5FF',   -- hex color used for chip/legend glow
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_category (user_id, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS planner_blocks (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  category_id  INT NULL,
  title        VARCHAR(255) NOT NULL,
  notes        TEXT NULL,
  block_date   DATE NOT NULL,           -- the day this block belongs to
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_user_date (user_id, block_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journal_tags (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name    VARCHAR(64) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_tag (user_id, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journal_entries (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  entry_date DATE NOT NULL,
  mood       TINYINT UNSIGNED NOT NULL,  -- 1=😔 2=😐 3=🙂 4=😄 5=🤩
  content    TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_entry_date (user_id, entry_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS journal_entry_tags (
  entry_id INT NOT NULL,
  tag_id   INT NOT NULL,
  PRIMARY KEY (entry_id, tag_id),
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)   REFERENCES journal_tags(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Default categories seeded per user at registration time (see seed.js) — example only:
-- INSERT INTO categories (user_id, name, color, is_default) VALUES
--   (1, 'Deep work',  '#3DF5FF', TRUE),
--   (1, 'Meetings',   '#A97BFF', TRUE),
--   (1, 'Movement',   '#FF4FCB', TRUE),
--   (1, 'Wind down',  '#FFC15E', TRUE);
