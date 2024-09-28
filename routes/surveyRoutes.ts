import express from 'express';
import pool from '../config/database';
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

router.post('/submit', async (req, res) => {
    const { eventId, tabs, images, deviceInfo }: { eventId: string; tabs: Tab[]; images: Images; deviceInfo: any } = req.body;

    try {
        for (const tab of tabs) {
            const formData = tab.formData.reduce((acc: any, field: any) => {
                acc[field.question] = field.value;
                return acc;
            }, {});

            // 确保 images 数据存在
            const tabImages = images || { fullRobotImages: [], driveTrainImages: [] };

            const { userAgent, ip, language } = deviceInfo;

            await pool.query(
                'INSERT INTO survey_responses (event_id, form_id, data, upload, user_agent, ip, language, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
                [eventId, tab.formId, JSON.stringify(formData), JSON.stringify(tabImages), userAgent, ip, language]
            );
        }

        res.status(200).json({ message: 'Survey submitted successfully' });
    } catch (error) {
        console.error('Error submitting survey:', error);
        res.status(500).json({ error: 'Failed to submit survey' });
    }
});

// 新增查询 API
/*
    调用查询 API：使用不同的查询参数调用 /api/survey/query 端点，例如：
        获取所有问卷信息：GET /api/survey/query
        根据 eventId 查询：GET /api/survey/query?eventId=Event123
        根据 formId 查询：GET /api/survey/query?formId=f36c46f5-aa42-4d3b-880b-cb301719bc5c
        根据 teamNumber 查询：GET /api/survey/query?teamNumber=89898899
*/ 
router.get('/query', async (req, res) => {
    const { eventId, formId, teamNumber } = req.query;

    let query = 'SELECT id, event_id, form_id, data, upload, timestamp FROM survey_responses WHERE 1=1';
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
        query += ' AND JSON_EXTRACT(data, "$.Team number") = ?';
        queryParams.push(teamNumber);
    }

    try {
        const [rows]: any = await pool.query(query, queryParams);
        res.json(rows);
    } catch (error) {
        console.error('Error querying survey responses:', error);
        res.status(500).json({ error: 'Failed to query survey responses' });
    }
});

export default router;
