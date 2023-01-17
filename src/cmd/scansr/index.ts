import { Address, fromNano } from 'ton'
import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime'
import { GetBlockResult, Maybe, Pool, TXExt } from '../../types'

import {
    isDeposit, isWithdraw, createUser,
    getpools, bn, lsblk, accps, bndec
} from './utils'

import {
    logger, config,
    prisma, client, ACCOUNT_WC, sleep
} from '../../context'

interface ExtPool extends Pool { hash: string }

interface IProcessOptions {
    dbtx: Prisma.TransactionClient,
    pools: ExtPool[],
    seqno: number,
    txsps: GetBlockResult
}

interface IUpsert {
    field: 'deposits' | 'withdrawals',
    value: Decimal,
    userId: number,
    poolId: number,
}

async function updateOrInsert (dbtx: Prisma.TransactionClient, opt: IUpsert) {
    const field = Prisma.raw(opt.field)
    return dbtx.$executeRaw`
        WITH _ AS (
            UPDATE earns SET ${field} = earns.${field} + ${opt.value}
            WHERE user_id = ${opt.userId} AND pool_id = ${opt.poolId}
            returning *
        )
        INSERT INTO earns (user_id, pool_id, ${field})
        SELECT ${opt.userId}, ${opt.poolId}, ${opt.value}
        WHERE NOT EXISTS (
            SELECT 1 FROM earns
            WHERE user_id = ${opt.userId} AND pool_id = ${opt.poolId}
        );
    `
}

async function process (options: IProcessOptions): Promise<void> {
    const { dbtx, pools, seqno, txsps } = options

    const mappedtxs = txsps.shards.flatMap(s => s.transactions)
    const filtred = await mappedtxs.reduce(async (f, tx) => {
        for (let i = 0; i < pools.length; i++) {
            const pool = pools[i]
            const account = accps(tx.account)

            if (account.hash.equals(pool.account)) {
                const txext = (await client.getAccountTransactions(
                    account,
                    bn(tx.lt),
                    Buffer.from(tx.hash, 'base64')
                ))[0]

                if (!txext.tx.inMessage) continue
                if (txext.tx.inMessage.info.type !== 'internal') continue

                const from = txext.tx.inMessage.info.src

                Promise.all([ f ]).then(fw => fw[0].push(
                    { from, pool, txext }
                ))
            }
        }

        return f
    }, Promise.resolve([] as {
        from: Address, pool: ExtPool, txext: TXExt
    }[]))

    for (let i = 0; i < filtred.length; i++) {
        const data = filtred[i]

        let deposit: Maybe<bigint>
        let withdraw: Maybe<bigint>

        try {
            deposit = isDeposit(data.txext)
            withdraw = isWithdraw(data.txext)
        } catch (_) {
            continue
        }

        if (deposit) {
            logger.info(`#${seqno} deposit for ${fromNano(deposit)} ton`)

            const user = await createUser(dbtx, data.from.hash)
            await updateOrInsert(dbtx, {
                field: 'deposits',
                value: bndec(deposit),
                userId: user.id,
                poolId: data.pool.id
            })
        }

        if (withdraw) {
            logger.info(`#${seqno} withdraw for ${fromNano(withdraw)} ton`)

            const user = await createUser(dbtx, data.from.hash)
            await updateOrInsert(dbtx, {
                field: 'withdrawals',
                value: bndec(withdraw),
                userId: user.id,
                poolId: data.pool.id
            })
        }
    }

    await dbtx.blocks.create({ data: { seqno } })
}

async function entry () {
    logger.info('starting scansr service ...')

    const dbpools = await getpools()
    const pools: ExtPool[] = []

    dbpools.forEach((p, i) => {
        const addr = `${ACCOUNT_WC}:${p.account.toString('hex')}`
        logger.info(`#${i} know about ${Address.parseRaw(addr).toString()}`)

        pools.push({ hash: accps(addr).hash.toString('hex'), ...p })
    })

    const dbblk = await prisma.blocks.findMany(
        { orderBy: { seqno: 'asc' }, take: -1 }
    )

    let lastblk = await lsblk()
    let mcseqno = dbblk[0] ? (dbblk[0].seqno + 1) : config.startmc
    if (mcseqno === 0) mcseqno = lastblk

    while (true) {
        let mcblock: GetBlockResult

        try {
            mcblock = await client.getBlock(mcseqno)
        } catch (error) {
            const e = String(error).toLowerCase()
            logger.info(`#${mcseqno} (sleep for ${config.sleepmax}ms): ${e}`)

            await sleep(config.sleepmax)
            continue
        }

        const master = mcblock.shards.filter(s => s.workchain === -1)[0]
        const txsps = { shards: mcblock.shards.filter(s => s.workchain === 0) }

        try {
            await prisma.$transaction(async (dbtx) => {
                await process({ dbtx, pools, seqno: master.seqno, txsps })
            })
        } catch (error) {
            logger.error(`error while execution dbtx: ${error}`)
            console.error(error)
            await sleep(config.sleepmax)
            continue
        }

        lastblk = await lsblk()
        const wait = lastblk - mcseqno > 0 ? config.sleepmin : config.sleepmax

        logger.info(`#${mcseqno} (sleep for ${wait}ms): processed`)
        await sleep(wait)

        mcseqno += 1
    }
}

async function main () {
    while (true) {
        try {
            await entry()
        } catch (error) {
            logger.error(error)
            await sleep(1000)
        }
    }
}

main()
