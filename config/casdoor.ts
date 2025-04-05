import dotenv from "dotenv"

dotenv.config()

// Casdoor Configuration
export const casdoorConfig = {
    endpoint: process.env.CASDOOR_ENDPOINT || "https://sso.team695.com",
    clientId: process.env.CASDOOR_CLIENT_ID || "",
    clientSecret: process.env.CASDOOR_CLIENT_SECRET || "",
    certificate: process.env.CASDOOR_CERTIFICATE || "",
    orgName: process.env.CASDOOR_ORG_NAME || "Team695",
    appName: process.env.CASDOOR_APP_NAME || "695_website",
}

// JWT Configuration
export const jwtOptions = {
    issuer: process.env.JWT_ISSUER || casdoorConfig.endpoint,
    audience: process.env.JWT_AUDIENCE || casdoorConfig.clientId,
}

