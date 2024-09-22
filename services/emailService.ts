import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';

dotenv.config();

const toEDT = (timestamp: string) => {
    return moment(timestamp).tz('America/New_York').format('YYYY-MM-DD HH:mm:ss');
};

const loadTemplate = (data: any) => {
    const templatePath = path.join(__dirname, '../templates/feedbackEmailTemplate.html');
    let template = fs.readFileSync(templatePath, 'utf-8');
    const sendTimeInEDT = toEDT(data.timestamp);

    // 替换模板中的变量
    template = template.replace(/{name}/g, data.nickname)
        .replace(/{email}/g, data.contact)
        .replace(/{Title}/g, data.title)
        .replace(/{message}/g, data.content) // 保留 HTML 格式
        .replace(/{sendtime}/g, sendTimeInEDT) // 转换为 EDT
        .replace(/{IP}/g, data.deviceInfo.ip)
        .replace(/{UA}/g, data.deviceInfo.userAgent)
        .replace(/{Screen}/g, data.deviceInfo.screenSize)
        .replace(/{lang}/g, data.deviceInfo.language);

    return template;
};

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '465', 10), // Default to port 465 if undefined
    secure: true, // 使用 SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendEmail = async (feedback: any) => {
    const htmlContent = loadTemplate(feedback);

    // 将管理员邮箱转换为数组，以便发送给多个管理员
    const adminEmails = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.split(',') : [];

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: adminEmails, // 管理员邮箱
        subject: `[695 Website] New Message from ${feedback.nickname}`,
        html: htmlContent,
    };

    return transporter.sendMail(mailOptions);
};
