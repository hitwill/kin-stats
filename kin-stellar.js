//https://www.stellar.org/developers/js-stellar-sdk/reference/
//https://github.com/stellar/js-stellar-sdk/tree/master/docs/reference
var StellarSdk = require('stellar-sdk');
var mysql = require('promise-mysql');
var SqlString = require('sqlstring');

const Bottleneck = require("bottleneck");
const limiter = new Bottleneck({
  maxConcurrent: 1,// Never more than x request running at a time.
  minTime: 100, // Wait at least x ms between each request.
  expiration: 3000
});
limiter.on('error', function (error) {
  console.log('limiter error', error);
});
const dbThrottled = limiter.wrap(insertOrupdate);//throttle the database
const CONNECTION_PARAMS = {
  host: '92.222.155.51',
  user: 'kinmetrics',
  password: 'k!nm3Tric$',
  database: 'kin'
};

var server = new StellarSdk.Server('https://horizon-kin-ecosystem.kininfrastructure.com');
StellarSdk.Network.usePublicNetwork();
var operations;

start();
async function start() {
  fetchOperations();//fetch latest unsaved operations from kin-stellar

}
async function deleteLastCursorID(cursor, operationTypes) {
  //in case of a crash, delete last cursor id used, so it can be refreshed in full
  var deletePromise = [];
  var connection = await (mysql.createConnection(CONNECTION_PARAMS));
  for (let key in operationTypes) {
    deletePromise.push(connection.query('DELETE FROM ' + operationTypes[key] + ' WHERE cursor_id = ' + cursor));
  }
  await Promise.all(deletePromise);
  connection.end();
  return (true);
}

async function fetchCursor(type) {
  //fetch the cursor for the most recently fetched record
  var cursor = '0';
  var connection = await (mysql.createConnection(CONNECTION_PARAMS));
  var result = await connection.query('SELECT cursor_id FROM pagination WHERE cursor_type = ' + SqlString.escape(type));
  connection.end();
  if (result.length > 0) {
    cursor = result[0].cursor_id;
  }
  return (cursor);
}

async function insertOrupdate(query) {
  var connection = await (mysql.createConnection(CONNECTION_PARAMS));
  await connection.query(query);
  connection.end();
}

function updateCursorQuery(cursor, type) {
  //caution, we're updating asyncronously, so only save latest cursor id
  var query = 'INSERT INTO pagination SET cursor_id = ' +
    SqlString.escape(cursor) + ', cursor_type =  ' + SqlString.escape(type) +
    ' ON DUPLICATE KEY UPDATE cursor_id = IF(' + cursor + ' > cursor_id, ' +
    SqlString.escape(cursor) + ', cursor_id)';
  return (query);
}

async function fetchOperations() {
  var operationTypes = ['payment', 'create_account'];//only interested in these
  var cursor = await fetchCursor('operations');
  await deleteLastCursorID(cursor, operationTypes);
  operations = server.operations()
    .cursor(cursor)
    .stream({
      onmessage: function (message) {
        if (operationTypes.indexOf(message.type) !== -1) parseOperation(message);
      }
    });
}

async function parseOperation(operation) {
  var record = {};
  record.cursor = operation.id;
  record.time = parseDate(operation.created_at);
  record.table = operation.type;//this is the table where we save it
  if (operation.type === 'create_account') {
    record.fields = {
      quantity: 1,
      cursor_id: record.cursor
    };
  }
  if (operation.type === 'payment') {
    if (operation.asset_code !== 'KIN') return (false);//not interested
    if (operation.amount > 10000) return (false);//unlikely a user spend
    record.fields =
      {
        quantity: 1,
        volume: operation.amount,
        cursor_id: record.cursor
      };
  }
  saveData(record, 'operations');
}

async function saveData(record, cursorType) {
  var fields;
  var fieldString = [];
  var keyString = [
    'hour = ' + record.time.hour,
    'day = ' + record.time.day,
    'year = ' + record.time.year,
  ].join(',');
  var cursorSql = updateCursorQuery(record.cursor, cursorType);
  var QuerySql = 'INSERT INTO ' + record.table + ' SET ';
  for (let key in record.fields) {
    fieldString.push(key + ' = ' + key + ' + ' + record.fields[key]);
  }
  fields = fieldString.join(',');
  QuerySql = QuerySql + keyString + ', ' + fields;
  QuerySql = QuerySql + ' ON DUPLICATE KEY UPDATE ' + fields;
  dbThrottled(cursorSql);//update but don't overwhelm the database
  dbThrottled(QuerySql);
}

function daysIntoYear(date) {
  return (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 24 / 60 / 60 / 1000;
}

function parseDate(dateString) {
  var parsedTime = {};
  parsed = new Date(dateString);
  parsedTime.year = parsed.getFullYear();
  parsedTime.day = daysIntoYear(parsed);
  parsedTime.hour = parsed.getHours();
  return (parsedTime);
}

function reveal(obj, stop) {
  if (typeof stop === 'undefined') stop = true;
  //TODO; delete this function after testing is complete
  console.log(JSON.stringify(obj, null, 2));
  if (stop) process.exit();
}

//Error handlers
process.on('unhandledRejection', (err) => {
  console.log(err);
  reveal(err);
});
process.on('uncaughtException', (err) => {
  console.log(err);
  reveal(err);
});
