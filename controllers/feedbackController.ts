import type { Request, Response } from "express"
import db from "../config/database"
import type { Feedback } from "../models/feedback"
import { sendEmail } from "../services/emailService"
import { success, error } from "../utils/responses"

export const submitFeedback = async (req: Request, res: Response) => {
    const feedback: Feedback = req.body

    // Convert deviceInfo to JSON string
    const deviceInfo = JSON.stringify(feedback.deviceInfo)

    // Insert data into database
    const sql = "INSERT INTO feedback SET ?"
    try {
        const [result] = await db.query(sql, { ...feedback, deviceInfo })

        // Add email sending task to background
        setImmediate(() => {
            sendEmail({ ...feedback, deviceInfo: JSON.parse(deviceInfo) })
                .then(() => console.log("Email sent successfully"))
                .catch((error) => console.error("Failed to send email", error))
        })

        return success(res, { message: "Feedback submitted successfully" }, "Feedback submitted successfully")
    } catch (err) {
        console.error("Error inserting into the database:", err)
        return error(res, 500, "Database insertion error", err)
    }
}
