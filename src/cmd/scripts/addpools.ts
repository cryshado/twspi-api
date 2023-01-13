import { Address } from 'ton'
import * as fs from 'fs'
import { logger, prisma } from '../../context'

interface IPools {
    pools: string[]
}

async function main () {
    const { pools } = <IPools>JSON.parse(fs.readFileSync(
        'pools.json', { encoding: 'utf-8' }
    ))

    pools.forEach((p, i) => console.log(`#${i} ${p}`))
    console.log()

    const accounts = pools.flatMap(a => ({ account: Address.parse(a).hash }))
    const result = await prisma.pools.createMany({ data: accounts })

    logger.info(`${result.count} rows were added`)
}

main()
