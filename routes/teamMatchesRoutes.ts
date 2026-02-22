import express from 'express';
import { mainPool as pool } from '../config/database';
import { verifyToken } from '../middlewares/auth';
import { success, error } from '../utils/responses';

// Create two separate routers
const publicRouter = express.Router();
const protectedRouter = express.Router();

// Require Casdoor authentication for protected routes
protectedRouter.use(verifyToken);

// Get all teams for a specific event with their pit-scouting status (public endpoint)
publicRouter.get('/event/:eventKey', async (req, res) => {
    try {
        const { eventKey } = req.params;

        if (!eventKey) {
            return error(res, 400, 'Event key is required');
        }

        // Query database
        const [rows] = await pool.query(
            `SELECT 
            id, event_key, team_key, team_number, nickname, is_pit,
            created_at, updated_at
            FROM team_matches 
            WHERE event_key = ? 
            ORDER BY team_number`,
            [eventKey]
        );
        
        // Convert is_pit from 0/1 to boolean false/true
        const teams = Array.isArray(rows) ? rows.map((team: any) => ({
            ...team,
            is_pit: Boolean(team.is_pit)
        })) : [];

        return success(res, teams, `Teams retrieved for event ${eventKey}`);
    } catch (err) {
        console.error('Error getting teams for event:', err);
        return error(res, 500, 'Error getting teams for event', err);
    }
});

// Helper function to update pit-scouting status
async function updatePitStatus(res: express.Response, eventKey: string, identifier: string, isPit: boolean, isTeamNumber: boolean = false) {
    try {
        // Process the identifier to support both "frc555" and "555" formats
        let processedIdentifier = identifier;
        let queryField = isTeamNumber ? 'team_number' : 'team_key';
        
        // If not team number and identifier is pure number, add "frc" prefix
        if (!isTeamNumber && !identifier.startsWith('frc') && /^\d+$/.test(identifier)) {
            processedIdentifier = `frc${identifier}`;
        }
        
        // If it's team number and identifier starts with "frc", remove the prefix
        if (isTeamNumber && identifier.startsWith('frc')) {
            processedIdentifier = identifier.substring(3);
        }
        
        // Update database
        const [result] = await pool.query(
            `UPDATE team_matches SET is_pit = ? WHERE event_key = ? AND ${queryField} = ?`,
            [isPit, eventKey, processedIdentifier]
        );

        // @ts-ignore
        if (result.affectedRows === 0) {
            return error(res, 404, `Team not found for this event (using ${isTeamNumber ? 'team number' : 'team key'}: ${identifier})`);
        }

        // Get updated team data
        const [rows] = await pool.query<any[]>(
            `SELECT * FROM team_matches WHERE event_key = ? AND ${queryField} = ?`,
            [eventKey, processedIdentifier]
        );
        
        // Convert is_pit from 0/1 to boolean
        const team = rows[0] ? {
            ...rows[0],
            is_pit: Boolean(rows[0].is_pit)
        } : null;

        return success(res, team, 'Pit-scouting status updated successfully');
    } catch (err) {
        console.error('Error updating pit-scouting status:', err);
        return error(res, 500, 'Error updating pit-scouting status', err);
    }
}

// Update pit-scouting status for a team using team key
protectedRouter.put('/pit-status/:eventKey/:teamKey', async (req, res) => {
    const { eventKey, teamKey } = req.params;
    const { is_pit } = req.body;

    if (!eventKey || !teamKey) {
        return error(res, 400, 'Event key and team key are required');
    }

    if (is_pit === undefined) {
        return error(res, 400, 'is_pit status is required');
    }

    return await updatePitStatus(res, eventKey, teamKey, is_pit);
});

// Update pit-scouting status for a team using team number
protectedRouter.put('/pit-status-by-number/:eventKey/:teamNumber', async (req, res) => {
    const { eventKey, teamNumber } = req.params;
    const { is_pit } = req.body;

    if (!eventKey || !teamNumber) {
        return error(res, 400, 'Event key and team number are required');
    }

    if (is_pit === undefined) {
        return error(res, 400, 'is_pit status is required');
    }

    return await updatePitStatus(res, eventKey, teamNumber, is_pit, true);
});

export { publicRouter as publicTeamMatchesRoutes, protectedRouter as protectedTeamMatchesRoutes };
