import { Prisma, users } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime'
import { Address } from 'ton'
import { client, prisma } from '../../context'

import { Maybe, Pool, TXExt } from '../../types'

// eslint-disable-next-line max-len
const WITHDRAW_COMPLETED_BODY_HASH = Buffer.from('f7b1ab6077945b37370a1550574675180cf87df4cb047c869746812a83667d4c', 'hex')
const ACCEPTED_STR_END = 'accepted'

const accps = (src: string): Address => Address.parse(src)
const getpools = async (): Promise<Pool[]> => prisma.pools.findMany()
const bndec = (value: bigint): Decimal => new Decimal(value.toString(10))
const bn = (value: bigint | boolean | number | string): bigint => BigInt(value)

const lsblk = async (): Promise<number> => (
    await client.getLastBlock()
).last.seqno

const createUser = async (
    dbtx: Prisma.TransactionClient, account: Buffer
): Promise<users> => dbtx.users.upsert({
    where: { account },
    create: { account },
    update: {}
})

function isDeposit (txext: TXExt): Maybe<bigint> {
    const outmsgs = txext.tx.outMessages.values()

    if (txext.tx.inMessage?.info.type !== 'internal') return undefined
    if (outmsgs.length !== 1 || outmsgs[0].info.type !== 'internal') {
        return undefined
    }

    const outbody = outmsgs[0].body.asSlice().loadStringTail()
    if (outbody.slice(-8) !== ACCEPTED_STR_END) return undefined

    return txext.tx.inMessage.info.value.coins
}

function isWithdraw (txext: TXExt): Maybe<bigint> {
    const outmsgs = txext.tx.outMessages.values()

    if (txext.tx.inMessage?.info.type !== 'internal') return undefined
    if (outmsgs.length !== 1 || outmsgs[0].info.type !== 'internal') {
        return undefined
    }

    const outbody = outmsgs[0].body.hash()
    if (!outbody.equals(WITHDRAW_COMPLETED_BODY_HASH)) return undefined

    return outmsgs[0].info.value.coins
}

export { isDeposit, isWithdraw }
export { createUser, getpools, bn, lsblk, accps, bndec }
