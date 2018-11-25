const { Client, Pool } = require('pg')
const { PostgresJSONBinder } = require('../node-postgres-json-sync')


const connectParams = {
  user: 'nickm',
  host: 'localhost',
  database: 'test_db',
  password: 'memory',
  port: '5432'
}


const queryParams = {
  'table': 'test_table',
  'fieldName': 'data',
  'rowId': 1
}

const testData = {key: 'value'}

// const pool
const pool = new Pool(connectParams)

async function run() {
  binder = new PostgresJSONBinder(pool)
  binding = await binder.initBinding(queryParams)
  obj = binding.obj
  console.log(obj)
  obj.key = 'changed'
  // binding.on('')
  // let response = await pool.query(`select data from ${queryParams.table} where id = ${queryParams.rowId}`)
  // data = response.rows[0][queryParams.fieldName]
  // console.log(data)
}

run()

