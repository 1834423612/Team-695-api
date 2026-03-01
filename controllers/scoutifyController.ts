import { Request, Response } from 'express';
import scoutifyService from '../services/scoutifyService';
import { success, error } from '../utils/responses';
import { sanitizeGameComment } from '../utils/sanitizeText';
import { match } from 'assert';

class ScoutifyController {
    constructor() {
        this.getCurrentUserBinding = this.getCurrentUserBinding.bind(this);
        this.getCurrentAndroidDeviceBinding = this.getCurrentAndroidDeviceBinding.bind(this);
        this.updateCurrentAndroidDeviceBinding = this.updateCurrentAndroidDeviceBinding.bind(this);
        this.adminUpdateAndroidDeviceBinding = this.adminUpdateAndroidDeviceBinding.bind(this);
        this.getGameMatchups = this.getGameMatchups.bind(this);
        this.getGameDetails = this.getGameDetails.bind(this);
        this.getGameComments = this.getGameComments.bind(this);
        this.createGameComment = this.createGameComment.bind(this);
        this.getEventAssignments = this.getEventAssignments.bind(this);
        this.getEventTasks = this.getEventTasks.bind(this);
        this.createGameDetail = this.createGameDetail.bind(this);
        this.updateGameDetail = this.updateGameDetail.bind(this);
        this.deleteGameDetail = this.deleteGameDetail.bind(this);
        this.createEventAssignment = this.createEventAssignment.bind(this);
        this.deleteEventAssignment = this.deleteEventAssignment.bind(this);
        this.createEventTask = this.createEventTask.bind(this);
        this.updateEventTask = this.updateEventTask.bind(this);
        this.deleteEventTask = this.deleteEventTask.bind(this);
    }

    private getScopedUsername(req: Request) {
        const value = req.query.scoutifyUsername;
        if (typeof value !== 'string') {
            return undefined;
        }
        const trimmed = value.trim();
        return trimmed || undefined;
    }

    private getScopedTeamNumber(req: Request) {
        const value = req.query.scoutifyUserTeamNumber;
        if (value === undefined) {
            return undefined;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    }

    async getCurrentUserBinding(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            const boundUser = scopedUsername
                ? await scoutifyService.getUserBindingByUsername(scopedUsername, scopedTeamNumber)
                : await scoutifyService.getCurrentBoundUser(req.user);

            if (!boundUser) {
                return error(res, 404, scopedUsername
                    ? 'No Scoutify user found for provided username'
                    : 'No Scoutify user binding found for current Casdoor user');
            }
            return success(res, boundUser);
        } catch (err) {
            return error(res, 500, 'Failed to get Scoutify user binding', err);
        }
    }

