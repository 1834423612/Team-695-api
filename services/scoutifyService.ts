import { scoutifyPool } from '../config/scoutifyDatabase';

type QueryFilters = Record<string, string | number | undefined>;

interface BoundScoutifyUser {
    team_master_tm_number: number;
    um_id: string;
    um_name: string | null;
    um_email: string | null;
    um_active: string | null;
    um_admin_f: number | null;
    um_casdoor_userid: string;
    um_android_device_id: string | null;
}

interface CreateGameCommentPayload {
    frc_season_master_sm_year: number;
    competition_master_cm_event_code: string;
    game_matchup_gm_game_type: string;
    game_matchup_gm_number: number;
    game_matchup_gm_alliance: string;
    game_matchup_gm_alliance_position: number;
    gc_comment: string;
}

class ScoutifyService {
    private normalizeString(value?: string | null) {
        if (typeof value !== 'string') {
            return null;
        }
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }

    private async findUserByUsername(username: string, teamNumber?: number): Promise<BoundScoutifyUser | null> {
        const normalizedUsername = this.normalizeString(username);
        if (!normalizedUsername) {
            return null;
        }

        const teamNumberFilter = Number(teamNumber);
        if (Number.isFinite(teamNumberFilter) && teamNumberFilter > 0) {
            const [rows]: any = await scoutifyPool.query(
                `SELECT
                    team_master_tm_number,
                    um_id,
                    um_name,
                    um_email,
                    um_active,
                    um_admin_f,
                    um_casdoor_userid,
                    um_android_device_id
                 FROM user_master
                 WHERE um_casdoor_userid = ? AND team_master_tm_number = ?
                 LIMIT 1`,
                [normalizedUsername, teamNumberFilter],
            );

            return rows?.[0] || null;
        }

        const [rows]: any = await scoutifyPool.query(
            `SELECT
                team_master_tm_number,
                um_id,
                um_name,
                um_email,
                um_active,
                um_admin_f,
                um_casdoor_userid,
                um_android_device_id
             FROM user_master
             WHERE um_casdoor_userid = ?
             LIMIT 1`,
            [normalizedUsername],
        );

        return rows?.[0] || null;
    }

