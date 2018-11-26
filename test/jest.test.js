const { Client, Pool } = require('pg')
const { PostgresJSONBinder, initPostgresJSONObject } = require('../node-postgres-json-sync')


const connectParams = {
  user: 'nickm',
  host: 'localhost',
  database: 'test_db',
  password: 'memory',
  port: '5432'
}


// const pool = new Pool(connectParams)

// const pool
// const pool = new Pool(connectParams)

// pool.on('error', function(err) {
//   console.log(err)
// })


// beforeAll(function() {
//   return function(){
//   }
// })


async function setUpDB() {
  const pool = new Pool(connectParams)
  try {
    await tearDownDBTable()
  } catch (err) {

  console.log('creating table')
  }
  try {
    let response = await pool.query(`CREATE TABLE ${queryParams.table} (id serial PRIMARY KEY NOT NULL, ${queryParams.fieldName} jsonb);`)
    // console.log(response)
  } catch (err) {
    // console.log(err)
  }
}


async function insertData(data, queryParams) {
  const pool = new Pool(connectParams)
  console.log('inserting data')
  try {
    const testJSON = JSON.stringify(testData)
    let response = await pool.query(`INSERT INTO ${queryParams.table}(${queryParams.fieldName}) values('${testJSON}');`)
  } catch (err) {
    console.log(err)
  }
}


async function tearDownDBTable() {
  const pool = new Pool(connectParams)
  console.log('tearing down table')
  try {
    let response = await pool.query(`DROP TABLE IF EXISTS ${queryParams.table};`)
  } catch (err) {
    console.log(err)
  }
}


// async function tearDown() {
//   binder.close()
// }


test('init fails if corresponding object not found / valid', async function() {
  const pool = new Pool(connectParams)
  binder = new PostgresJSONBinder(pool)
  const badQueryParams = {
    'table': 'test_table',
    'fieldName': 'nonexistant_field',
    'rowId': 1,
  }
  try {
    binding = await binder.initBinding(queryParams)
  } catch (err) {
    expect(err.code).toMatch('OBJECT_QUERY_FAILED')
  }
})


describe('two-way sync works', async function () {

  beforeAll(async function() {
    await setUpDB()
    await insertData()
  })

  // afterAll(async function() {
  //   // await tearDownDBTable()
  //   // await tearDown()
  // })

  test('init successful', async function() {
    const pool = new Pool(connectParams)
    try {
      binder = new PostgresJSONBinder(pool)
      binding = await binder.initBinding(queryParams)
      obj = binding.obj
      expect(obj).toEqual(testData)
      // pool.end()
    } catch (err) {
      console.log(err)
    }
  })

  test('object change causes database update', async function() {
    const pool = new Pool(connectParams)
    try {
      binder = new PostgresJSONBinder(pool)
      binding = await binder.initBinding(queryParams)
      obj = binding.obj
      obj.key = 'changed'
      let response = await pool.query(`select data from ${queryParams.table} where id = ${queryParams.rowId}`)
      // console.log(response)
      data = response.rows[0][queryParams.fieldName]
      expect(data).toEqual(obj)
    } catch (err) {
      console.log(err)
    }
  })


  // test('database change causes object update', async function() {
  //   newData = {key: 'changed again'}
  //   newJSON = JSON.stringify(newData)
  //   response = await pool.query(`update ${queryParams.table} set data = '${newJSON}';`
  //   expect(obj).toEqual(newData)
  // })
})




