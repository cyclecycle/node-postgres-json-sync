# node-postgres-json-sync

Realtime bidirectional bindings between JS objects and postgres JSON fields, for convenient schemaless data persistence.

## Motivation

Services such as firebase and socket.io provide convenient two-way bindings the storage instance. They keep client side in sync with the database. They do this by updating the database when client side object is changed, and vice versa, while also providing events to allow the user to trigger actions on change to the data.

This is extremely convenient when creating any CRUD-like application, which can involve a lot of middleman logic between the client state and the data persistence model, especially when realtime updates are desired.

However, I wanted to use postgres for my backend, and to host it locally, and couldn't find library / service to allow me to just hook up a two-way binding from javascript object to a postgres json field and have all the syncing _handled_, as much as is reasonable out of the box, while also providing me with familiar _.on()_-type trigger for subscribing to and acting on data changes.

That is the purpose of this project.

## Example

Assuming I have a postgres table and data set up like:

sql```
CREATE TABLE my_table (
    my_data_field jsonb
);

INSERT INTO my_table (my_data_field) values ('{"key": "value"}');
```

Then with NodeJS I can instantiate a representation of that object:

js```

let connectionParams = {}  // Connection parameters as per the node-postgres package
let tableName = 'my_table';
let rowId = 1;
let fieldName = 'my_data_field';

let binder = PostgresJSONBinder(connectionParams, tableName, rowId, fieldName)
binder.init().then(obj) {
    console.log(obj)
}

// Or if we are in async function
let obj = initPostgresJSONObject(connectionParams, tableName, rowId, fieldName)

```

Changing the object triggers an update in the corresponding database field

js```

obj.key = 'changed';

```

sql```
SELECT my_data_field FROM my_table WHERE id = 1;
```

Changes to the database from another source will trigger an update our JS object:

sql```
UPDATE my_table set my_data_field = '{"key": "changed again"}';
```

js```

console.log(obj)
// { key: changed again }

```

We can listen to both or either of these change types:

js```

binder.on('change', function(obj, changes) {
    // Do stuff
})

binder.on('client_side_change', function(obj, changes) {
    // Do stuff
})

binder.on('database_change', function(obj, changes) {
    // Do stuff
})

```

## Requirements

Built on top of the ObservableSlim package and the node-postgres package. These can be installed with npm install.

Of couse you need a postgres instance to connect to.

## Documentation

TODO

## Contributions and improvements

- Optimisation. Connections / pools could probably be handled better.
- Could adapt for use with postgres-rest
- A better name potentially
