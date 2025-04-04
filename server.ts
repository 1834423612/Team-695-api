// Copyright 2023 The Casdoor Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import url from "url"
import { SDK } from "casdoor-nodejs-sdk"
import express from "express"
import fs from "fs"
import path from "path"
import cors from "cors"
import dotenv from "dotenv"

// Load environment variables
dotenv.config()

// Initialize Casdoor SDK
const cert =
    process.env.CASDOOR_CERTIFICATE ||
    `
-----BEGIN CERTIFICATE-----
MIIE3TCCAsWgAwIBAgIDAeJAMA0GCSqGSIb3DQEBCwUAMCgxEDAOBgNVBAoTB1Rl
YW02OTUxFDASBgNVBAMMC2NlcnRfaWQ2bGU5MB4XDTI1MDQwNDE5MzQxMFoXDTQ1
MDQwNDE5MzQxMFowKDEQMA4GA1UEChMHVGVhbTY5NTEUMBIGA1UEAwwLY2VydF9p
ZDZsZTkwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDJiPBUsehpWlxf
E39m8DgBLq3cyhVW5Cx9dDmoagE55+D/F9JZhKOgdW9MVgQUMjNz7FhYtLigI+f4
SxVgz3KKqmc78hUxszZQDNhnBwTxd1K6SzfhYV8aGHcYBaWWpj5jTJoJ5ZJTGYWg
7xeSLrqkiTwhqHXi+Uf5cZAecARcB4v2ybXLrf4uIsm6BakS54ttch5cUB8dR61s
1O7qDKreiEfMg+T4PvSeosOE3gI0ZpghEVSR5WWaytyP8fBfbNrdcvsOfCoBWpLq
kYo9JmMMhqlrmnNfnyJ0BWhhNO6x+G9LEoi8rhe/Yc+SM4xzicWGrAjoYwINYKZG
RQqc1Su+srVrsF/M5j23iX5Q97aGe6rV1Qi76UF4Q0fwn7OoL4wOc0tR+30Dh04b
r7kG5bG5aq1N0URW5hkFJsxV8/x7nba8/ZznUGcOwqxnsQdwB+VOfp/WqgoTdJZj
ClwbYGdi9FkceUM2HXzfFh0GkpAEI32Ure4w/+K2vpOO3QKLQFt3wpDdvzDFOSy1
xgwwQL+O1KeS+w+CrMz+hCFq89Jz6dJrTAUGVCgUDtw+DMWLO7wFy/i+vNx+8Rwn
uKN9t4Aui/hRyEXZ66dzfHG1OiJEIgrEkSKhezaVZ7+oCDdjEUfSYFUNlUjVxc2+
uXJe78J+VASQO7ozWJFpm+rGJSpLmwIDAQABoxAwDjAMBgNVHRMBAf8EAjAAMA0G
CSqGSIb3DQEBCwUAA4ICAQBdQmerX0MBaY4aILUx7UJK2DKkc4lbwrmNzZ2FZzXo
EiJJoeuKWcFjPmAxxUUQMwREC2ackjOblOe+269p6D5BGR5F/KJTl0+Xx2dTcvJD
khAabewTCs6nbRNFabFfoH8CNgFwtdZHddSeAj4sTNPBCilQAQOJvGs9e09f4UHl
mKBKNLMwsJf1pkj1uHga1EYo5ibzVJZhvlt8NKZO9fne9Rdcy3s5CMwp681l9gAt
OGToJysvvxHqic2nOhRO9w7ss5WiCU84UB6EOiJFmk0AtWfv7ICvTOvWrrvjcTg7
qB02MNY+tWPYunsb1pH3sKWDo3K4s2vU7em+nrOeQn/2oApVtYBFA0aOBqV1+7p/
v/ijJ8Ibr2L2oyyQxmFVaLM8+sgILx4nD4OnQHbAmEMVLdllRmyEyuAoRLbIYQgl
TV0ynsUPqkLij0L1CN9xZ16Ccx115ybutYWml79ey8xHUo71eyDi88KNK8tAGA68
FV2dIe56vuPl8f2p99Yc064t07bSiro2tVJfPCqVXqncLlKIWUClO7moVpBiNAMD
w5noeJqQ945YUO81eNrnEz+qtJ4/o5h9nk/9utgPYLp/v1PVp9OP5JSO1k5FfnBG
C3K5MxfUMA94AON0yXmhiwAhQPdvqFA/keqr6TmDgEAw+AvvLZaqLgWDixf1gkIX
6w==
-----END CERTIFICATE-----
`

const authCfg = {
    endpoint: process.env.CASDOOR_ENDPOINT || "https://door.casdoor.com",
    clientId: process.env.CASDOOR_CLIENT_ID || "014ae4bd048734ca2dea",
    clientSecret: process.env.CASDOOR_CLIENT_SECRET || "f26a4115725867b7bb7b668c81e1f8f7fae1544d",
    certificate: cert,
    orgName: process.env.CASDOOR_ORG_NAME || "casbin",
    appName: process.env.CASDOOR_APP_NAME || "app-casnode",
}

const sdk = new SDK(authCfg)

// Create Express app
const app = express()

// Configure CORS
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:9000",
        credentials: true,
    }),
)

// Serve the index.html file
app.get("/", (req, res) => {
    fs.readFile(path.resolve(__dirname, "./public/index.html"), (err, data) => {
        if (err) {
            res.status(500).send("Error loading index.html")
            return
        }
        res.setHeader("Content-Type", "text/html")
        res.send(data)
    })
})

// Get user info from token
app.get("/api/getUserInfo", (req, res) => {
    try {
        const urlObj = url.parse(req.url, true).query
        const token = urlObj.token as string

        if (!token) {
            res.status(400).send(JSON.stringify({ error: "Token is required" }))
            return
        }

        const user = sdk.parseJwtToken(token)
        console.log("User info:", user)
        res.send(JSON.stringify(user))
    } catch (error) {
        console.error("Error getting user info:", error)
        res.status(500).send(JSON.stringify({ error: "Failed to get user info" }))
    }
})

// Handle OAuth callback
app.post("/api/login", (req, res) => {
    try {
        const urlObj = url.parse(req.url, true).query
        const code = urlObj.code as string

        if (!code) {
            res.status(400).send(JSON.stringify({ error: "Authorization code is required" }))
            return
        }

        sdk
            .getAuthToken(code)
            .then((response) => {
                console.log("Token response:", response)
                const accessToken = response.access_token
                // You can also get the refresh token if needed
                // const refreshToken = response.refresh_token;

                res.send(JSON.stringify({ token: accessToken }))
            })
            .catch((error) => {
                console.error("Error getting auth token:", error)
                res.status(500).send(JSON.stringify({ error: "Failed to get auth token" }))
            })
    } catch (error) {
        console.error("Error in login endpoint:", error)
        res.status(500).send(JSON.stringify({ error: "Internal server error" }))
    }
})

// Start the server
const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`)
})

