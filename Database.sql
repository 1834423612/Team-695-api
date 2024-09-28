CREATE TABLE feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nickname VARCHAR(255),
    category VARCHAR(255),
    title VARCHAR(255),
    contact VARCHAR(255),
    content TEXT,
    deviceInfo JSON,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX (event_id) -- 为 event_id 添加唯一索引
);

CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_number VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE survey_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    form_id VARCHAR(255) NOT NULL,
    data JSON,
    upload JSON,
    user_agent VARCHAR(255),
    ip VARCHAR(45),
    language VARCHAR(10),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(event_id)
);