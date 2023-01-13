import * as dotenv from 'dotenv'
import winston from 'winston'

interface IConfig {
    loglvl: string,
    apiurl: string,
    startmc: number,
    sleepmax: number,
    sleepmin: number,
    pubapihost: string
}

function parseEnv (name: string, ifnot: string, req: boolean): string {
    const value = process.env[name]
    if (req && !value) throw new Error(`can't find env var with name ${name}`)
    return value || ifnot
}

function parseConfig (): IConfig {
    dotenv.config()

    return {
        loglvl: parseEnv('LOG_LVL', 'info', false),
        apiurl: parseEnv('V4_API_URL', '', true),
        startmc: parseInt(parseEnv('START_MC_SEQNO', '0', true), 10),
        sleepmax: parseInt(parseEnv('SLEEP_MAX', '0', true), 10),
        sleepmin: parseInt(parseEnv('SLEEP_MIN', '0', true), 10),
        pubapihost: parseEnv('PUBAPI_HOST', '0.0.0.0:8080', false)
    }
}

const enumerateErrorFormat = winston.format((info) => {
    if (info instanceof Error) {
        Object.assign(info, { message: info.stack })
    }
    return info
})

function configureLogger (loglvl: string): winston.Logger {
    const options: winston.LoggerOptions = {
        level: loglvl,
        transports: [
            new winston.transports.Console({ stderrLevels: [ 'error' ] })
        ]
    }

    if (loglvl === 'debug') {
        options.format = winston.format.combine(
            enumerateErrorFormat(),
            winston.format.colorize(),
            winston.format.splat(),
            winston.format.timestamp(),
            winston.format.printf(({ level, message, timestamp }) => (
                `[${level}] [${timestamp}] ${message}`
            ))
        )
    } else {
        options.format = winston.format.combine(
            enumerateErrorFormat(),
            winston.format.timestamp(),
            winston.format.json()
        )
    }

    return winston.createLogger(options)
}

const sleep = async (m: number): Promise<void> => new Promise(
    r => setTimeout(r, m)
)

export { sleep, parseConfig, configureLogger, IConfig }
