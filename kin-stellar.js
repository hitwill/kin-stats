//https://www.stellar.org/developers/js-stellar-sdk/reference/
//https://github.com/stellar/js-stellar-sdk/tree/master/docs/reference
const StellarSdk = require('stellar-sdk');
const mysql = require('promise-mysql');
const SqlString = require('sqlstring');
const CoinMarketCap = require("node-coinmarketcap");
const coinmarketcap = new CoinMarketCap({ events: true });
const Bottleneck = require("bottleneck");
const limiter = new Bottleneck({
    maxConcurrent: 1,// Never more than x request running at a time.
    minTime: 100, // Wait at least x ms between each request.
    expiration: 3000
});
limiter.on('error', function (error) {
    console.log('limiter error', error);
});
const dbThrottled = limiter.wrap(insertOrUpdate);//throttle the database
const CONNECTION_PARAMS = {
    host: '92.222.155.51',
    user: 'kinmetrics',
    password: 'k!nm3Tric$',
    database: 'kin'
};

const server = new StellarSdk.Server('https://horizon-kin-ecosystem.kininfrastructure.com');
StellarSdk.Network.usePublicNetwork();
let operations;

async function updateCoinStats() {
    let capSql;
    let priceSql;
    let kinMarketCap;
    let kinPrice;
    let btcMarketCap;
    coinmarketcap.on("KIN", (coin) => {
        kinMarketCap = SqlString.escape(coin.market_cap_usd);
        kinPrice = SqlString.escape(coin.price_usd);
        capSql = 'INSERT INTO key_value SET id = \'KIN_marketcap\', data = ' +
            kinMarketCap + ' ON DUPLICATE KEY UPDATE data = ' + kinMarketCap;
        priceSql = 'INSERT INTO key_value SET id = \'KIN_price\', data = ' +
            kinPrice + ' ON DUPLICATE KEY UPDATE data = ' + kinPrice;
        dbThrottled(priceSql);
        dbThrottled(capSql);
    });
    coinmarketcap.on("BTC", (coin) => {
        btcMarketCap = SqlString.escape(coin.market_cap_usd);
        capSql = 'INSERT INTO key_value SET id = \'BTC_marketcap\', data = ' +
            btcMarketCap + ' ON DUPLICATE KEY UPDATE data = ' + btcMarketCap;
        dbThrottled(capSql);
    });
}

start();

async function start() {
    fetchOperations();//fetch latest unsaved operations from kin-stellar
    updateCoinStats();
}

async function deleteLastCursorID(cursor, operationTypes) {
    //in case of a crash, delete last cursor id used, so it can be refreshed in full
    const deletePromise = [];
    const connection = await (mysql.createConnection(CONNECTION_PARAMS));
    for (let key in operationTypes) {
        deletePromise.push(connection.query('DELETE FROM ' + operationTypes[key] + ' WHERE cursor_id = ' + cursor));
    }
    await Promise.all(deletePromise);
    connection.end();
    return (true);
}

async function fetchCursor(type) {
    //fetch the cursor for the most recently fetched record
    let cursor = '0';
    const connection = await (mysql.createConnection(CONNECTION_PARAMS));
    const result = await connection.query('SELECT cursor_id FROM pagination WHERE cursor_type = ' + SqlString.escape(type));
    connection.end();
    if (result.length > 0) {
        cursor = result[0].cursor_id;
    }
    return (cursor);
}

async function insertOrUpdate(query) {
    const connection = await (mysql.createConnection(CONNECTION_PARAMS));
    await connection.query(query);
    connection.end();
}

function updateCursorQuery(cursor, type) {
    //caution, we're updating asynchronously, so only save latest cursor id
    const query = 'INSERT INTO pagination SET cursor_id = ' +
        SqlString.escape(cursor) + ', cursor_type =  ' + SqlString.escape(type) +
        ' ON DUPLICATE KEY UPDATE cursor_id = IF(' + cursor + ' > cursor_id, ' +
        SqlString.escape(cursor) + ', cursor_id)';
    return (query);
}

async function fetchOperations() {
    const operationTypes = ['payment', 'create_account'];//only interested in these
    const cursor = await fetchCursor('operations');
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
    const record = {};
    record.cursor = operation.id;
    record.time = parseDate(operation.created_at);
    record.table = operation.type;//this is the table where we save it
    if (operation.type === 'create_account') {
        record.fields = {
            quantity: 1
        };
    }
    if (operation.type === 'payment') {
        if (operation.asset_code !== 'KIN') return (false);//not interested
        if (operation.amount > 10000) return (false);//unlikely a user spend
        record.account_id_from = operation.from;//either Kin foudnation is paying to ME or i'm paying to SOMEONE
        record.account_id_to = operation.to;//either Kin foudnation is paying to ME or i'm paying to SOMEONE
        record.fields =
            {
                quantity: 1,
                volume: operation.amount
            };
    }
    return saveData(record, 'operations');
}

async function saveData(record, cursorType) {
    let fields;
    let fieldString = [];
    const keyString = [
        'hour = ' + record.time.hour,
        'day = ' + record.time.day,
        'year = ' + record.time.year,
    ].join(',');
    const cursorSql = updateCursorQuery(record.cursor, cursorType);
    let QuerySql = 'INSERT INTO ' + record.table + ' SET ';
    fieldString.push('cursor_id = ' + SqlString.escape(record.cursor));
    if (typeof record.account_id_from !== 'undefined') { //for payments
        fieldString.push('account_id_from = ' + SqlString.escape(record.account_id_from));
        fieldString.push('account_id_to = ' + SqlString.escape(record.account_id_to));
    }
    for (let key in record.fields) { // these are incremental fields
        fieldString.push(`${key} = ${key} + ${record.fields[key]}`);
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
    const parsedTime = {};
    let parsed = new Date(dateString);
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
