//https://www.stellar.org/developers/js-stellar-sdk/reference/
//https://github.com/stellar/js-stellar-sdk/tree/master/docs/reference
reveal('paused');
const StellarSdk = require('stellar-sdk');
const mysql = require('promise-mysql');
const SqlString = require('sqlstring');
const CoinMarketCap = require("node-coinmarketcap");
const coinmarketcap = new CoinMarketCap({ events: true });
const Bottleneck = require("bottleneck");
const request = require('request');
const algebra = require("algebra.js");
const limiter = new Bottleneck({
    maxConcurrent: 1,// Never more than x request running at a time.
    minTime: 100, // Wait at least x ms between each request.
    expiration: 3000
});
limiter.on('error', function (error) {
    console.log('limiter error', error);
});
const dbThrottled = limiter.wrap(insertOrUpdate);//throttle the database
//const connectionParams = url2obj(process.env.DB_CREDENTIALS);
const CONNECTION_PARAMS = {
    host: '92.222.155.51',//connectionParams.hostname,
    user: 'kinmetrics',//connectionParams.user,
    password: 'k!nm3Tric$',//connectionParams.password,
    database: 'kin'//,connectionParams.segments[0]
};


const server = new StellarSdk.Server('https://horizon-kin-ecosystem.kininfrastructure.com');
StellarSdk.Network.usePublicNetwork();

async function test(){
    const connection = await (mysql.createConnection(CONNECTION_PARAMS));
    const result = await connection.query('UPDATE key_value SET data = 0.16 WHERE id = "KIN_price"');
    connection.end();
    reveal(result);
}

let operations;
//test();
start();

function getK(price_0,price_1,nodes_0,nodes_1){
    if(price_1 < price_0) return(false);
    let x1 = new algebra.parse(Math.log(nodes_0)*nodes_0 + 'k-'+price_0);
    let x2 = new algebra.parse(Math.log(nodes_1)*nodes_1 + 'k-'+price_1);
    let eq = new algebra.Equation(x1, x2);
    let sol = eq.solveFor('k');
    let k = sol.numer/sol.denom;
    return(k);
}

async function updateMetacalf(){
    //first get prices and number of users at n = 0 and 1
    //NV_0 = k.n.ln(n) at price 0, nodes 0
    //NV_1 = k.n.ln(n) at price 1, nodes 1
    let sql;
    let forecastedPrice;
    const connection = await (mysql.createConnection(CONNECTION_PARAMS));
    const result = await connection.query('SELECT * FROM metacalf WHERE n < 2 ORDER BY n asc');
    connection.end();
    
    if (!result.length > 0) return(false);//database connection error
    let price_0 = result[0].price;
    let price_1 = result[1].price;
    let nodes_0 = result[0].daily_active_users;
    let nodes_1 = (result[1].daily_active_users < 100 ? 200 : result[1].daily_active_users);
    let nodes = nodes_1*1.5;
    let k = getK(price_0,price_1,nodes_0,nodes_1);
    if(k===false)return(0);
    for (let n = 2; n <= 9; n++) {  //update forecast n > 2 nodes
        forecastedPrice = Number(k*nodes*Math.log(nodes)).toFixed(8);
        if(forecastedPrice < price_1) forecastedPrice = price_1;
        sql = 'UPDATE metacalf SET price = '+forecastedPrice+', daily_active_users = ' + nodes +
            ' WHERE n = ' + n;
        dbThrottled(sql);
        nodes=Math.round(nodes*1.5);
    }
    
}

async function updateSocialStats() {
    let sql;
    request({url:'https://api.coingecko.com/api/v3/coins/kin?localization=false',json:true},
        function (error, response, coin) {
            if (!error && response.statusCode == 200) {
                sql = coinStatsURL('KIN_marketcap_rank',coin.market_cap_rank);
                dbThrottled(sql);
                sql = coinStatsURL('KIN_community_score',coin.community_score);
                dbThrottled(sql);
                sql = coinStatsURL('KIN_public_interest_score',coin.public_interest_score);
                dbThrottled(sql);
                sql = coinStatsURL('KIN_twitter_followers',coin.community_data.twitter_followers);
                dbThrottled(sql);
                sql = coinStatsURL('KIN_reddit_subscribers',coin.community_data.reddit_subscribers);
                dbThrottled(sql);
                sql = coinStatsURL('KIN_alexa_score',coin.public_interest_stats.alexa_rank);
                dbThrottled(sql);
            }
        });
}

function coinStatsURL(key, value){
    let coinStatsURL =  'INSERT INTO key_value SET id = \''+key+'\', data = ' +
    value + ' ON DUPLICATE KEY UPDATE data = ' + SqlString.escape(value);
    return(coinStatsURL);
}

async function updateCoinStats() {
    let capSql;
    let priceSql;
   
    coinmarketcap.on("KIN", (coin) => {
        capSql = coinStatsURL('KIN_marketcap',coin.market_cap_usd); 
        priceSql = coinStatsURL('KIN_price',coin.price_usd); 
        dbThrottled(priceSql);
        dbThrottled(capSql);
        updateSocialStats();//fetch social stats from coingecko - doesn't have a timer, so we just use this
        updateMetacalf();//estimate metacalf's future prices
    });
    coinmarketcap.on("BTC", (coin) => {
        capSql = coinStatsURL('BTC_marketcap',coin.market_cap_usd); 
        dbThrottled(capSql);
    });
}


async function start() {
    fetchOperations();//fetch latest unsaved operations from kin-stellar
    updateCoinStats();//fetch prices
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

    dbThrottled(QuerySql);//update but don't overwhelm the database
    dbThrottled(cursorSql);
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

function url2obj(url) {
    var pattern = /^(?:([^:\/?#\s]+):\/{2})?(?:([^@\/?#\s]+)@)?([^\/?#\s]+)?(?:\/([^?#\s]*))?(?:[?]([^#\s]+))?\S*$/;
    var matches =  url.match(pattern);
    var params = {};
    if (matches[5] != undefined) {
      matches[5].split('&').map(function(x){
        var a = x.split('=');
        params[a[0]]=a[1];
      });
    }
  
    return {
      protocol: matches[1],
      user: matches[2] != undefined ? matches[2].split(':')[0] : undefined,
      password: matches[2] != undefined ? matches[2].split(':')[1] : undefined,
      host: matches[3],
      hostname: matches[3] != undefined ? matches[3].split(/:(?=\d+$)/)[0] : undefined,
      port: matches[3] != undefined ? matches[3].split(/:(?=\d+$)/)[1] : undefined,
      segments : matches[4] != undefined ? matches[4].split('/') : undefined,
      params: params
    };
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
