import cors from '@fastify/cors'
import { Decimal } from '@prisma/client/runtime'
import { fastify, FastifyRequest, FastifyReply } from 'fastify'
import { Address } from 'ton'
import { ACCOUNT_WC, config, logger, prisma, sleep } from '../../context'

const err = (e: string, c: number) => ({ status: 'error', error: e, code: c })
const okr = (data: object) => ({ status: 'ok', data })

const ERROR_UNEXPECTED = err('internal server error', 500)
const ERROR_INVALID_ADDRESS = err('invalid wallet address', 1000)
const ERROR_NOT_FOUND = err('wallet with this address not found', 1000)

interface IPoolDataOnce {
    pool: string,
    deposits: string,
    withdrawals: string
}

async function handleWalletReq (
    req: FastifyRequest,
    res: FastifyReply
): Promise<FastifyReply> {
    const params = (req.params as { wallet: string })

    let address: Address
    try {
        address = Address.parse(params.wallet)
    } catch (error) {
        return res.status(200).send(ERROR_INVALID_ADDRESS)
    }

    const result = (await prisma.$queryRaw<{
        pool: Buffer, deposits: Decimal, withdrawals: Decimal
    }[]>`
        SELECT  pools.account       as pool,
                earns.deposits      as deposits,
                earns.withdrawals   as withdrawals

        FROM earns INNER JOIN pools ON earns.pool_id = pools.id

        WHERE earns.user_id in (
            SELECT id FROM users
            WHERE account = ${address.hash}
        )
    `)

    if (result.length === 0) return res.status(200).send(ERROR_NOT_FOUND)

    let totalDeposits = 0n
    let totalWithdrawals = 0n
    const poolinfo: IPoolDataOnce[] = []

    result.forEach((data) => {
        const deposits = BigInt(data.deposits.toString())
        const withdrawals = BigInt(data.withdrawals.toString())

        totalDeposits += deposits
        totalWithdrawals += withdrawals

        const poolstr = `${ACCOUNT_WC}:${data.pool.toString('hex')}`
        const pooladdr = Address.parse(poolstr)

        poolinfo.push({
            pool: pooladdr.toString(),
            deposits: deposits.toString(10),
            withdrawals: withdrawals.toString(10)
        })
    })

    return res.status(200).send(okr({
        balance: (totalDeposits - totalWithdrawals).toString(10),
        totalEarnings: totalWithdrawals.toString(10),
        poolinfo
    }))
}

async function main () {
    const app = fastify({ maxParamLength: 500 })

    const corsopts = { origin: '*', allowedHeaders: '*', methods: [ 'GET' ] }
    app.register(cors, corsopts)

    app.setErrorHandler((error, _, reply) => {
        logger.error(`${error.code} ${error.message}\n${error.stack}`)
        reply.status(200).send(ERROR_UNEXPECTED)
    })

    app.get('/', (_, res) => res.send('welcome to twspi-api'))
    app.get('/:wallet', (req, res) => handleWalletReq(req, res))

    const [ host, port ] = config.pubapihost.split(':')
    logger.info(`starting twspi-api pubapi at ${host}:${port}`)
    await app.listen({ host, port: parseInt(port, 10) })
}

main()
