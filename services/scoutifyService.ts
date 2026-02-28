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
        const { sql, params } = this.buildPagedQuery(
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
             FROM game_matchup`,
            filters,
            'gm_number ASC, gm_alliance ASC, gm_alliance_position ASC',
            limit,
            offset,
        );

        const [rows]: any = await scoutifyPool.query(sql, params);
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
            `INSERT INTO game_comments (
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

        const [rows]: any = await scoutifyPool.query(
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
             FROM game_comments
             WHERE frc_season_master_sm_year = ?
               AND competition_master_cm_event_code = ?
               AND game_matchup_gm_game_type = ?
               AND game_matchup_gm_number = ?
               AND game_matchup_gm_alliance = ?
               AND game_matchup_gm_alliance_position = ?
               AND gc_um_id = ?
             ORDER BY gc_ts DESC
             LIMIT 1`,
            [
                payload.frc_season_master_sm_year,
                payload.competition_master_cm_event_code,
                payload.game_matchup_gm_game_type,
                payload.game_matchup_gm_number,
                payload.game_matchup_gm_alliance,
                payload.game_matchup_gm_alliance_position,
                boundUser.um_id,
            ],
        );

        return rows?.[0] || {
            ...payload,
            gc_um_id: boundUser.um_id,
        };
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

    async createGameDetail(payload: {
        frc_season_master_sm_year: number;
        competition_master_cm_event_code: string;
        game_matchup_gm_game_type: string;
        game_matchup_gm_number: number;
        game_matchup_gm_alliance: string;
        game_matchup_gm_alliance_position: number;
        game_element_group_geg_grp_key: number;
        game_element_ge_key: number;
        gd_value: number;
        gd_score?: number;
        gd_um_id: string;
        gd_auton_path?: string | null;
    }[]) {

        if (!payload.length) return [];

        const rowPlaceholders = `(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const allPlaceholders = payload.map(() => rowPlaceholders).join(', ');

        const flattenedValues = payload.flatMap(p => [
            p.frc_season_master_sm_year,
            p.competition_master_cm_event_code,
            p.game_matchup_gm_game_type,
            p.game_matchup_gm_number,
            p.game_matchup_gm_alliance,
            p.game_matchup_gm_alliance_position,
            p.game_element_group_geg_grp_key,
            p.game_element_ge_key,
            p.gd_value,
            p.gd_score ?? 0,
            p.gd_um_id,
            p.gd_auton_path ?? null,
        ])

        await scoutifyPool.query(
            `INSERT OR REPLACE INTO game_details (
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
