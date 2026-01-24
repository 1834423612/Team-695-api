import express from 'express';
import pool from '../config/database';
import { verifyToken } from '../middlewares/auth';
import { success, error } from '../utils/responses';

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
}

// Apply verifyToken middleware to routes requiring authentication
router.use('/submit', verifyToken);
router.use('/query', verifyToken);

// Survey submission API
/*
    Call submission API: Use POST method to call /api/survey/submit endpoint with the following parameters:
        eventId: string; // Event ID
        tabs: Tab[]; // Form data array, each form contains formId and formData
        images: Images; // Image data, containing fullRobotImages and driveTrainImages
        userData: { email: string; avatar: string; userId: string; username: string; displayName: string; }; // User Data, Including email, avatar, userId, username and displayName
        deviceInfo: any; // Device info, including userAgent, ip and language
*/
router.post('/submit', async (req, res) => {
    const { eventId, tabs, images, userData, deviceInfo }: { 
        eventId: string; 
        tabs: Tab[]; 
        images: Images; 
        userData: { email: string; avatar: string; userId: string; username: string; displayName: string; };
        deviceInfo: any; 
    } = req.body;

    try {
        for (const tab of tabs) {
            const formData = tab.formData.reduce((acc: any, field: any) => {
                acc[field.question] = field.value;
                return acc;
            }, {});

            // Ensure images data exists
            const tabImages = images || { fullRobotImages: [], driveTrainImages: [] };

            const { userAgent, ip, language } = deviceInfo;

            await pool.query(
                'INSERT INTO survey_responses (event_id, form_id, data, upload, user_data, user_agent, ip, language, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
                [
                    eventId, 
                    tab.formId, 
                    JSON.stringify(formData), 
                    JSON.stringify(tabImages), 
                    JSON.stringify(userData),
                    userAgent, 
                    ip, 
                    language
                ]
            );
        }

        return success(res, { message: 'Survey submitted successfully' }, 'Survey submitted successfully');
    } catch (err) {
        console.error('Error submitting survey:', err);
        return error(res, 500, 'Failed to submit survey', err);
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
    const { eventId, formId, teamNumber } = req.query;

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
        query += ' AND JSON_EXTRACT(data, "$.teamNumber") = ?';
        queryParams.push(teamNumber);
    }

    try {
        const [rows]: any = await pool.query(query, queryParams);
        return success(res, rows, 'Survey responses retrieved successfully');
    } catch (err) {
        console.error('Error querying survey responses:', err);
        return error(res, 500, 'Failed to query survey responses', err);
    }
});

export default router;
