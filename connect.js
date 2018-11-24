const fs = require('fs')
const ObservableSlim = require('observable-slim')
const { Client, Pool } = require('pg')
const { promisify } = require('util')
const EventEmitter = require('events');


const readFile = promisify(fs.readFile)


/*
TODO
  event listeners
  tests
  Update behaviour:
    overwriting union with existing object
*/


connections = []  // Unique list of connection params and their corresponding pools

function PostgresJSONBinder(connectParams, tableName, rowId, fieldName, 
                            idFieldName='id') {
  // Creates an object which, when changed, triggers an update in the corresponding database field. Conversely, changes in the corresponding database field trigger an update in the object.

  // this.obj = obj  // The client side object to map to a postgres JSON field
  this.connectParams = connectParams
  this.connection = this.getOrCreateConnection(connectParams)
  this.databaseName = this.connection.params.database
  this.pool = this.connection.pool
  this.idFieldName = idFieldName  // The name of unique id field of the database table from which to get the JSON object
  this.tableName = tableName  // The name of the database table in which the corresponding JSON field is to be found
  this.rowId = rowId  // The id of the row from which to get the JSON object
  this.fieldName = fieldName  // The name of the field / column in the database table which contains the JSON field

  this.PGNofityFuncName = `PostgresJSONBinder_${this.databaseName}${this.fieldName}${this.idFieldName}${this.rowId}_Notify`
  this.PGTriggerName = `PostgresJSONBinder_${this.databaseName}${this.fieldName}${this.idFieldName}${this.rowId}_Trigger`
  this.PGChannelName = `PostgresJSONBinder_${this.databaseName}${this.fieldName}${this.idFieldName}${this.rowId}_Channel`

  console.log(this.PGChannelName)
}


PostgresJSONBinder.prototype.init = async function() {
  // Init the client side data mapping
  let err
  fieldData = await this.getObjectFromDatabase()  // Get corresponding JSON data
  this.createPostgresNotifyFunction()
  this.listenForDatabaseChanges()
  proxy = this.createProxy(fieldData)  // Set up listeners for changes to the object
  this.obj = proxy // Assign data to our base client side representation
  return this.obj
}


PostgresJSONBinder.prototype.getOrCreateConnection = function (connectParams) {
  let connection = null
  // Find connection if it exists
  connections.forEach(function(item) {
    if (connectParams == item.params) {
      connection = item
    }
  })
  // Else create and add to stack
  if (!connection) {
    const pool = new Pool(connectParams)
    connection = {'params': connectParams, 'pool': pool}
    connections.push(connection)
  }
  return connection
}


PostgresJSONBinder.prototype.createProxy = function(objToWatch, callbacks) {
  let ref = this
  // This is how we listen for changes in the client side object
  let proxy = ObservableSlim.create(objToWatch, false, function(changes) {
    // Client side object has changed
    // console.log(obj, changes)
    ref.updateDatabase(obj, changes)
  })
  return proxy
}


PostgresJSONBinder.prototype.getObjectFromDatabase = async function() {
  // Get the object from the corresponding postgres JSON field
  let fieldData;
  let q = `select ${this.fieldName} from ${this.tableName} where ${this.idFieldName} = ${this.rowId};`
  const client = await this.pool.connect()
  let response = await client.query(q)
  fieldData = response.rows[0][this.fieldName]
  return fieldData
}


PostgresJSONBinder.prototype.createPostgresNotifyFunction = async function() {
  // Create SQL statement from template
  let ref = this
  const replaceVars = {
    'SCHEMANAME': this.databaseName, // ?
    'FUNCNAME': this.PGNofityFuncName,
    'TRIGGERNAME': this.PGTriggerName,
    'CHANNELNAME': this.PGChannelName,
    'FIELDNAME': this.fieldName,
    'ROWID': this.rowId,
    'IDFIELD': this.idFieldName
  }
  let template = await readFile('trigger_template.sql', 'utf8')
  Object.keys(replaceVars).forEach(function(key) {
    let re = new RegExp(key, 'g')
    template = template.replace(re, replaceVars[key])
  })
  let sql = template
  // // Run the SQL
  try {
    const client = await this.pool.connect()
    client.query(sql)
  } catch (err) {
    console.log(err)
  }
}


PostgresJSONBinder.prototype.listenForDatabaseChanges = async function() {
  // Listen
  const ref = this
  const client = await this.pool.connect()
  await client.query(`LISTEN "${this.PGChannelName}"`)
  client.on('notification', function(data) {
    // Database field changed. Check if it's different to what we have in state.
    console.log('nofitication')
    let newData = JSON.parse(data.payload)[ref.fieldName]
    // Update the object
    ref.obj = ref.createProxy(newData)
    console.log('new obj:', ref.obj)
  })
}


PostgresJSONBinder.prototype.updateDatabase =  async function(obj, changes) {
  // Our object has changed on the client side, so update the corresponding database field with the new data
  let newData = changes[0].target
  let newJSON = JSON.stringify(newData)
  q = `update ${this.tableName} set ${this.fieldName} = '${newJSON}' where ${this.idFieldName} = ${this.rowId} returning ${this.fieldName};`
  let client = await this.pool.connect()
  let response = await client.query(q);
  let updated = response.rows[0][this.fieldName]  // Get new data from database field. Should be the same as the newData we updated it with, but maybe if it got changed during the window by another agent, it could be different. In any case this ensures we're in sync.
  proxy = this.createProxy(updated)  // Set up our listeners on the new object
  this.obj = proxy  // Finally update our base client side object
}


PostgresJSONBinder.prototype.close = function() {
  // TODO drop if exists notify/trigger functions
  this.pool.end()
}


async function initPostgresJSONObject(connectParams, tableName, rowId, fieldName) {
  binder = new PostgresJSONBinder(connectParams, tableName, rowId, fieldName)
  obj = await binder.init()
  return obj
}


async function test() {

  connectParams = {
    user: 'nickm',
    host: 'localhost',
    database: 'test',
    password: 'memory',
    port: '5432'
  }

  // queryParams = {
  //   'table': 'test',
  //   'fieldName': 'data',
  //   'rowId': 1,
  // }

  obj = await initPostgresJSONObject(connectParams, 'test', 1, 'data')

  console.log(obj)
  // Changing a child object value
  obj.key = 'changed'
  console.log(obj)
  obj.key = 'changed again'
  console.log(obj)
  // obj.key = 'changed back'
  // console.log(obj)

}

test()

