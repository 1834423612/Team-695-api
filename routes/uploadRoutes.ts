import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const router = express.Router();

// 设置 multer 存储配置
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 配置 S3 客户端
const s3Client = new S3Client({
    endpoint: process.env.R2_ENDPOINT,
    region: 'auto',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

// 上传图片到 Cloudflare R2
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileKey = `${process.env.UPLOAD_DIR}/${uuidv4()}-${req.file.originalname}`;
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
        res.status(200).json({ url: fileUrl });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

export default router;