    private buildPagedQuery(baseSql: string, filters: QueryFilters, orderBy: string, limit?: number, offset?: number) {
        const where: string[] = [];
        const params: Array<string | number> = [];

        Object.entries(filters).forEach(([column, value]) => {
            if (value !== undefined && value !== '') {
                where.push(`${column} = ?`);
                params.push(value);
            }
        });

        const whereClause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
        const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
        const safeOffset = Math.max(Number(offset) || 0, 0);

        return {
            sql: `${baseSql}${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
            params: [...params, safeLimit, safeOffset],
        };
    }

    private async findBoundUser(authUser: any): Promise<BoundScoutifyUser | null> {
        const candidates = [
            authUser?.id,
            authUser?.username,
            authUser?.name,
            authUser?.raw?.sub,
            authUser?.raw?.id,
            authUser?.raw?.name,
        ].filter((value, index, arr) => typeof value === 'string' && value.trim() !== '' && arr.indexOf(value) === index) as string[];

        if (candidates.length === 0) {
            return null;
        }

        const [rows]: any = await scoutifyPool.query(
            `SELECT
                team_master_tm_number,
                um_id,
                um_name,
                um_email,
                um_active,
                um_admin_f,
                um_casdoor_userid,
                um_android_device_id
             FROM user_master
                 WHERE um_casdoor_userid IN (?)
             LIMIT 1`,
            [candidates],
        );

        if (rows?.[0]) {
            return rows[0];
        }

        const [fallbackRows]: any = await scoutifyPool.query(
            `SELECT
                team_master_tm_number,
                um_id,
                um_name,
                um_email,
                um_active,
                um_admin_f,
                um_casdoor_userid,
                um_android_device_id
             FROM user_master
             WHERE um_casdoor_userid IN (?)
             LIMIT 1`,
            [candidates],
        );

        return fallbackRows?.[0] || null;
    }

    async getCurrentBoundUser(authUser: any) {
        return this.findBoundUser(authUser);
    }

    async resolveBoundUser(authUser: any, username?: string, teamNumber?: number) {
        const normalizedUsername = this.normalizeString(username);
        if (normalizedUsername) {
            return this.findUserByUsername(normalizedUsername, teamNumber);
        }

        return this.findBoundUser(authUser);
    }

    async getCurrentAndroidDeviceBinding(authUser: any, username?: string, teamNumber?: number) {
        const boundUser = await this.resolveBoundUser(authUser, username, teamNumber);
        if (!boundUser) {
            return null;
        }

        return {
            um_id: boundUser.um_id,
            team_master_tm_number: boundUser.team_master_tm_number,
            um_casdoor_userid: boundUser.um_casdoor_userid,
            um_android_device_id: boundUser.um_android_device_id,
        };
    }

    async updateCurrentAndroidDeviceBinding(authUser: any, androidDeviceId: string, username?: string, teamNumber?: number) {
        const boundUser = await this.resolveBoundUser(authUser, username, teamNumber);
        if (!boundUser) {
            return null;
        }

        await scoutifyPool.query(
            `UPDATE user_master
             SET um_android_device_id = ?
             WHERE team_master_tm_number = ? AND um_id = ?`,
            [androidDeviceId, boundUser.team_master_tm_number, boundUser.um_id],
        );

        return this.getCurrentAndroidDeviceBinding(authUser, username, teamNumber);
    }

    async updateAndroidDeviceBindingByAdmin(teamNumber: number, scoutifyUserId: string, androidDeviceId: string | null) {
        const [result]: any = await scoutifyPool.query(
            `UPDATE user_master
             SET um_android_device_id = ?
             WHERE team_master_tm_number = ? AND um_id = ?`,
            [androidDeviceId, teamNumber, scoutifyUserId],
        );

        if (!result?.affectedRows) {
            return null;
        }

        const [rows]: any = await scoutifyPool.query(
            `SELECT
                team_master_tm_number,
                um_id,
                um_casdoor_userid,
                um_android_device_id
             FROM user_master
             WHERE team_master_tm_number = ? AND um_id = ?
             LIMIT 1`,
            [teamNumber, scoutifyUserId],
        );

        return rows?.[0] || null;
    }

    async getUserBindingByUsername(username: string, teamNumber?: number) {
        return this.findUserByUsername(username, teamNumber);
    }

    async updateAndroidDeviceBindingByAdminUsingUsername(teamNumber: number, scoutifyUsername: string, androidDeviceId: string | null) {
        const boundUser = await this.findUserByUsername(scoutifyUsername, teamNumber);
        if (!boundUser) {
            return null;
        }

        return this.updateAndroidDeviceBindingByAdmin(
            boundUser.team_master_tm_number,
            boundUser.um_id,
            androidDeviceId,
        );
    }

    async resolveScoutifyUserIdByUsername(username?: string, teamNumber?: number) {
        const normalizedUsername = this.normalizeString(username);
        if (!normalizedUsername) {
            return null;
        }

        const user = await this.findUserByUsername(normalizedUsername, teamNumber);
        return user?.um_id || null;
    }

    async listGameMatchups(filters: QueryFilters, limit?: number, offset?: number) {
        const where: string[] = [];
        const params: Array<string | number> = [];

        Object.entries(filters || {}).forEach(([column, value]) => {
            if (value !== undefined && value !== '') {
                where.push(`${column} = ?`);
                params.push(value);
            }
        });

        const whereClause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
        
        // FIX: Increased the absolute maximum limit from 500 to 2000.
        // A full regional has ~100 matches * 6 teams = ~600 rows.
        const safeLimit = Math.min(Math.max(Number(limit) || 1000, 1), 2000);
        const safeOffset = Math.max(Number(offset) || 0, 0);

        const [rows]: any = await scoutifyPool.query(
            `SELECT
                frc_season_master_sm_year,
                competition_master_cm_event_code,
                gm_game_type,
                gm_number,
                gm_alliance,
                gm_alliance_position,
                team_master_tm_number,
                gm_value,
                gm_timestamp
             FROM game_matchup${whereClause}
             ORDER BY gm_number ASC, gm_alliance ASC, gm_alliance_position ASC
             LIMIT ? OFFSET ?`,
            [...params, safeLimit, safeOffset]
        );

        return rows;
    }

    async listGameDetails(filters: QueryFilters, limit?: number, offset?: number) {
        const { sql, params } = this.buildPagedQuery(
            `SELECT
                frc_season_master_sm_year,
                competition_master_cm_event_code,
                game_matchup_gm_game_type,
                game_matchup_gm_number,
                game_matchup_gm_alliance,
                game_matchup_gm_alliance_position,
                game_element_group_geg_grp_key,
                game_element_ge_key,
                gd_value,
                gd_score,
                gd_um_id,
                gd_auton_path
             FROM game_details`,
            filters,
            'game_matchup_gm_number ASC, game_matchup_gm_alliance ASC, game_matchup_gm_alliance_position ASC',
            limit,
            offset,
        );

        const [rows]: any = await scoutifyPool.query(sql, params);
        return rows;
    }

    async listGameComments(filters: QueryFilters, limit?: number, offset?: number) {
        const { sql, params } = this.buildPagedQuery(
            `SELECT
                frc_season_master_sm_year,
                competition_master_cm_event_code,
                game_matchup_gm_game_type,
                game_matchup_gm_number,
                game_matchup_gm_alliance,
                game_matchup_gm_alliance_position,
                gc_comment,
                gc_um_id,
                gc_ts
             FROM game_comments`,
            filters,
            'game_matchup_gm_number ASC, game_matchup_gm_alliance ASC, game_matchup_gm_alliance_position ASC, gc_ts DESC',
            limit,
            offset,
        );

        const [rows]: any = await scoutifyPool.query(sql, params);
        return rows;
    }

    async createGameComment(authUser: any, payload: CreateGameCommentPayload, username?: string, teamNumber?: number) {
        const boundUser = await this.resolveBoundUser(authUser, username, teamNumber);
        if (!boundUser) {
            return null;
        }

        await scoutifyPool.query(
            `REPLACE INTO game_comments (
                frc_season_master_sm_year,
                competition_master_cm_event_code,
                game_matchup_gm_game_type,
                game_matchup_gm_number,
                game_matchup_gm_alliance,
                game_matchup_gm_alliance_position,
                gc_comment,
                gc_um_id,
                gc_ts
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%d %H:%i:%s.%f'))`,
            [
                payload.frc_season_master_sm_year,
                payload.competition_master_cm_event_code,
                payload.game_matchup_gm_game_type,
                payload.game_matchup_gm_number,
                payload.game_matchup_gm_alliance,
                payload.game_matchup_gm_alliance_position,
                payload.gc_comment,
                boundUser.um_id,
            ],
        );

        return boundUser?.um_id ? payload : null
    }

    async listEventAssignments(authUser: any, filters: QueryFilters, limit?: number, offset?: number, username?: string, teamNumber?: number) {
        const boundUser = await this.resolveBoundUser(authUser, username, teamNumber);
        if (!boundUser) {
            return null;
        }

        const mergedFilters: QueryFilters = {
            um_id: boundUser.um_id,
            user_tm_number: boundUser.team_master_tm_number,
            ...filters,
        };

        const { sql, params } = this.buildPagedQuery(
            `SELECT
                sm_year,
                cm_event_code,
                tm_number,
                um_id,
                user_tm_number
             FROM event_teams_user_assignment`,
            mergedFilters,
            'sm_year DESC, cm_event_code ASC, tm_number ASC',
            limit,
            offset,
        );

        const [rows]: any = await scoutifyPool.query(sql, params);
        return {
            boundUser,
            rows,
        };
    }

    async listEventTasks(authUser: any, filters: QueryFilters, limit?: number, offset?: number, username?: string, teamNumber?: number) {
        const boundUser = await this.resolveBoundUser(authUser, username, teamNumber);
        if (!boundUser) {
            return null;
        }

        const mergedFilters: QueryFilters = {
            um_id: boundUser.um_id,
            user_tm_number: boundUser.team_master_tm_number,
            ...filters,
        };

        const { sql, params } = this.buildPagedQuery(
            `SELECT
                task_id,
                sm_year,
                cm_event_code,
                tm_number,
                um_id,
                user_tm_number,
                gm_number,
                gm_game_type,
                checkin_task,
                task_completed,
                ett_ts
             FROM event_task_tracker`,
            mergedFilters,
            'sm_year DESC, cm_event_code ASC, gm_number ASC, task_id ASC',
            limit,
            offset,
        );

        const [rows]: any = await scoutifyPool.query(sql, params);
        return {
            boundUser,
            rows,
        };
    }

    async createGameDetail(authUser: any, payload: any, username?: string, teamNumber?: number) {
        const boundUser = await this.resolveBoundUser(authUser, username, teamNumber);
        if (!boundUser) {
            return null;
        }

        if (!payload || !payload.length) return [];

        // 1. Fetch the current game constants from the database
        const [constantsRows]: any = await scoutifyPool.query(
            `SELECT 
                frc_season_master_sm_year, 
                competition_master_cm_event_code, 
                game_matchup_gm_game_type 
             FROM game_constants LIMIT 1`
        );

        if (!constantsRows || constantsRows.length === 0) {
            throw new Error("Game constants are not configured in the database.");
        }

        const currentYear = constantsRows[0].frc_season_master_sm_year;
        const currentEventCode = constantsRows[0].competition_master_cm_event_code;
        const currentGameType = constantsRows[0].game_matchup_gm_game_type;

        // 2. Mapping based on the provided CSV
        const fieldMapping: Record<string, { ge_key: number; grp_key: number; isString?: boolean }> = {
            // Group 1: Pregame
            startingLocation: { ge_key: 1001, grp_key: 1 },
            robotOnField: { ge_key: 1002, grp_key: 1 },
            robotPreloaded: { ge_key: 1003, grp_key: 1 },
            
            // Group 2: Auton
            autonPath: { ge_key: 2001, grp_key: 2, isString: true },
            autonAttemptsClimb: { ge_key: 2101, grp_key: 2 },
            autonClimbSuccess: { ge_key: 2103, grp_key: 2 },
            autonClimbPosition: { ge_key: 2104, grp_key: 2, isString: true },
            autonFuelCount: { ge_key: 2201, grp_key: 2 },

            // Group 3: Transition & Shifts
            transitionFirstActive: { ge_key: 3000, grp_key: 3 },
            transitionCyclingTime: { ge_key: 3001, grp_key: 3 },
            transitionStockpilingTime: { ge_key: 3002, grp_key: 3 },
            transitionDefendingTime: { ge_key: 3003, grp_key: 3 },
            transitionBrokenTime: { ge_key: 3004, grp_key: 3 },

            shift1CyclingTime: { ge_key: 3101, grp_key: 3 },
            shift1StockpilingTime: { ge_key: 3102, grp_key: 3 },
            shift1DefendingTime: { ge_key: 3103, grp_key: 3 },
            shift1BrokenTime: { ge_key: 3104, grp_key: 3 },

            shift2CyclingTime: { ge_key: 3201, grp_key: 3 },
            shift2StockpilingTime: { ge_key: 3202, grp_key: 3 },
            shift2DefendingTime: { ge_key: 3203, grp_key: 3 },
            shift2BrokenTime: { ge_key: 3204, grp_key: 3 },

            shift3CyclingTime: { ge_key: 3301, grp_key: 3 },
            shift3StockpilingTime: { ge_key: 3302, grp_key: 3 },
            shift3DefendingTime: { ge_key: 3303, grp_key: 3 },
            shift3BrokenTime: { ge_key: 3304, grp_key: 3 },

            shift4CyclingTime: { ge_key: 3401, grp_key: 3 },
            shift4StockpilingTime: { ge_key: 3402, grp_key: 3 },
            shift4DefendingTime: { ge_key: 3403, grp_key: 3 },
            shift4BrokenTime: { ge_key: 3404, grp_key: 3 },

            endgameCyclingTime: { ge_key: 3501, grp_key: 3 },
            endgameStockpilingTime: { ge_key: 3502, grp_key: 3 },
            endgameDefendingTime: { ge_key: 3503, grp_key: 3 },
            endgameBrokenTime: { ge_key: 3504, grp_key: 3 },

            // Group 4: Endgame, Teleop, Postgame
            endgameAttemptsClimb: { ge_key: 4101, grp_key: 4 },
            endgameClimbSuccess: { ge_key: 4102, grp_key: 4 },
            endgameClimbPosition: { ge_key: 4103, grp_key: 4, isString: true },
            
            teleopFuelCount: { ge_key: 4200, grp_key: 4 },
            postgameShootAnywhere: { ge_key: 4201, grp_key: 4 },
            postgameShootWhileMoving: { ge_key: 4202, grp_key: 4 },
            postgameStockpileNeutral: { ge_key: 4203, grp_key: 4 },
            postgameStockpileAlliance: { ge_key: 4204, grp_key: 4 },
            postgameStockpileCrossCourt: { ge_key: 4205, grp_key: 4 },
            postgameFeedOutpost: { ge_key: 4206, grp_key: 4 },
            postgameReceiveOutpost: { ge_key: 4207, grp_key: 4 },
            postgameUnderTrench: { ge_key: 4208, grp_key: 4 },
            postgameOverBump: { ge_key: 4209, grp_key: 4 },

            // Review Flags
            pregameFlag: { ge_key: 4211, grp_key: 4 },
            autonFlag: { ge_key: 4212, grp_key: 4 },
            teleopFlag: { ge_key: 4213, grp_key: 4 },
            postgameFlag: { ge_key: 4214, grp_key: 4 },
        };

        const dbRowsToInsert: any[] = [];

        // 3. Convert the incoming Kotlin objects into individual rows
        for (const gameDetail of payload) {
            for (const [fieldName, mapping] of Object.entries(fieldMapping)) {
                const rawValue = gameDetail[fieldName];
                
                // If the value exists (isn't null or undefined), add it to the insertion list
                if (rawValue !== null && rawValue !== undefined) {
                    
                    let numValue = 0;
                    let stringValue: string | null = null;

                    if (mapping.isString) {
                        stringValue = String(rawValue);
                    } else if (typeof rawValue === 'boolean') {
                        numValue = rawValue ? 1 : 0; // Convert booleans to 1/0 for MySQL
                    } else {
                        numValue = Number(rawValue); // Numbers stay as numbers
                    }

                    dbRowsToInsert.push({
                        frc_season_master_sm_year: currentYear,
                        competition_master_cm_event_code: currentEventCode,
                        game_matchup_gm_game_type: currentGameType,
                        game_matchup_gm_number: gameDetail.matchNumber,
                        
                        game_matchup_gm_alliance: gameDetail.alliance,
                        game_matchup_gm_alliance_position: gameDetail.alliancePosition,
                        
                        game_element_group_geg_grp_key: mapping.grp_key,
                        game_element_ge_key: mapping.ge_key,
                        gd_value: numValue,
                        gd_score: 0, // Defaults to 0
                        gd_um_id: boundUser.um_id,
                        gd_auton_path: stringValue, // Reuse gd_auton_path for all string entries
                    });
                }
            }
        }

        if (dbRowsToInsert.length === 0) return [];

        const rowPlaceholders = `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const allPlaceholders = dbRowsToInsert.map(() => rowPlaceholders).join(', ');

        const flattenedValues = dbRowsToInsert.flatMap(p => [
            p.frc_season_master_sm_year,
            p.competition_master_cm_event_code,
            p.game_matchup_gm_game_type,
            p.game_matchup_gm_number,
            p.game_matchup_gm_alliance,
            p.game_matchup_gm_alliance_position,
            p.game_element_group_geg_grp_key,
            p.game_element_ge_key,
            p.gd_value,
            p.gd_score,
            p.gd_um_id,
            p.gd_auton_path
        ]);

        // 4. Insert all rows into game_details
        await scoutifyPool.query(
            `REPLACE INTO game_details (
                frc_season_master_sm_year,
                competition_master_cm_event_code,
                game_matchup_gm_game_type,
                game_matchup_gm_number,
                game_matchup_gm_alliance,
                game_matchup_gm_alliance_position,
                game_element_group_geg_grp_key,
                game_element_ge_key,
                gd_value,
                gd_score,
                gd_um_id,
                gd_auton_path
            ) VALUES ${allPlaceholders}`,
            flattenedValues
        );

        return payload;
    }

    async updateGameDetail(payload: {
        match: {
            frc_season_master_sm_year: number;
            competition_master_cm_event_code: string;
            game_matchup_gm_game_type: string;
            game_matchup_gm_number: number;
            game_matchup_gm_alliance: string;
            game_matchup_gm_alliance_position: number;
            game_element_group_geg_grp_key: number;
            game_element_ge_key: number;
            gd_um_id: string;
        };
        changes: {
            gd_value?: number;
            gd_score?: number;
            gd_auton_path?: string | null;
        };
    }) {
        const fields: string[] = [];
        const values: Array<string | number | null> = [];

        if (payload.changes.gd_value !== undefined) {
            fields.push('gd_value = ?');
            values.push(payload.changes.gd_value);
        }
        if (payload.changes.gd_score !== undefined) {
            fields.push('gd_score = ?');
            values.push(payload.changes.gd_score);
        }
        if (payload.changes.gd_auton_path !== undefined) {
            fields.push('gd_auton_path = ?');
            values.push(payload.changes.gd_auton_path);
        }

        if (!fields.length) {
            return { affectedRows: 0 };
        }

        const [result]: any = await scoutifyPool.query(
            `UPDATE game_details
             SET ${fields.join(', ')}
             WHERE frc_season_master_sm_year = ?
               AND competition_master_cm_event_code = ?
               AND game_matchup_gm_game_type = ?
               AND game_matchup_gm_number = ?
               AND game_matchup_gm_alliance = ?
               AND game_matchup_gm_alliance_position = ?
               AND game_element_group_geg_grp_key = ?
               AND game_element_ge_key = ?
               AND gd_um_id = ?`,
            [
                ...values,
                payload.match.frc_season_master_sm_year,
                payload.match.competition_master_cm_event_code,
                payload.match.game_matchup_gm_game_type,
                payload.match.game_matchup_gm_number,
                payload.match.game_matchup_gm_alliance,
                payload.match.game_matchup_gm_alliance_position,
                payload.match.game_element_group_geg_grp_key,
                payload.match.game_element_ge_key,
                payload.match.gd_um_id,
            ],
        );

        return { affectedRows: result?.affectedRows || 0 };
    }

    async deleteGameDetail(payload: {
        frc_season_master_sm_year: number;
        competition_master_cm_event_code: string;
        game_matchup_gm_game_type: string;
        game_matchup_gm_number: number;
        game_matchup_gm_alliance: string;
        game_matchup_gm_alliance_position: number;
        game_element_group_geg_grp_key: number;
        game_element_ge_key: number;
        gd_um_id: string;
    }) {
        const [result]: any = await scoutifyPool.query(
            `DELETE FROM game_details
             WHERE frc_season_master_sm_year = ?
               AND competition_master_cm_event_code = ?
               AND game_matchup_gm_game_type = ?
               AND game_matchup_gm_number = ?
               AND game_matchup_gm_alliance = ?
               AND game_matchup_gm_alliance_position = ?
               AND game_element_group_geg_grp_key = ?
               AND game_element_ge_key = ?
               AND gd_um_id = ?`,
            [
                payload.frc_season_master_sm_year,
                payload.competition_master_cm_event_code,
                payload.game_matchup_gm_game_type,
                payload.game_matchup_gm_number,
                payload.game_matchup_gm_alliance,
                payload.game_matchup_gm_alliance_position,
                payload.game_element_group_geg_grp_key,
                payload.game_element_ge_key,
                payload.gd_um_id,
            ],
        );

        return { affectedRows: result?.affectedRows || 0 };
    }

    async createEventAssignment(payload: {
        sm_year: number;
        cm_event_code: string;
        tm_number: number;
        um_id: string;
        user_tm_number: number;
    }) {
        await scoutifyPool.query(
            `INSERT INTO event_teams_user_assignment (
                sm_year,
                cm_event_code,
                tm_number,
                um_id,
                user_tm_number
            ) VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE user_tm_number = VALUES(user_tm_number)`,
            [payload.sm_year, payload.cm_event_code, payload.tm_number, payload.um_id, payload.user_tm_number],
        );

        return payload;
    }

    async deleteEventAssignment(payload: {
        sm_year: number;
        cm_event_code: string;
        tm_number: number;
        um_id: string;
    }) {
        const [result]: any = await scoutifyPool.query(
            `DELETE FROM event_teams_user_assignment
             WHERE sm_year = ?
               AND cm_event_code = ?
               AND tm_number = ?
               AND um_id = ?`,
            [payload.sm_year, payload.cm_event_code, payload.tm_number, payload.um_id],
        );

        return { affectedRows: result?.affectedRows || 0 };
    }

    async createEventTask(payload: {
        sm_year: number;
        cm_event_code: string;
        tm_number: number;
        um_id: string;
        user_tm_number: number;
        gm_number: number;
        checkin_task: string;
        task_completed?: number;
        gm_game_type?: string | null;
    }) {
        const [result]: any = await scoutifyPool.query(
            `INSERT INTO event_task_tracker (
                sm_year,
                cm_event_code,
                tm_number,
                um_id,
                user_tm_number,
                gm_number,
                checkin_task,
                task_completed,
                gm_game_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                payload.sm_year,
                payload.cm_event_code,
                payload.tm_number,
                payload.um_id,
                payload.user_tm_number,
                payload.gm_number,
                payload.checkin_task,
                payload.task_completed ?? 0,
                payload.gm_game_type ?? null,
            ],
        );

        return {
            task_id: result?.insertId,
            ...payload,
        };
    }

