import express from 'express';
import { mainPool as pool } from '../config/database';
import { verifyToken } from '../middlewares/auth';
import { success, error } from '../utils/responses';
import { getDatabaseClientMessage, getDatabaseHttpStatus } from '../utils/databaseError';

const router = express.Router();

interface Tab {
    formId: string;
    formData: any;
}

interface ImageData {
    url: string;
    name: string;
    size: number;
}

interface Images {
    fullRobotImages: ImageData[];
    driveTrainImages: ImageData[];
    intakeImages?: ImageData[];
}

const getQueryValue = (query: Record<string, any>, keys: string[]) => {
    for (const key of keys) {
        const value = query[key];
        if (Array.isArray(value)) {
            const first = value.find((item) => typeof item === 'string' && item.trim());
            if (typeof first === 'string') {
                return first.trim();
            }
            continue;
        }

        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return undefined;
}

const normalizeImages = (images?: Partial<Images> | null): Images => ({
    fullRobotImages: Array.isArray(images?.fullRobotImages) ? images.fullRobotImages : [],
    driveTrainImages: Array.isArray(images?.driveTrainImages) ? images.driveTrainImages : [],
    intakeImages: Array.isArray(images?.intakeImages) ? images.intakeImages : [],
});

// Apply verifyToken middleware to routes requiring authentication
router.use('/submit', verifyToken);
router.use('/query', verifyToken);

// Survey submission API
/*
    Call submission API: Use POST method to call /api/survey/submit endpoint with the following parameters:
        eventId: string; // Event ID
        tabs: Tab[]; // Form data array, each form contains formId and formData
        images: Images; // Image data, containing fullRobotImages, driveTrainImages, and intakeImages
        userData: { email: string; avatar: string; userId: string; username: string; displayName: string; }; // User Data, Including email, avatar, userId, username and displayName
        deviceInfo: any; // Device info, including userAgent, ip and language
*/
router.post('/submit', async (req, res) => {
    const { eventId, tabs, images, userData, user_data, deviceInfo }: { 
        eventId: string; 
        tabs: Tab[]; 
        images: Images; 
        userData: { email: string; avatar: string; userId: string; username: string; displayName: string; };
        user_data?: { email: string; avatar: string; userId: string; username: string; displayName: string; };
        deviceInfo: any; 
    } = req.body;

    try {
        const normalizedImages = normalizeImages(images);
        const normalizedUserData = userData || user_data || {};
        const { userAgent = '', ip = '', language = '' } = deviceInfo || {};

        for (const tab of tabs) {
            const formData = tab.formData.reduce((acc: any, field: any) => {
                acc[field.question] = field.value;
                return acc;
            }, {});

            await pool.query(
                'INSERT INTO survey_responses (event_id, form_id, data, upload, user_data, user_agent, ip, language, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                [
                    eventId, 
                    tab.formId, 
                    JSON.stringify(formData), 
                    JSON.stringify(normalizedImages), 
                    JSON.stringify(normalizedUserData),
                    userAgent, 
                    ip, 
                    language
                ]
            );
        }

        return success(res, { message: 'Survey submitted successfully' }, 'Survey submitted successfully');
    } catch (err) {
        console.error('Error submitting survey:', err);
        return error(
            res,
            getDatabaseHttpStatus(err),
            getDatabaseClientMessage('Failed to submit survey', err),
            err
        );
    }
});

// Query API
/*
    Call query API: Use different query parameters to call /api/survey/query endpoint, for example:
        Get all survey info: GET /api/survey/query
        Query by eventId: GET /api/survey/query?eventId=Event123
        Query by formId: GET /api/survey/query?formId=f36c46f5-aa42-4d3b-880b-cb301719bc5c
        Query by teamNumber: GET /api/survey/query?teamNumber=89898899
*/ 
router.get('/query', async (req, res) => {
    const eventId = getQueryValue(req.query as Record<string, any>, ['eventId', 'eventid', 'event_id']);
    const formId = getQueryValue(req.query as Record<string, any>, ['formId', 'formid', 'form_id']);
    const teamNumber = getQueryValue(req.query as Record<string, any>, ['teamNumber', 'teamnumber', 'team_number']);

    let query = 'SELECT id, event_id, form_id, data, upload, user_data, user_agent, ip, language, timestamp FROM survey_responses WHERE 1=1';
    const queryParams: any[] = [];

    if (eventId) {
        query += ' AND event_id = ?';
        queryParams.push(eventId);
    }

    if (formId) {
        query += ' AND form_id = ?';
        queryParams.push(formId);
    }

    if (teamNumber) {
        query += ' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, \'$."Team number"\')), JSON_UNQUOTE(JSON_EXTRACT(data, "$.teamNumber")), JSON_UNQUOTE(JSON_EXTRACT(data, "$.team_number"))) = ?';
        queryParams.push(String(teamNumber));
    }

    try {
        const [rows]: any = await pool.query(query, queryParams);
        return success(res, rows, 'Survey responses retrieved successfully');
    } catch (err) {
        console.error('Error querying survey responses:', err);
        return error(
            res,
            getDatabaseHttpStatus(err),
            getDatabaseClientMessage('Failed to query survey responses', err),
            err
        );
    }
});

export default router;
