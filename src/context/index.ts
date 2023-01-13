import { PrismaClient } from '@prisma/client'
import { TonClient4 } from 'ton'
import { configureLogger, parseConfig, sleep } from './utils'

const ACCOUNT_WC = 0

const config = parseConfig()
const logger = configureLogger(config.loglvl)
const prisma = new PrismaClient()
const client = new TonClient4({ endpoint: config.apiurl })

export { sleep, config, logger, prisma, client, ACCOUNT_WC }
