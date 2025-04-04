import CasdoorSDK from 'casdoor-nodejs-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Casdoor configuration
export const casdoorConfig = {
    endpoint: process.env.CASDOOR_ENDPOINT || 'https://sso.team695.com',
    clientId: process.env.CASDOOR_CLIENT_ID || '300932808273326bac0c',
    clientSecret: process.env.CASDOOR_CLIENT_SECRET || '',
    certificate: process.env.CASDOOR_CERTIFICATE || `
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
`, // 确保这里是 Casdoor 提供的公钥
    orgName: process.env.CASDOOR_ORG_NAME || 'Team695',
    appName: process.env.CASDOOR_APP_NAME || '695_website',
};

// JWT verification options
export const jwtOptions = {
    algorithms: ['RS256'], // 确保与 Casdoor 配置一致
    issuer: process.env.JWT_ISSUER || casdoorConfig.endpoint,
    audience: process.env.JWT_AUDIENCE || casdoorConfig.clientId,
};