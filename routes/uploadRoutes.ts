import express, { Request, Response } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, ObjectCannedACL, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { mainPool as pool } from '../config/database'; // Import database connection pool
import { verifyToken } from '../middlewares/auth';

dotenv.config();

const router = express.Router();

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const allowedUploadTypes = new Set(['fullRobot', 'driveTrain', 'intake']);

// Configure S3 client
const s3Client = new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: 'auto',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

const normalizeImageIdentifier = (value: string): string => {
    const decodedValue = decodeURIComponent(value);

    if (decodedValue.startsWith('http://') || decodedValue.startsWith('https://')) {
        return decodedValue;
    }

    if (decodedValue.startsWith('/')) {
        return `${process.env.CUSTOM_DOMAIN}${decodedValue}`;
    }

    return `${process.env.CUSTOM_DOMAIN}/${decodedValue}`;
};

const getFileKeyFromImageUrl = (imageUrl: string): string | null => {
    const prefix = `${process.env.CUSTOM_DOMAIN}/`;

    if (!imageUrl.startsWith(prefix)) {
        return null;
    }

    return imageUrl.slice(prefix.length);
};

const parseUploadPayload = (uploadValue: unknown) => {
    if (!uploadValue) {
        return { fullRobotImages: [], driveTrainImages: [], intakeImages: [] as any[] };
    }

    if (typeof uploadValue === 'string') {
        try {
            return parseUploadPayload(JSON.parse(uploadValue));
        } catch {
            return { fullRobotImages: [], driveTrainImages: [], intakeImages: [] as any[] };
        }
    }

    if (typeof uploadValue !== 'object' || Array.isArray(uploadValue)) {
        return { fullRobotImages: [], driveTrainImages: [], intakeImages: [] as any[] };
    }

    const record = uploadValue as Record<string, unknown>;
    return {
        fullRobotImages: Array.isArray(record.fullRobotImages) ? record.fullRobotImages : [],
        driveTrainImages: Array.isArray(record.driveTrainImages) ? record.driveTrainImages : [],
        intakeImages: Array.isArray(record.intakeImages) ? record.intakeImages : [],
    };
};

// Upload image to Cloudflare R2 (requires authentication)
router.post('/upload', verifyToken, upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { type } = req.body;
        if (typeof type !== 'string' || !allowedUploadTypes.has(type)) {
            return res.status(400).json({ error: 'Invalid upload type' });
        }

        // Fetch the latest eventId from database
        const [rows]: any = await pool.query('SELECT event_id FROM events ORDER BY event_date DESC LIMIT 1');
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        const eventId = rows[0].event_id;

        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const fileKey = `${process.env.UPLOAD_DIR}/${year}/${type}/${year}-${month}-${day}_${eventId}_${uuidv4()}_${req.file.originalname}`;

        const params = {
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: fileKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read' as ObjectCannedACL,
        };

        const command = new PutObjectCommand(params);
        await s3Client.send(command);

        const fileUrl = `${process.env.CUSTOM_DOMAIN}/${fileKey}`;
        res.status(200).json({ id: fileUrl, url: fileUrl, key: fileKey, type });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// Delete image API
router.delete('/images/:imageId', verifyToken, async (req: Request, res: Response) => {
    const { imageId } = req.params;

    try {
        const imageUrl = normalizeImageIdentifier(imageId);
        const fileKey = getFileKeyFromImageUrl(imageUrl);

        if (!fileKey) {
            return res.status(400).json({ error: 'Invalid image identifier' });
        }

        // Delete image from Cloudflare R2
        const deleteParams = {
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: fileKey,
        };

        const deleteCommand = new DeleteObjectCommand(deleteParams);
        await s3Client.send(deleteCommand);

        // Best-effort cleanup in stored survey responses.
        const [rows]: any = await pool.query(
            'SELECT id, upload FROM survey_responses WHERE JSON_SEARCH(CAST(upload AS CHAR), "one", ?) IS NOT NULL',
            [imageUrl]
        );

        for (const row of rows) {
            const parsedUpload = parseUploadPayload(row.upload);
            const nextUpload = {
                fullRobotImages: parsedUpload.fullRobotImages.filter((img: any) => img?.url !== imageUrl),
                driveTrainImages: parsedUpload.driveTrainImages.filter((img: any) => img?.url !== imageUrl),
                intakeImages: parsedUpload.intakeImages.filter((img: any) => img?.url !== imageUrl),
            };

            await pool.query(
                'UPDATE survey_responses SET upload = ? WHERE id = ?',
                [JSON.stringify(nextUpload), row.id]
            );
        }

        res.status(200).json({ message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

export default router;
