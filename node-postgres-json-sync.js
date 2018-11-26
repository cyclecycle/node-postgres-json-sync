const util = require('util')
const fs = require('fs')
const { promisify } = require('util')
const readFile = promisify(fs.readFile)
const ObservableSlim = require('observable-slim')
const EventEmitter = require('events').EventEmitter


/*
TODO
  tests
  event listeners
  Update behaviour:
    overwriting union with existing object
*/


module.exports = { PostgresJSONBinder }


function PostgresJSONBinder(pool) {
  //  Container for all the bindings associated with a single database connection / pool object
  this.pool = pool
  this.bindings = []
}


PostgresJSONBinder.prototype.close = function() {
  // TODO drop if exists notify/trigger functions
  this.pool.end()
}


PostgresJSONBinder.prototype.initBinding = async function(queryParams) {
  let binding
  try {
    binding = new PostgresJSONBinding(this.pool, queryParams)
    util.inherits(PostgresJSONBinding, EventEmitter)
    await binding.init()
    binding.binder = this
    this.bindings.push(binding)
  } catch (err) {
    // throw err
    console.log(err)
  }
  return binding
}



function PostgresJSONBinding(pool, queryParams) {
  // Creates an object which, when changed, triggers an update in the corresponding database field. Conversely, changes in the corresponding database field trigger an update in the object.

  this.binder = null
  this.pool = pool
  this.databaseName = pool.options.database
  if (queryParams.idFieldName === undefined) {
    this.idFieldName = 'id'
  } else {
    this.idFieldName = queryParams.idFieldName // The name of unique id field of the database table from which to get the JSON object
  }
  this.table = queryParams.table  // The name of the database table in which the corresponding JSON field is to be found
  this.rowId = queryParams.rowId  // The id of the row from which to get the JSON object
  this.fieldName = queryParams.fieldName  // The name of the field / column in the database table which contains the JSON field

  this.PGNofityFuncName = `PostgresJSONBinder_${this.databaseName}${this.fieldName}${this.idFieldName}${this.rowId}_Notify`
  this.PGTriggerName = `PostgresJSONBinder_${this.databaseName}${this.fieldName}${this.idFieldName}${this.rowId}_Trigger`
  this.PGChannelName = `PostgresJSONBinder_${this.databaseName}${this.fieldName}${this.idFieldName}${this.rowId}_Channel`
}


PostgresJSONBinding.prototype.init = async function() {
  // Init the client side data mapping
  try {
    let fieldData = await this.getObjectFromDatabase()  // Get corresponding JSON data
    this.createPostgresNotifyFunction()
    this.listenForDatabaseChanges()
    proxy = this.createProxy(fieldData)  // Set up listeners for changes to the object
    this.obj = proxy // Assign data to our base client side representation
    return this.obj
  } catch (err) {
    console.log(err)
  }
}


PostgresJSONBinding.prototype.getObjectFromDatabase = async function() {
  // Get the object from the corresponding postgres JSON field
  let fieldData;
  let q = `SELECT ${this.fieldName} FROM ${this.table} WHERE ${this.idFieldName} = ${this.rowId};`
  try {
    let response = await this.pool.query(q)
    fieldData = response.rows[0][this.fieldName]
    return fieldData
  } catch (err) {
    throw {
      msg: `Failed to get corresponding object from database with query: "${q}"`,
      code: 'OBJECT_QUERY_FAILED',
      node_postgres_error: err
    }
  }
}


PostgresJSONBinding.prototype.createProxy = function(objToWatch, callbacks) {
  let ref = this
  // This is how we listen for changes in the client side object
  let proxy = ObservableSlim.create(objToWatch, false, async function(changes) {
    // Client side object has changed
    await ref.updateDatabase(obj, changes)
    ref.emit('change', 'clientside')
  })
  return proxy
}


PostgresJSONBinding.prototype.createPostgresNotifyFunction = async function() {
  // Create SQL statement from template
  let ref = this
  const replaceVars = {
    'TABLENAME': this.table,
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
  // console.log(sql)
  try {
    this.pool.query(sql)
  } catch (err) {
    // console.log(err)
  }
}


PostgresJSONBinding.prototype.listenForDatabaseChanges = async function() {
  // Listen
  const ref = this
  const client = await this.pool.connect()
  await client.query(`LISTEN "${this.PGChannelName}"`)
  client.on('notification', async function(data) {
    // Database field changed
    let newData = JSON.parse(data.payload)[ref.fieldName]
    if (JSON.stringify(newData) !== JSON.stringify(ref.obj)) {
      // Update the object
      ref.obj = await ref.createProxy(newData)
      ref.emit('change', 'database')
    }
  })
}


PostgresJSONBinding.prototype.updateDatabase =  async function(obj, changes) {
  // Our object has changed on the client side, so update the corresponding database field with the new data
  let newData = changes[0].target
  let newJSON = JSON.stringify(newData)
  q = `update ${this.table} set ${this.fieldName} = '${newJSON}' where ${this.idFieldName} = ${this.rowId} returning ${this.fieldName};`
  let response
  try {
    response = await this.pool.query(q);
    let updated = response.rows[0][this.fieldName]  // Get new data from database field. Should be the same as the newData we updated it with, but maybe if it got changed during the window by another agent, it could be different. In any case this ensures we're in sync.
    // console.log(updated)
    proxy = this.createProxy(updated)  // Set up our listeners on the new object
    this.obj = proxy  // Finally update our base client side object
  } catch (err) {
    throw {
      msg: `Failed to update database with query: "${q}"`,
      code: 'UPDATE_QUERY_FAILED',
      node_postgres_error: err
    }
  }
}


PostgresJSONBinding.prototype.close = function() {
  // TODO drop if exists notify/trigger functions
  this.pool.end()
}




// PostgresJSONBinding.prototype.getOrCreateConnection = function (connectParams) {
//   let connection = null
//   // Find connection if it exists
//   PGConnections.forEach(function(item) {
//     if (connectParams == item.params) {
//       connection = item
//     }
//   })
//   // Else create and add to stack
//   if (!connection) {
//     const pool = new Pool(connectParams)
//     connection = {'params': connectParams, 'pool': pool}
//     PGConnections.push(connection)
//   }
//   return connection
// }
