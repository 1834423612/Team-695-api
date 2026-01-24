import { Request, Response } from 'express';
import { success, error } from '../utils/responses';
import assignmentService from '../services/assignmentService';
import authService from '../services/authService';
import { CreateAssignmentRequest } from '../types/assignment';

class AssignmentController {
    /**
     * Create a new task assignment (admin only)
     */
    async createAssignment(req: Request, res: Response) {
        try {
            // Check if user is authenticated (via JWT or API Key)
            if (!req.user) {
                return error(res, 401, 'Authentication required');
            }

            // Check if user is admin
            if (!req.user.isAdmin) {
                return error(res, 403, 'Admin privileges required');
            }

            const assignmentData: CreateAssignmentRequest = req.body;

            // Validate required fields
            if (!assignmentData.event_key || !assignmentData.task_type || 
                !assignmentData.assignees_data || !assignmentData.assignees_data.length) {
                return error(res, 400, 'Missing required fields or no assignees specified');
            }

            // Task-specific validation
            if (assignmentData.task_type === 'pit-scouting') {
                if (!assignmentData.assigned_team_numbers || !assignmentData.assigned_team_numbers.length) {
                    return error(res, 400, 'Team numbers are required for pit-scouting tasks');
                }
            } else if (assignmentData.task_type === 'scouting') {
                if (!assignmentData.assigned_alliance || !assignmentData.assigned_matches) {
                    return error(res, 400, 'Alliance and matches are required for scouting tasks');
                }
            }

            // Extract user data from token for assigner
            const assigner = {
                email: req.user.email || '',
                avatar: req.user.avatar || '',
                userId: req.user.id,
                username: req.user.username || '',
                displayName: req.user.name || ''
            };

            const result = await assignmentService.createAssignment(assignmentData, assigner);

            if (!result) {
                return error(res, 500, 'Failed to create assignment');
            }

            return success(res, result, 'Assignment created successfully');
        } catch (err: any) {
            console.error('Error creating assignment:', err);
            return error(res, 500, 'Error creating assignment', err.message);
        }
    }

    /**
     * Update an existing task assignment (admin only)
     */
    async updateAssignment(req: Request, res: Response) {
        try {
            if (!req.user) {
                return error(res, 401, 'Authentication required');
            }

            // Check if user is admin
            if (!req.user.isAdmin) {
                return error(res, 403, 'Admin privileges required');
            }

            const { id } = req.params;
            const updates = req.body;

            const result = await assignmentService.updateAssignment(id, updates);

            if (!result) {
                return error(res, 404, 'Assignment not found or no changes applied');
            }

            return success(res, result, 'Assignment updated successfully');
        } catch (err: any) {
            console.error('Error updating assignment:', err);
            return error(res, 500, 'Error updating assignment', err.message);
        }
    }

    /**
     * Get assignments for current user
     */
    async getUserAssignments(req: Request, res: Response) {
        try {
            if (!req.user) {
                return error(res, 401, 'Authentication required');
            }

            const { eventKey } = req.params;

            if (!eventKey) {
                return error(res, 400, 'Event key is required');
            }

            const assignments = await assignmentService.getUserAssignments(eventKey, req.user.id);

            return success(res, assignments, 'Assignments retrieved successfully');
        } catch (err: any) {
            console.error('Error getting user assignments:', err);
            return error(res, 500, 'Error getting user assignments', err.message);
        }
    }

    /**
     * Get all assignments for an event (admin only)
     */
    async getEventAssignments(req: Request, res: Response) {
        try {
            if (!req.user) {
                return error(res, 401, 'Authentication required');
            }

            // Check if user is admin
            if (!req.user.isAdmin) {
                return error(res, 403, 'Admin privileges required');
            }

            const { eventKey } = req.params;

            if (!eventKey) {
                return error(res, 400, 'Event key is required');
            }

            const assignments = await assignmentService.getEventAssignments(eventKey);

            return success(res, assignments, 'Event assignments retrieved successfully');
        } catch (err: any) {
            console.error('Error getting event assignments:', err);
            return error(res, 500, 'Error getting event assignments', err.message);
        }
    }

    /**
     * Delete a task assignment (admin only)
     */
    async deleteAssignment(req: Request, res: Response) {
        try {
            if (!req.user) {
                return error(res, 401, 'Authentication required');
            }

            // Check if user is admin
            if (!req.user.isAdmin) {
                return error(res, 403, 'Admin privileges required');
            }

            const { id } = req.params;

            const result = await assignmentService.deleteAssignment(id);

            if (!result) {
                return error(res, 404, 'Assignment not found');
            }

            return success(res, { deleted: true }, 'Assignment deleted successfully');
        } catch (err: any) {
            console.error('Error deleting assignment:', err);
            return error(res, 500, 'Error deleting assignment', err.message);
        }
    }
}

export default new AssignmentController();
