/* eslint-disable max-len */
import { client, prisma } from './context'

export type Maybe<T> = NonNullable<T> | undefined
export type Unarr<T> = T extends (infer U)[] ? U : T
export type GetBlockResult = Awaited<ReturnType<typeof client.getBlock>>
export type Pool = Unarr<Awaited<ReturnType<typeof prisma.pools.findMany>>>
export type TXExt = Unarr<Awaited<ReturnType<typeof client.getAccountTransactions>>>
