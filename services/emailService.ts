import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '465', 10), // Default to port 587 if EMAIL_PORT is undefined
    secure: true,
    auth: {
        user: process.env.EMAIL_USER, // 发件邮箱
        pass: process.env.EMAIL_PASS,   // 邮箱密码
    },
});

const loadTemplate = (data: any) => {
    const templatePath = path.join(__dirname, '../templates/feedbackEmailTemplate.html');
    let template = fs.readFileSync(templatePath, 'utf-8');

    // 替换模板中的变量
    template = template.replace(/{name}/g, data.nickname)
        .replace(/{email}/g, data.contact)
        .replace(/{Title}/g, data.title)
        .replace(/{message}/g, data.content)
        .replace(/{sendtime}/g, new Date().toISOString())
        .replace(/{IP}/g, data.deviceInfo.ip)
        .replace(/{UA}/g, data.deviceInfo.userAgent)
        .replace(/{Screen}/g, data.deviceInfo.screenSize)
        .replace(/{lang}/g, data.deviceInfo.language);

    return template;
};

export const sendEmail = async (feedback: any) => {
    const htmlContent = loadTemplate(feedback);

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.ADMIN_EMAIL, // 管理员邮箱
        subject: `New Feedback from ${feedback.nickname}`,
        html: htmlContent,
    };

    return transporter.sendMail(mailOptions);
};