    async updateEventTask(taskId: number, changes: {
        gm_number?: number;
        checkin_task?: string;
        task_completed?: number;
        gm_game_type?: string | null;
    }, scopedUser?: Pick<BoundScoutifyUser, 'um_id' | 'team_master_tm_number'> | null) {
        const fields: string[] = [];
        const values: Array<string | number | null> = [];

        if (changes.gm_number !== undefined) {
            fields.push('gm_number = ?');
            values.push(changes.gm_number);
        }
        if (changes.checkin_task !== undefined) {
            fields.push('checkin_task = ?');
            values.push(changes.checkin_task);
        }
        if (changes.task_completed !== undefined) {
            fields.push('task_completed = ?');
            values.push(changes.task_completed);
        }
        if (changes.gm_game_type !== undefined) {
            fields.push('gm_game_type = ?');
            values.push(changes.gm_game_type);
        }

        if (!fields.length) {
            return { affectedRows: 0 };
        }

        const whereSql = scopedUser
            ? 'WHERE task_id = ? AND um_id = ? AND user_tm_number = ?'
            : 'WHERE task_id = ?';

        const whereParams: Array<string | number> = scopedUser
            ? [taskId, scopedUser.um_id, scopedUser.team_master_tm_number]
            : [taskId];

        const [result]: any = await scoutifyPool.query(
            `UPDATE event_task_tracker
             SET ${fields.join(', ')}
             ${whereSql}`,
            [...values, ...whereParams],
        );

        return { affectedRows: result?.affectedRows || 0 };
    }

    async deleteEventTask(taskId: number, scopedUser?: Pick<BoundScoutifyUser, 'um_id' | 'team_master_tm_number'> | null) {
        const whereSql = scopedUser
            ? 'WHERE task_id = ? AND um_id = ? AND user_tm_number = ?'
            : 'WHERE task_id = ?';

        const whereParams: Array<string | number> = scopedUser
            ? [taskId, scopedUser.um_id, scopedUser.team_master_tm_number]
            : [taskId];

        const [result]: any = await scoutifyPool.query(
            `DELETE FROM event_task_tracker ${whereSql}`,
            whereParams,
        );

        return { affectedRows: result?.affectedRows || 0 };
    }

    async getGameConstants() {
        const [rows]: any = await scoutifyPool.query(
            `SELECT * FROM game_constants;`
        )

        return rows?.[0]
    }
}

export default new ScoutifyService();
