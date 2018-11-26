# node-postgres-json-sync

Realtime bidirectional bindings between JS objects and postgres JSON fields.

- When client side object changes, update the corresponding database field,
- When data in the corresponding database field changes, update the client side object.

## Motivation

Services such as firebase and socket.io provide convenient two-way bindings with a storage instance. They keep client side data in sync with the database. 

This is convenient when creating any CRUD-like application, which can involve a lot of middleman logic between the client state and the database, especially when realtime updates are desired.

I wanted to use postgres for my backend, and to host it locally, and couldn't find a library / service that provides sync-like bindings between a javascript object and a postgres JSON field, so I created this project.

## Example

Assuming I have a postgres table and data set up like:

```sql
CREATE TABLE my_table (
    id serial PRIMARY KEY NOT NULL,
    my_data_field jsonb
);

INSERT INTO my_table (my_data_field) values ('{"key": "value"}');
```

Then with NodeJS I can instantiate an object that represents that data field:

```js

const { Pool } = require('pg')  // Require the node-postgres module
const { PostgresJSONBinder } = require('../node-postgres-json-sync')

const connectParams = {  // Connection parameters for node-postgres
  user: 'postgres_user',
  host: 'localhost',
  database: 'test_db',
  password: 'postgres_password',
  port: '5432'
}

const queryParams = {  // How to find our JSON object in the database
  'table': 'my_table',
  'fieldName': 'my_data_field',
  'rowId': 1
}

const pool = new Pool(connectParams)

let binder = PostgresJSONBinder(pool)

// Using async-await
let binding = await binder.initBinding(queryParams)
binding.obj  // {'key': 'value'}
```

Changing the object...

```js
binding.obj.key = 'changed';
```

 Triggers an update in the corresponding database field:

```sql
SELECT my_data_field FROM my_table WHERE id = 1;

-- id |          data           
---------------------------
--  1 | {"key": "changed"}
```

Changes to the database will trigger an update on our object:

```sql
UPDATE my_table set my_data_field = '{"key": "changed again"}';
```

```js
console.log(obj)
// { 'key': 'changed again' }
```

We can listen for changes like:

```js
binder.on('change', function(type) {
    // type is 'clientside' or 'database', according to the origin of the change
})
```

## Requirements

Uses [node-postgres](https://github.com/brianc/node-postgres) and [ObservableSlim](https://github.com/ElliotNB/observable-slim) packages. These can be installed with npm install.

You'll need a postgres instance to connect to.

## Contributions and improvements

- Events could be handled better
- Optimisation. Connections / pools could probably be handled better
- Could adapt for use with postgres-rest
- Tests
- A better name potentially
