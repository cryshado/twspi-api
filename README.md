## ton whales staking pool api

### simple setup

1. create `.env` file based on `.env.example`
2. create `pools.json` based on `pools.example.json`
3. start postgres database `make dc_run_db`
4. fill pools into database `make npx_addpools`
5. start indexer service `make dc_run_scansr`
6. start public api service `make dc_run_pubapi`
7. done

for the production environment, see:
- [Makefile](./Makefile)
- [./docker](./.docker/)
- [./compose.yml](./compose.yml)

### methods

**wallet**
`GET /<wallet_address>`
```json
{
  "status": "ok",
  "data": {
    "balance": "141000000000",
    "totalEarnings": "0",
    "poolinfo": [
      {
        "pool": "EQCkR1cGmnsE45N4K0otPl5EnxnRakmGqeJUNua5fkWhales",
        "deposits": "141000000000",
        "withdrawals": "0"
      }
    ]
  }
}
```

### license
MIT