    async getCurrentAndroidDeviceBinding(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            const binding = await scoutifyService.getCurrentAndroidDeviceBinding(req.user, scopedUsername, scopedTeamNumber);
            if (!binding) {
                return error(res, 404, scopedUsername
                    ? 'No Scoutify user found for provided username'
                    : 'No Scoutify user binding found for current Casdoor user');
            }
            return success(res, binding);
        } catch (err) {
            return error(res, 500, 'Failed to get Android device binding', err);
        }
    }

    async updateCurrentAndroidDeviceBinding(req: Request, res: Response) {
        try {
            const { androidDeviceId } = req.body;
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            if (typeof androidDeviceId !== 'string' || !androidDeviceId.trim()) {
                return error(res, 400, 'androidDeviceId is required');
            }

            const updated = await scoutifyService.updateCurrentAndroidDeviceBinding(
                req.user,
                androidDeviceId.trim(),
                scopedUsername,
                scopedTeamNumber,
            );
            if (!updated) {
                return error(res, 404, scopedUsername
                    ? 'No Scoutify user found for provided username'
                    : 'No Scoutify user binding found for current Casdoor user');
            }

            return success(res, updated, 'Android device binding updated');
        } catch (err) {
            return error(res, 500, 'Failed to update Android device binding', err);
        }
    }

    async adminUpdateAndroidDeviceBinding(req: Request, res: Response) {
        try {
            const teamNumber = Number(req.params.teamNumber);
            const scoutifyUserId = req.params.scoutifyUserId;
            const scopedUsername = this.getScopedUsername(req);
            const androidDeviceId = req.body.androidDeviceId ?? null;

            if (!teamNumber || (!scoutifyUserId && !scopedUsername)) {
                return error(res, 400, 'teamNumber and scoutifyUserId or scoutifyUsername are required');
            }

            if (androidDeviceId !== null && typeof androidDeviceId !== 'string') {
                return error(res, 400, 'androidDeviceId must be a string or null');
            }

            const updated = scopedUsername
                ? await scoutifyService.updateAndroidDeviceBindingByAdminUsingUsername(teamNumber, scopedUsername, androidDeviceId)
                : await scoutifyService.updateAndroidDeviceBindingByAdmin(teamNumber, scoutifyUserId, androidDeviceId);

            if (!updated) {
                return error(res, 404, 'Scoutify user not found');
            }

            return success(res, updated, 'Android device binding updated by admin');
        } catch (err) {
            return error(res, 500, 'Failed to update Android device binding', err);
        }
    }

    async getGameMatchups(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            let teamNumber = req.query.teamNumber as string;

            if (scopedUsername && !teamNumber) {
                const scopedUser = await scoutifyService.getUserBindingByUsername(scopedUsername, scopedTeamNumber);
                if (!scopedUser) {
                    return success(res, []);
                }
                teamNumber = String(scopedUser.team_master_tm_number);
            }

            const rows = await scoutifyService.listGameMatchups(
                {
                    frc_season_master_sm_year: req.query.smYear as string,
                    competition_master_cm_event_code: req.query.eventCode as string,
                    gm_game_type: req.query.gameType as string,
                    gm_number: req.query.gameNumber as string,
                    gm_alliance: req.query.alliance as string,
                    gm_alliance_position: req.query.alliancePosition as string,
                    team_master_tm_number: teamNumber,
                },
                Number(req.query.limit),
                Number(req.query.offset),
            );

            const matches: any[] = [];

            for (const row of rows) {
                const positionKey = row.gm_alliance + row.gm_alliance_position;
                const gm_num = row.gm_number - 1

                if (matches[gm_num]) {
                    matches[gm_num][positionKey] = row.team_master_tm_number;
                    matches[gm_num].teams.push(row.team_master_tm_number);
                } else {
                    matches[gm_num] = {
                        gm_number: row.gm_number,
                        gm_game_type: row.gm_game_type,
                        gm_timestamp: row.gm_timestamp,
                        teams: [row.team_master_tm_number],
                        [positionKey]: row.team_master_tm_number 
                    };
                }
            }

            return success(res, matches);
        } catch (err) {
            return error(res, 500, 'Failed to query game matchups', err);
        }
    }

    async getGameDetails(req: Request, res: Response) {
        try {
            let scoutifyUserId = req.query.scoutifyUserId as string;
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            if (!scoutifyUserId && scopedUsername) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    scopedUsername,
                    scopedTeamNumber,
                );

                if (!resolvedScoutifyUserId) {
                    return success(res, []);
                }

                scoutifyUserId = resolvedScoutifyUserId;
            }

            const rows = await scoutifyService.listGameDetails(
                {
                    frc_season_master_sm_year: req.query.smYear as string,
                    competition_master_cm_event_code: req.query.eventCode as string,
                    game_matchup_gm_game_type: req.query.gameType as string,
                    game_matchup_gm_number: req.query.gameNumber as string,
                    game_matchup_gm_alliance: req.query.alliance as string,
                    game_matchup_gm_alliance_position: req.query.alliancePosition as string,
                    game_element_group_geg_grp_key: req.query.elementGroupKey as string,
                    game_element_ge_key: req.query.elementKey as string,
                    gd_um_id: scoutifyUserId,
                },
                Number(req.query.limit),
                Number(req.query.offset),
            );

            return success(res, rows);
        } catch (err) {
            return error(res, 500, 'Failed to query game details', err);
        }
    }

    async getGameComments(req: Request, res: Response) {
        try {
            let scoutifyUserId = req.query.scoutifyUserId as string;
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            if (!scoutifyUserId && scopedUsername) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    scopedUsername,
                    scopedTeamNumber,
                );

                if (!resolvedScoutifyUserId) {
                    return success(res, []);
                }

                scoutifyUserId = resolvedScoutifyUserId;
            }

            const rows = await scoutifyService.listGameComments(
                {
                    frc_season_master_sm_year: req.query.smYear as string,
                    competition_master_cm_event_code: req.query.eventCode as string,
                    game_matchup_gm_game_type: req.query.gameType as string,
                    game_matchup_gm_number: req.query.gameNumber as string,
                    game_matchup_gm_alliance: req.query.alliance as string,
                    game_matchup_gm_alliance_position: req.query.alliancePosition as string,
                    gc_um_id: scoutifyUserId,
                },
                Number(req.query.limit),
                Number(req.query.offset),
            );

            return success(res, rows);
        } catch (err) {
            return error(res, 500, 'Failed to query game comments', err);
        }
    }

    async createGameComment(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            const {
                frc_season_master_sm_year,
                competition_master_cm_event_code,
                game_matchup_gm_game_type,
                game_matchup_gm_number,
                game_matchup_gm_alliance,
                game_matchup_gm_alliance_position,
                gc_comment,
            } = req.body;

            if (
                frc_season_master_sm_year === undefined
                    || !competition_master_cm_event_code
                        || !game_matchup_gm_game_type
                            || game_matchup_gm_number === undefined
                                || !game_matchup_gm_alliance
                                    || game_matchup_gm_alliance_position === undefined
            ) {
                return error(res, 400, 'Missing required fields for game comment');
            }

            const smYear = Number(frc_season_master_sm_year);
            const gameNumber = Number(game_matchup_gm_number);
            const alliancePosition = Number(game_matchup_gm_alliance_position);

            if (!Number.isFinite(smYear) || !Number.isFinite(gameNumber) || !Number.isFinite(alliancePosition)) {
                return error(res, 400, 'Invalid numeric fields for game comment');
            }

            const safeComment = sanitizeGameComment(gc_comment);
            if (!safeComment) {
                return error(res, 400, 'gc_comment is required');
            }

            if (safeComment.length > 200) {
                return error(res, 400, 'gc_comment must be 200 characters or fewer after sanitization');
            }

            const created = await scoutifyService.createGameComment(req.user, {
                frc_season_master_sm_year: smYear,
                competition_master_cm_event_code: String(competition_master_cm_event_code),
                game_matchup_gm_game_type: String(game_matchup_gm_game_type),
                game_matchup_gm_number: gameNumber,
                game_matchup_gm_alliance: String(game_matchup_gm_alliance),
                game_matchup_gm_alliance_position: alliancePosition,
                gc_comment: safeComment,
            }, scopedUsername, scopedTeamNumber);

            if (!created) {
                return error(res, 404, scopedUsername
                    ? 'No Scoutify user found for provided username'
                    : 'No Scoutify user binding found for current Casdoor user');
            }

            return success(res, created, 'Game comment created');
        } catch (err) {
            return error(res, 500, 'Failed to create game comment', err);
        }
    }

    async getEventAssignments(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            const result = await scoutifyService.listEventAssignments(
                req.user,
                {
                    sm_year: req.query.smYear as string,
                    cm_event_code: req.query.eventCode as string,
                    tm_number: req.query.teamNumber as string,
                },
                Number(req.query.limit),
                Number(req.query.offset),
                scopedUsername,
                scopedTeamNumber,
            );

            if (!result) {
                return error(res, 404, scopedUsername
                    ? 'No Scoutify user found for provided username'
                    : 'No Scoutify user binding found for current Casdoor user');
            }

            return success(res, result);
        } catch (err) {
            return error(res, 500, 'Failed to query event assignments', err);
        }
    }

    async getEventTasks(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            const result = await scoutifyService.listEventTasks(
                req.user,
                {
                    sm_year: req.query.smYear as string,
                    cm_event_code: req.query.eventCode as string,
                    tm_number: req.query.teamNumber as string,
                    gm_number: req.query.gameNumber as string,
                    gm_game_type: req.query.gameType as string,
                    checkin_task: req.query.checkinTask as string,
                    task_completed: req.query.taskCompleted as string,
                },
                Number(req.query.limit),
                Number(req.query.offset),
                scopedUsername,
                scopedTeamNumber,
            );

            if (!result) {
                return error(res, 404, scopedUsername
                    ? 'No Scoutify user found for provided username'
                    : 'No Scoutify user binding found for current Casdoor user');
            }

            return success(res, result);
        } catch (err) {
            return error(res, 500, 'Failed to query event tasks', err);
        }
    }

    async createGameDetail(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);
            const payload = req.body;

            if(scopedUsername) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    scopedUsername,
                    scopedTeamNumber ?? Number(payload.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                payload.gd_um_id = resolvedScoutifyUserId;
            } else if (!payload.gd_um_id && payload.gd_um_name) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    String(payload.gd_um_name),
                    Number(payload.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                payload.gd_um_id = resolvedScoutifyUserId;
            }

            const created = await scoutifyService.createGameDetail(payload);
            return success(res, created, 'Game detail created');
        } catch (err) {
            return error(res, 500, 'Failed to create game detail', err);
        }
    }

    async updateGameDetail(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);
            const match = { ...(req.body?.match || {}) };
            const changes = req.body?.changes;
            if (!match || !changes) {
                return error(res, 400, 'match and changes are required');
            }

            if (!match.gd_um_id && scopedUsername) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    scopedUsername,
                    scopedTeamNumber ?? Number(match.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                match.gd_um_id = resolvedScoutifyUserId;
            } else if (!match.gd_um_id && match.gd_um_name) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    String(match.gd_um_name),
                    Number(match.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                match.gd_um_id = resolvedScoutifyUserId;
            }

            const result = await scoutifyService.updateGameDetail({ match, changes });
            if (!result.affectedRows) {
                return error(res, 404, 'No game detail row updated');
            }

            return success(res, result, 'Game detail updated');
        } catch (err) {
            return error(res, 500, 'Failed to update game detail', err);
        }
    }

    async deleteGameDetail(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);
            const payload = { ...req.body };

            if (!payload.gd_um_id && scopedUsername) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    scopedUsername,
                    scopedTeamNumber ?? Number(payload.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                payload.gd_um_id = resolvedScoutifyUserId;
            } else if (!payload.gd_um_id && payload.gd_um_name) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    String(payload.gd_um_name),
                    Number(payload.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                payload.gd_um_id = resolvedScoutifyUserId;
            }

            const result = await scoutifyService.deleteGameDetail(payload);
            if (!result.affectedRows) {
                return error(res, 404, 'No game detail row deleted');
            }

            return success(res, result, 'Game detail deleted');
        } catch (err) {
            return error(res, 500, 'Failed to delete game detail', err);
        }
    }

    async createEventAssignment(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);
            const payload = { ...req.body };

            if (!payload.um_id && scopedUsername) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    scopedUsername,
                    scopedTeamNumber ?? Number(payload.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                payload.um_id = resolvedScoutifyUserId;
            } else if (!payload.um_id && payload.um_name) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    String(payload.um_name),
                    Number(payload.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                payload.um_id = resolvedScoutifyUserId;
            }

            const created = await scoutifyService.createEventAssignment(payload);
            return success(res, created, 'Event assignment created or updated');
        } catch (err) {
            return error(res, 500, 'Failed to create event assignment', err);
        }
    }

    async deleteEventAssignment(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);
            const payload = { ...req.body };

            if (!payload.um_id && scopedUsername) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    scopedUsername,
                    scopedTeamNumber ?? Number(payload.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                payload.um_id = resolvedScoutifyUserId;
            } else if (!payload.um_id && payload.um_name) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    String(payload.um_name),
                    Number(payload.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                payload.um_id = resolvedScoutifyUserId;
            }

            const result = await scoutifyService.deleteEventAssignment(payload);
            if (!result.affectedRows) {
                return error(res, 404, 'No event assignment row deleted');
            }

            return success(res, result, 'Event assignment deleted');
        } catch (err) {
            return error(res, 500, 'Failed to delete event assignment', err);
        }
    }

    async createEventTask(req: Request, res: Response) {
        try {
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);
            const payload = { ...req.body };

            if (!payload.um_id && scopedUsername) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    scopedUsername,
                    scopedTeamNumber ?? Number(payload.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                payload.um_id = resolvedScoutifyUserId;
            } else if (!payload.um_id && payload.um_name) {
                const resolvedScoutifyUserId = await scoutifyService.resolveScoutifyUserIdByUsername(
                    String(payload.um_name),
                    Number(payload.user_tm_number),
                );
                if (!resolvedScoutifyUserId) {
                    return error(res, 404, 'Scoutify user not found by username');
                }
                payload.um_id = resolvedScoutifyUserId;
            }

            const created = await scoutifyService.createEventTask(payload);
            return success(res, created, 'Event task created');
        } catch (err) {
            return error(res, 500, 'Failed to create event task', err);
        }
    }

    async updateEventTask(req: Request, res: Response) {
        try {
            const taskId = Number(req.params.taskId);
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            if (!taskId) {
                return error(res, 400, 'taskId is required');
            }

            const scopedUser = scopedUsername
                ? await scoutifyService.getUserBindingByUsername(scopedUsername, scopedTeamNumber)
                : null;

            if (scopedUsername && !scopedUser) {
                return error(res, 404, 'Scoutify user not found by username');
            }

            const result = await scoutifyService.updateEventTask(taskId, req.body, scopedUser);
            if (!result.affectedRows) {
                return error(res, 404, 'No event task row updated');
            }

            return success(res, result, 'Event task updated');
        } catch (err) {
            return error(res, 500, 'Failed to update event task', err);
        }
    }

    async deleteEventTask(req: Request, res: Response) {
        try {
            const taskId = Number(req.params.taskId);
            const scopedUsername = this.getScopedUsername(req);
            const scopedTeamNumber = this.getScopedTeamNumber(req);

            if (!taskId) {
                return error(res, 400, 'taskId is required');
            }

            const scopedUser = scopedUsername
                ? await scoutifyService.getUserBindingByUsername(scopedUsername, scopedTeamNumber)
                : null;

            if (scopedUsername && !scopedUser) {
                return error(res, 404, 'Scoutify user not found by username');
            }

            const result = await scoutifyService.deleteEventTask(taskId, scopedUser);
            if (!result.affectedRows) {
                return error(res, 404, 'No event task row deleted');
            }

            return success(res, result, 'Event task deleted');
        } catch (err) {
            return error(res, 500, 'Failed to delete event task', err);
        }
    }

    async getGameConstants(req: Request, res: Response) {
        try {
            const result = await scoutifyService.getGameConstants()

            return success(res, result)
        } catch (err) {
            return error(res, 500, 'Failed to get game constants', err);
        }
    }
}

export default new ScoutifyController();
