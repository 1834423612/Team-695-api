import express from 'express'
import endpointsRouter from './info/endpointsRoutes'
import statusRouter from './info/statusRoutes'
import infoRouter from './info/infoRoutes'

const router = express.Router()

// Define the routes for API information
router.use('/endpoints', endpointsRouter)
router.use('/status', statusRouter)
router.use('/', infoRouter)

export default router