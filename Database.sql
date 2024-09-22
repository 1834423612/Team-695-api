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
