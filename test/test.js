const { Pool } = require('pg')
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
  binding.on('change', function(type) {
    console.log('change type', type, obj)
  })
  obj = binding.obj

  // Change on client side
  obj.key = 'changed'

  let response
  response = await pool.query(`select data from ${queryParams.table} where id = ${queryParams.rowId}`)
  data = response.rows[0][queryParams.fieldName]

  // Change on server side
  newData = {key: 'changed again'}
  newJSON = JSON.stringify(newData)
  response = await pool.query(`update ${queryParams.table} set ${queryParams.fieldName} = '${newJSON}' where id = ${queryParams.rowId}`)
  // console.log(obj)

  obj.key = 'changed back'
  
}

run()

