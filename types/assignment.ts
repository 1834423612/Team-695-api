export interface UserData {
    email: string;
    avatar: string;
    userId: string;
    username: string;
    displayName: string;
    // Optional fields that might be in the raw data
    id?: string;
    name?: string;
}

export interface TaskAssignment {
    id?: string; // 改为字符串类型的ID
    event_key: string;
    task_type: 'scouting' | 'pit-scouting';
    assigned_team_numbers?: number[];
    assigned_alliance?: 'red' | 'blue';
    assigned_matches?: string;
    assigner_data: UserData;
    assignees_data: UserData[]; // 修改为用户数组
    status?: 'pending' | 'in_progress' | 'completed' | 'canceled';
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface TaskAssignmentResponse {
    id: string; // 改为字符串类型的ID
    event_key: string;
    task_type: string;
    assigned_team_numbers: number[] | null;
    assigned_alliance: string | null;
    assigned_matches: string | null;
    assigner_data: UserData;
    assignees_data: UserData[]; // 修改为用户数组
    status: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateAssignmentRequest {
    event_key: string;
    task_type: 'scouting' | 'pit-scouting';
    assigned_team_numbers?: number[];
    assigned_alliance?: 'red' | 'blue';
    assigned_matches?: string;
    assignees_data: UserData[]; // 修改为用户数组
    notes?: string;
}
