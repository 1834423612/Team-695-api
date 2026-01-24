import pool from '../config/database';
import { TaskAssignment, CreateAssignmentRequest, UserData, TaskAssignmentResponse } from '../types/assignment';
import crypto from 'crypto';

class AssignmentService {
    /**
     * Generate random short ID
     * Creates 8-character random string as ID
     */
    private generateShortId(): string {
        return crypto.randomBytes(4).toString('hex');
    }

    /**
     * Create a new task assignment
     */
    async createAssignment(assignment: CreateAssignmentRequest, assigner: UserData): Promise<TaskAssignmentResponse | null> {
        try {
            const {
                event_key,
                task_type,
                assigned_team_numbers,
                assigned_alliance,
                assigned_matches,
                assignees_data,
                notes
            } = assignment;

            // Generate random short ID
            const shortId = this.generateShortId();

            const [result]: any = await pool.query(
                `INSERT INTO task_assignments 
                (id, event_key, task_type, assigned_team_numbers, assigned_alliance, assigned_matches, assigner_data, assignees_data, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    shortId,
                    event_key,
                    task_type,
                    assigned_team_numbers ? JSON.stringify(assigned_team_numbers) : null,
                    assigned_alliance || null,
                    assigned_matches || null,
                    JSON.stringify(assigner),
                    JSON.stringify(assignees_data),
                    notes || null
                ]
            );

            if (result.affectedRows > 0) {
                const [rows]: any = await pool.query(
                    'SELECT * FROM task_assignments WHERE id = ?',
                    [shortId]
                );

                if (rows.length > 0) {
                    const assignment = this.formatAssignment(rows[0]);
                    return assignment;
                }
            }

            return null;
        } catch (error) {
            console.error('Error creating task assignment:', error);
            throw error;
        }
    }

    /**
     * Update an existing task assignment
     */
    async updateAssignment(id: string, updates: Partial<TaskAssignment>): Promise<TaskAssignmentResponse | null> {
        try {
            const allowedFields = [
                'assigned_team_numbers',
                'assigned_alliance',
                'assigned_matches',
                'assignees_data',
                'status',
                'notes'
            ];

            const updateFields = [];
            const updateValues = [];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    updateFields.push(`${key} = ?`);

                    if ((key === 'assigned_team_numbers' || key === 'assignees_data') && value !== null) {
                        updateValues.push(JSON.stringify(value));
                    } else {
                        updateValues.push(value);
                    }
                }
            }

            if (updateFields.length === 0) {
                return null;
            }

            updateValues.push(id);

            const [result]: any = await pool.query(
                `UPDATE task_assignments SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );

            if (result.affectedRows > 0) {
                const [rows]: any = await pool.query(
                    'SELECT * FROM task_assignments WHERE id = ?',
                    [id]
                );

                if (rows.length > 0) {
                    const assignment = this.formatAssignment(rows[0]);
                    return assignment;
                }
            }

            return null;
        } catch (error) {
            console.error('Error updating task assignment:', error);
            throw error;
        }
    }

    /**
     * Get task assignments by event and user ID
     */
    async getUserAssignments(eventKey: string, userId: string): Promise<TaskAssignmentResponse[]> {
        try {
            // Get all tasks for this event first
            const [rows]: any = await pool.query(
                `SELECT * FROM task_assignments 
                WHERE event_key = ? 
                ORDER BY created_at DESC`,
                [eventKey]
            );
            
            // Filter tasks containing specific userId at application layer
            const userAssignments = rows.filter((row: any) => {
                try {
                    // Ensure proper JSON data parsing
                    let assignees: any[] = [];
                    if (typeof row.assignees_data === 'string') {
                        assignees = JSON.parse(row.assignees_data);
                    } else if (row.assignees_data) {
                        assignees = row.assignees_data;
                    }
                    
                    // Verify assignees is an array
                    if (!Array.isArray(assignees)) {
                        console.error(`assignees_data is not an array for assignment ${row.id}`);
                        return false;
                    }
                    
                    // Check if specified user ID exists, supporting multiple ID field formats
                    const hasUser = assignees.some(assignee => 
                        (assignee.userId === userId) || 
                        (assignee.id === userId) ||
                        // String comparison
                        (String(assignee.userId) === String(userId)) || 
                        (String(assignee.id) === String(userId))
                    );
                    
                    return hasUser;
                } catch (e) {
                    console.error(`Error processing assignees_data for assignment ${row.id}:`, e);
                    return false;
                }
            });

            return userAssignments.map((row: any) => this.formatAssignment(row));
        } catch (error) {
            console.error('Error getting user assignments:', error);
            throw error;
        }
    }

    /**
     * Get all task assignments for an event
     */
    async getEventAssignments(eventKey: string): Promise<TaskAssignmentResponse[]> {
        try {
            const [rows]: any = await pool.query(
                'SELECT * FROM task_assignments WHERE event_key = ? ORDER BY created_at DESC',
                [eventKey]
            );

            return rows.map(this.formatAssignment);
        } catch (error) {
            console.error('Error getting event assignments:', error);
            throw error;
        }
    }

    /**
     * Delete a task assignment
     */
    async deleteAssignment(id: string): Promise<boolean> {
        try {
            const [result]: any = await pool.query(
                'DELETE FROM task_assignments WHERE id = ?',
                [id]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('Error deleting task assignment:', error);
            throw error;
        }
    }

    /**
     * Format assignment data from database
     */
    private formatAssignment(row: any): TaskAssignmentResponse {
        // Handle fields that may already be objects or JSON strings
        const parseJsonField = (field: any): any => {
            if (!field) return null;
            if (typeof field === 'object') return field;
            try {
                return JSON.parse(field);
            } catch (e) {
                console.error(`Error parsing JSON field: ${field}`, e);
                return null;
            }
        };

        return {
            id: row.id,
            event_key: row.event_key,
            task_type: row.task_type,
            assigned_team_numbers: row.assigned_team_numbers ? parseJsonField(row.assigned_team_numbers) : null,
            assigned_alliance: row.assigned_alliance,
            assigned_matches: row.assigned_matches,
            assigner_data: parseJsonField(row.assigner_data),
            assignees_data: parseJsonField(row.assignees_data), // Parse multiple assignees array
            status: row.status,
            notes: row.notes,
            created_at: row.created_at,
            updated_at: row.updated_at
        };
    }
}

export default new AssignmentService();
