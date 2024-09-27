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
    event_date DATE NOT NULL
);

CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_number VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL
);

CREATE TABLE survey_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question VARCHAR(255) NOT NULL,
    type ENUM('autocomplete', 'radio', 'checkbox', 'number', 'text', 'textarea') NOT NULL,
    required BOOLEAN NOT NULL,
    options JSON,
    description TEXT,
    image_url VARCHAR(255),
    width VARCHAR(50)
);

CREATE TABLE survey_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    form_id VARCHAR(255) NOT NULL,
    question_id INT NOT NULL,
    answer TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES survey_questions(id)
);