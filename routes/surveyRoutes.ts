import express from 'express';
import pool from '../config/database';
const router = express.Router();

router.post('/submit', async (req, res) => {
    const { eventId, tabs } = req.body;

    try {
        for (const tab of tabs) {
            const { formId, formData } = tab;
            for (const field of formData) {
                const values = field.type === 'checkbox' ? field.value : [field.type === 'other' ? field.otherValue : field.value];
                const [rows]: any = await pool.query('SELECT id FROM survey_questions WHERE question = ?', [field.question]);
                if (Array.isArray(rows) && rows.length > 0) {
                    const questionId = rows[0].id;
                    for (const value of values) {
                        await pool.query('INSERT INTO survey_responses (event_id, form_id, question_id, answer) VALUES (?, ?, ?, ?)', [eventId, formId, questionId, value]);
                    }
                } else {
                    console.error(`Question not found: ${field.question}`);
                    throw new Error('Question not found');
                }
            }
        }
        res.status(200).json({ message: 'Survey submitted successfully' });
    } catch (error) {
        console.error('Error submitting survey:', error);
        res.status(500).json({ error: 'Failed to submit survey' });
    }
});

export default router;
