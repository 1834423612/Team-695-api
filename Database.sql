CREATE TABLE
    feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nickname VARCHAR(255),
        category VARCHAR(255),
        title VARCHAR(255),
        contact VARCHAR(255),
        content TEXT,
        deviceInfo JSON,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE
    events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL,
        event_name VARCHAR(255) NOT NULL,
        event_date DATE NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX (event_id)
    );

CREATE TABLE
    teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_number VARCHAR(255) NOT NULL,
        team_name VARCHAR(255) NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_team_number_lookup (team_number),
        INDEX idx_team_name_lookup (team_name)
    );

CREATE TABLE
    survey_responses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL,
        form_id VARCHAR(255) NOT NULL,
        data JSON,
        upload JSON,
        user_data JSON,
        user_agent VARCHAR(255),
        ip VARCHAR(45),
        language VARCHAR(10),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events (event_id)
    );

CREATE TABLE
    IF NOT EXISTS task_assignments (
        id VARCHAR(10) PRIMARY KEY,
        event_key VARCHAR(20) NOT NULL COMMENT 'Event key, e.g., 2025ohcl',
        task_type ENUM ('scouting', 'pit-scouting') NOT NULL COMMENT 'Task type',
        assigned_team_numbers JSON COMMENT 'List of team numbers for pit-scouting',
        assigned_alliance ENUM ('red', 'blue') COMMENT 'Alliance for scouting',
        assigned_matches VARCHAR(100) COMMENT 'Range of match numbers for scouting, e.g., Q3-Q12',
        assigner_data JSON NOT NULL COMMENT 'Admin information who assigned the task',
        assignees_data JSON NOT NULL COMMENT 'User information of assignees (array of users)',
        status ENUM ('pending', 'in_progress', 'completed', 'canceled') DEFAULT 'pending' COMMENT 'Task status',
        notes TEXT COMMENT 'Additional notes for the task',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
        INDEX idx_event_key (event_key),
        INDEX idx_event_type (event_key, task_type)
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE
    IF NOT EXISTS team_matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_key VARCHAR(20) NOT NULL COMMENT 'Event key, e.g., 2025ohcl',
        team_key VARCHAR(20) NOT NULL COMMENT 'Team key from TBA, e.g., frc695',
        team_number INT NOT NULL COMMENT 'Team number',
        nickname VARCHAR(255) COMMENT 'Team nickname',
        is_pit BOOLEAN DEFAULT FALSE COMMENT 'Flag indicating if pit-scouting is completed. Yes-1, No-0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Creation timestamp',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp',
        INDEX idx_event_team (event_key, team_key),
        INDEX idx_team_number (team_number),
        UNIQUE KEY unique_event_team (event_key, team_key)
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_general_ci;
