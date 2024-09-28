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

DROP TABLE IF EXISTS survey_questions;

CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    event_name VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL
);

CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_number VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL
);

CREATE TABLE survey_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    form_id VARCHAR(255) NOT NULL,
    data JSON,
    upload JSON,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);