'use strict';

var binance$1 = require('../binance.js');
var Precise = require('../base/Precise.js');
var errors = require('../base/errors.js');
var Cache = require('../base/ws/Cache.js');
var sha256 = require('../static_dependencies/noble-hashes/sha256.js');
var rsa = require('../base/functions/rsa.js');
var crypto = require('../base/functions/crypto.js');
var ed25519 = require('../static_dependencies/noble-curves/ed25519.js');

// ----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
class binance extends binance$1 {
    describe() {
        const superDescribe = super.describe();
        return this.deepExtend(superDescribe, this.describeData());
    }
    describeData() {
        return {
            'has': {
                'ws': true,
                'watchBalance': true,
                'watchLiquidations': true,
                'watchLiquidationsForSymbols': true,
                'watchMyLiquidations': true,
                'watchMyLiquidationsForSymbols': true,
                'watchBidsAsks': true,
                'watchMyTrades': true,
                'watchOHLCV': true,
                'watchOHLCVForSymbols': true,
                'watchOrderBook': true,
                'watchOrderBookForSymbols': true,
                'watchOrders': true,
                'watchOrdersForSymbols': true,
                'watchPositions': true,
                'watchTicker': true,
                'watchTickers': true,
                'watchMarkPrices': true,
                'watchMarkPrice': true,
                'watchTrades': true,
                'watchTradesForSymbols': true,
                'createOrderWs': true,
                'editOrderWs': true,
                'cancelOrderWs': true,
                'cancelOrdersWs': false,
                'cancelAllOrdersWs': true,
                'fetchBalanceWs': true,
                'fetchDepositsWs': false,
                'fetchMarketsWs': false,
                'fetchMyTradesWs': true,
                'fetchOHLCVWs': true,
                'fetchOrderBookWs': true,
                'fetchOpenOrdersWs': true,
                'fetchOrderWs': true,
                'fetchOrdersWs': true,
                'fetchPositionWs': true,
                'fetchPositionForSymbolWs': true,
                'fetchPositionsWs': true,
                'fetchTickerWs': true,
                'fetchTradesWs': true,
                'fetchTradingFeesWs': false,
                'fetchWithdrawalsWs': false,
            },
            'urls': {
                'test': {
                    'ws': {
                        'spot': 'wss://stream.testnet.binance.vision/ws',
                        'margin': 'wss://stream.testnet.binance.vision/ws',
                        'future': 'wss://fstream.binancefuture.com/ws',
                        'delivery': 'wss://dstream.binancefuture.com/ws',
                        'ws-api': {
                            'spot': 'wss://ws-api.testnet.binance.vision/ws-api/v3',
                            'future': 'wss://testnet.binancefuture.com/ws-fapi/v1',
                            'delivery': 'wss://testnet.binancefuture.com/ws-dapi/v1',
                        },
                    },
                },
                'api': {
                    'ws': {
                        'spot': 'wss://stream.binance.com:9443/ws',
                        'margin': 'wss://stream.binance.com:9443/ws',
                        'future': 'wss://fstream.binance.com/ws',
                        'delivery': 'wss://dstream.binance.com/ws',
                        'ws-api': {
                            'spot': 'wss://ws-api.binance.com:443/ws-api/v3',
                            'future': 'wss://ws-fapi.binance.com/ws-fapi/v1',
                            'delivery': 'wss://ws-dapi.binance.com/ws-dapi/v1',
                        },
                        'papi': 'wss://fstream.binance.com/pm/ws',
                    },
                },
                'doc': 'https://developers.binance.com/en',
            },
            'streaming': {
                'keepAlive': 180000,
            },
            'options': {
                'returnRateLimits': false,
                'streamLimits': {
                    'spot': 50,
                    'margin': 50,
                    'future': 50,
                    'delivery': 50, // max 200
                },
                'subscriptionLimitByStream': {
                    'spot': 200,
                    'margin': 200,
                    'future': 200,
                    'delivery': 200,
                },
                'streamBySubscriptionsHash': this.createSafeDictionary(),
                'streamIndex': -1,
                // get updates every 1000ms or 100ms
                // or every 0ms in real-time for futures
                'watchOrderBookRate': 100,
                'liquidationsLimit': 1000,
                'myLiquidationsLimit': 1000,
                'tradesLimit': 1000,
                'ordersLimit': 1000,
                'OHLCVLimit': 1000,
                'requestId': this.createSafeDictionary(),
                'watchOrderBookLimit': 1000,
                'watchTrades': {
                    'name': 'trade', // 'trade' or 'aggTrade'
                },
                'watchTicker': {
                    'name': 'ticker', // ticker or miniTicker or ticker_<window_size>
                },
                'watchTickers': {
                    'name': 'ticker', // ticker or miniTicker or ticker_<window_size>
                },
                'watchOHLCV': {
                    'name': 'kline', // or indexPriceKline or markPriceKline (coin-m futures)
                },
                'watchOrderBook': {
                    'maxRetries': 3,
                    'checksum': true,
                },
                'watchBalance': {
                    'fetchBalanceSnapshot': false,
                    'awaitBalanceSnapshot': true, // whether to wait for the balance snapshot before providing updates
                },
                'watchLiquidationsForSymbols': {
                    'defaultType': 'swap',
                },
                'watchPositions': {
                    'fetchPositionsSnapshot': true,
                    'awaitPositionsSnapshot': true, // whether to wait for the positions snapshot before providing updates
                },
                'wallet': 'wb',
                'listenKeyRefreshRate': 1200000,
                'ws': {
                    'cost': 5,
                },
                'tickerChannelsMap': {
                    '24hrTicker': 'ticker',
                    '24hrMiniTicker': 'miniTicker',
                    'markPriceUpdate': 'markPrice',
                    // rolling window tickers
                    '1hTicker': 'ticker_1h',
                    '4hTicker': 'ticker_4h',
                    '1dTicker': 'ticker_1d',
                    'bookTicker': 'bookTicker',
                },
            },
        };
    }
    requestId(url) {
        const options = this.safeDict(this.options, 'requestId', this.createSafeDictionary());
        const previousValue = this.safeInteger(options, url, 0);
        const newValue = this.sum(previousValue, 1);
        this.options['requestId'][url] = newValue;
        return newValue;
    }
    stream(type, subscriptionHash, numSubscriptions = 1) {
        const streamBySubscriptionsHash = this.safeDict(this.options, 'streamBySubscriptionsHash', this.createSafeDictionary());
        let stream = this.safeString(streamBySubscriptionsHash, subscriptionHash);
        if (stream === undefined) {
            let streamIndex = this.safeInteger(this.options, 'streamIndex', -1);
            const streamLimits = this.safeValue(this.options, 'streamLimits');
            const streamLimit = this.safeInteger(streamLimits, type);
            streamIndex = streamIndex + 1;
            const normalizedIndex = streamIndex % streamLimit;
            this.options['streamIndex'] = streamIndex;
            stream = this.numberToString(normalizedIndex);
            this.options['streamBySubscriptionsHash'][subscriptionHash] = stream;
            const subscriptionsByStreams = this.safeValue(this.options, 'numSubscriptionsByStream');
            if (subscriptionsByStreams === undefined) {
                this.options['numSubscriptionsByStream'] = this.createSafeDictionary();
            }
            const subscriptionsByStream = this.safeInteger(this.options['numSubscriptionsByStream'], stream, 0);
            const newNumSubscriptions = subscriptionsByStream + numSubscriptions;
            const subscriptionLimitByStream = this.safeInteger(this.options['subscriptionLimitByStream'], type, 200);
            if (newNumSubscriptions > subscriptionLimitByStream) {
                throw new errors.BadRequest(this.id + ' reached the limit of subscriptions by stream. Increase the number of streams, or increase the stream limit or subscription limit by stream if the exchange allows.');
            }
            this.options['numSubscriptionsByStream'][stream] = subscriptionsByStream + numSubscriptions;
        }
        return stream;
    }
    /**
     * @method
     * @name binance#watchLiquidations
     * @description watch the public liquidations of a trading pair
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Liquidation-Order-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Liquidation-Order-Streams
     * @param {string} symbol unified CCXT market symbol
     * @param {int} [since] the earliest time in ms to fetch liquidations for
     * @param {int} [limit] the maximum number of liquidation structures to retrieve
     * @param {object} [params] exchange specific parameters for the bitmex api endpoint
     * @returns {object} an array of [liquidation structures]{@link https://github.com/ccxt/ccxt/wiki/Manual#liquidation-structure}
     */
    async watchLiquidations(symbol, since = undefined, limit = undefined, params = {}) {
        return await this.watchLiquidationsForSymbols([symbol], since, limit, params);
    }
    /**
     * @method
     * @name binance#watchLiquidationsForSymbols
     * @description watch the public liquidations of a trading pair
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/All-Market-Liquidation-Order-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/All-Market-Liquidation-Order-Streams
     * @param {string[]} symbols list of unified market symbols
     * @param {int} [since] the earliest time in ms to fetch liquidations for
     * @param {int} [limit] the maximum number of liquidation structures to retrieve
     * @param {object} [params] exchange specific parameters for the bitmex api endpoint
     * @returns {object} an array of [liquidation structures]{@link https://github.com/ccxt/ccxt/wiki/Manual#liquidation-structure}
     */
    async watchLiquidationsForSymbols(symbols = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const subscriptionHashes = [];
        const messageHashes = [];
        let streamHash = 'liquidations';
        symbols = this.marketSymbols(symbols, undefined, true, true);
        if (this.isEmpty(symbols)) {
            subscriptionHashes.push('!' + 'forceOrder@arr');
            messageHashes.push('liquidations');
        }
        else {
            for (let i = 0; i < symbols.length; i++) {
                const market = this.market(symbols[i]);
                subscriptionHashes.push(market['lowercaseId'] + '@forceOrder');
                messageHashes.push('liquidations::' + symbols[i]);
            }
            streamHash += '::' + symbols.join(',');
        }
        const firstMarket = this.getMarketFromSymbols(symbols);
        let type = undefined;
        [type, params] = this.handleMarketTypeAndParams('watchLiquidationsForSymbols', firstMarket, params);
        if (type === 'spot') {
            throw new errors.BadRequest(this.id + ' watchLiquidationsForSymbols is not supported for spot symbols');
        }
        let subType = undefined;
        [subType, params] = this.handleSubTypeAndParams('watchLiquidationsForSymbols', firstMarket, params);
        if (this.isLinear(type, subType)) {
            type = 'future';
        }
        else if (this.isInverse(type, subType)) {
            type = 'delivery';
        }
        const numSubscriptions = subscriptionHashes.length;
        const url = this.urls['api']['ws'][type] + '/' + this.stream(type, streamHash, numSubscriptions);
        const requestId = this.requestId(url);
        const request = {
            'method': 'SUBSCRIBE',
            'params': subscriptionHashes,
            'id': requestId,
        };
        const subscribe = {
            'id': requestId,
        };
        const newLiquidations = await this.watchMultiple(url, messageHashes, this.extend(request, params), subscriptionHashes, subscribe);
        if (this.newUpdates) {
            return newLiquidations;
        }
        return this.filterBySymbolsSinceLimit(this.liquidations, symbols, since, limit, true);
    }
    handleLiquidation(client, message) {
        //
        // future
        //    {
        //        "e":"forceOrder",
        //        "E":1698871323061,
        //        "o":{
        //           "s":"BTCUSDT",
        //           "S":"BUY",
        //           "o":"LIMIT",
        //           "f":"IOC",
        //           "q":"1.437",
        //           "p":"35100.81",
        //           "ap":"34959.70",
        //           "X":"FILLED",
        //           "l":"1.437",
        //           "z":"1.437",
        //           "T":1698871323059
        //        }
        //    }
        // delivery
        //    {
        //        "e":"forceOrder",              // Event Type
        //        "E": 1591154240950,            // Event Time
        //        "o":{
        //            "s":"BTCUSD_200925",       // Symbol
        //            "ps": "BTCUSD",            // Pair
        //            "S":"SELL",                // Side
        //            "o":"LIMIT",               // Order Type
        //            "f":"IOC",                 // Time in Force
        //            "q":"1",                   // Original Quantity
        //            "p":"9425.5",              // Price
        //            "ap":"9496.5",             // Average Price
        //            "X":"FILLED",              // Order Status
        //            "l":"1",                   // Order Last Filled Quantity
        //            "z":"1",                   // Order Filled Accumulated Quantity
        //            "T": 1591154240949,        // Order Trade Time
        //        }
        //    }
        //
        const rawLiquidation = this.safeValue(message, 'o', {});
        const marketId = this.safeString(rawLiquidation, 's');
        const market = this.safeMarket(marketId, undefined, '', 'contract');
        const symbol = market['symbol'];
        const liquidation = this.parseWsLiquidation(rawLiquidation, market);
        let liquidations = this.safeValue(this.liquidations, symbol);
        if (liquidations === undefined) {
            const limit = this.safeInteger(this.options, 'liquidationsLimit', 1000);
            liquidations = new Cache.ArrayCache(limit);
        }
        liquidations.append(liquidation);
        this.liquidations[symbol] = liquidations;
        client.resolve([liquidation], 'liquidations');
        client.resolve([liquidation], 'liquidations::' + symbol);
    }
    parseWsLiquidation(liquidation, market = undefined) {
        //
        // future
        //    {
        //        "s":"BTCUSDT",
        //        "S":"BUY",
        //        "o":"LIMIT",
        //        "f":"IOC",
        //        "q":"1.437",
        //        "p":"35100.81",
        //        "ap":"34959.70",
        //        "X":"FILLED",
        //        "l":"1.437",
        //        "z":"1.437",
        //        "T":1698871323059
        //    }
        // delivery
        //    {
        //        "s":"BTCUSD_200925",       // Symbol
        //        "ps": "BTCUSD",            // Pair
        //        "S":"SELL",                // Side
        //        "o":"LIMIT",               // Order Type
        //        "f":"IOC",                 // Time in Force
        //        "q":"1",                   // Original Quantity
        //        "p":"9425.5",              // Price
        //        "ap":"9496.5",             // Average Price
        //        "X":"FILLED",              // Order Status
        //        "l":"1",                   // Order Last Filled Quantity
        //        "z":"1",                   // Order Filled Accumulated Quantity
        //        "T": 1591154240949,        // Order Trade Time
        //    }
        // myLiquidation
        //    {
        //        "s":"BTCUSDT",              // Symbol
        //        "c":"TEST",                 // Client Order Id
        //          // special client order id:
        //          // starts with "autoclose-": liquidation order
        //          // "adl_autoclose": ADL auto close order
        //          // "settlement_autoclose-": settlement order for delisting or delivery
        //        "S":"SELL",                 // Side
        //        "o":"TRAILING_STOP_MARKET", // Order Type
        //        "f":"GTC",                  // Time in Force
        //        "q":"0.001",                // Original Quantity
        //        "p":"0",                    // Original Price
        //        "ap":"0",                   // Average Price
        //        "sp":"7103.04",             // Stop Price. Please ignore with TRAILING_STOP_MARKET order
        //        "x":"NEW",                  // Execution Type
        //        "X":"NEW",                  // Order Status
        //        "i":8886774,                // Order Id
        //        "l":"0",                    // Order Last Filled Quantity
        //        "z":"0",                    // Order Filled Accumulated Quantity
        //        "L":"0",                    // Last Filled Price
        //        "N":"USDT",                 // Commission Asset, will not push if no commission
        //        "n":"0",                    // Commission, will not push if no commission
        //        "T":1568879465650,          // Order Trade Time
        //        "t":0,                      // Trade Id
        //        "b":"0",                    // Bids Notional
        //        "a":"9.91",                 // Ask Notional
        //        "m":false,                  // Is this trade the maker side?
        //        "R":false,                  // Is this reduce only
        //        "wt":"CONTRACT_PRICE",      // Stop Price Working Type
        //        "ot":"TRAILING_STOP_MARKET",// Original Order Type
        //        "ps":"LONG",                // Position Side
        //        "cp":false,                 // If Close-All, pushed with conditional order
        //        "AP":"7476.89",             // Activation Price, only puhed with TRAILING_STOP_MARKET order
        //        "cr":"5.0",                 // Callback Rate, only puhed with TRAILING_STOP_MARKET order
        //        "pP": false,                // If price protection is turned on
        //        "si": 0,                    // ignore
        //        "ss": 0,                    // ignore
        //        "rp":"0",                   // Realized Profit of the trade
        //        "V":"EXPIRE_TAKER",         // STP mode
        //        "pm":"OPPONENT",            // Price match mode
        //        "gtd":0                     // TIF GTD order auto cancel time
        //    }
        //
        const marketId = this.safeString(liquidation, 's');
        market = this.safeMarket(marketId, market);
        const timestamp = this.safeInteger(liquidation, 'T');
        return this.safeLiquidation({
            'info': liquidation,
            'symbol': this.safeSymbol(marketId, market),
            'contracts': this.safeNumber(liquidation, 'l'),
            'contractSize': this.safeNumber(market, 'contractSize'),
            'price': this.safeNumber(liquidation, 'ap'),
            'baseValue': undefined,
            'quoteValue': undefined,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
        });
    }
    /**
     * @method
     * @name binance#watchMyLiquidations
     * @description watch the private liquidations of a trading pair
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/user-data-streams/Event-Order-Update
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/user-data-streams/Event-Order-Update
     * @param {string} symbol unified CCXT market symbol
     * @param {int} [since] the earliest time in ms to fetch liquidations for
     * @param {int} [limit] the maximum number of liquidation structures to retrieve
     * @param {object} [params] exchange specific parameters for the bitmex api endpoint
     * @returns {object} an array of [liquidation structures]{@link https://github.com/ccxt/ccxt/wiki/Manual#liquidation-structure}
     */
    async watchMyLiquidations(symbol, since = undefined, limit = undefined, params = {}) {
        return this.watchMyLiquidationsForSymbols([symbol], since, limit, params);
    }
    /**
     * @method
     * @name binance#watchMyLiquidationsForSymbols
     * @description watch the private liquidations of a trading pair
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/user-data-streams/Event-Order-Update
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/user-data-streams/Event-Order-Update
     * @param {string[]} symbols list of unified market symbols
     * @param {int} [since] the earliest time in ms to fetch liquidations for
     * @param {int} [limit] the maximum number of liquidation structures to retrieve
     * @param {object} [params] exchange specific parameters for the bitmex api endpoint
     * @returns {object} an array of [liquidation structures]{@link https://github.com/ccxt/ccxt/wiki/Manual#liquidation-structure}
     */
    async watchMyLiquidationsForSymbols(symbols, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        symbols = this.marketSymbols(symbols, undefined, true, true, true);
        const market = this.getMarketFromSymbols(symbols);
        const messageHashes = ['myLiquidations'];
        if (!this.isEmpty(symbols)) {
            for (let i = 0; i < symbols.length; i++) {
                const symbol = symbols[i];
                messageHashes.push('myLiquidations::' + symbol);
            }
        }
        let type = undefined;
        [type, params] = this.handleMarketTypeAndParams('watchMyLiquidationsForSymbols', market, params);
        let subType = undefined;
        [subType, params] = this.handleSubTypeAndParams('watchMyLiquidationsForSymbols', market, params);
        if (this.isLinear(type, subType)) {
            type = 'future';
        }
        else if (this.isInverse(type, subType)) {
            type = 'delivery';
        }
        await this.authenticate(params);
        const url = this.urls['api']['ws'][type] + '/' + this.options[type]['listenKey'];
        const message = undefined;
        const newLiquidations = await this.watchMultiple(url, messageHashes, message, [type]);
        if (this.newUpdates) {
            return newLiquidations;
        }
        return this.filterBySymbolsSinceLimit(this.liquidations, symbols, since, limit);
    }
    handleMyLiquidation(client, message) {
        //
        //    {
        //        "s":"BTCUSDT",              // Symbol
        //        "c":"TEST",                 // Client Order Id
        //          // special client order id:
        //          // starts with "autoclose-": liquidation order
        //          // "adl_autoclose": ADL auto close order
        //          // "settlement_autoclose-": settlement order for delisting or delivery
        //        "S":"SELL",                 // Side
        //        "o":"TRAILING_STOP_MARKET", // Order Type
        //        "f":"GTC",                  // Time in Force
        //        "q":"0.001",                // Original Quantity
        //        "p":"0",                    // Original Price
        //        "ap":"0",                   // Average Price
        //        "sp":"7103.04",             // Stop Price. Please ignore with TRAILING_STOP_MARKET order
        //        "x":"NEW",                  // Execution Type
        //        "X":"NEW",                  // Order Status
        //        "i":8886774,                // Order Id
        //        "l":"0",                    // Order Last Filled Quantity
        //        "z":"0",                    // Order Filled Accumulated Quantity
        //        "L":"0",                    // Last Filled Price
        //        "N":"USDT",                 // Commission Asset, will not push if no commission
        //        "n":"0",                    // Commission, will not push if no commission
        //        "T":1568879465650,          // Order Trade Time
        //        "t":0,                      // Trade Id
        //        "b":"0",                    // Bids Notional
        //        "a":"9.91",                 // Ask Notional
        //        "m":false,                  // Is this trade the maker side?
        //        "R":false,                  // Is this reduce only
        //        "wt":"CONTRACT_PRICE",      // Stop Price Working Type
        //        "ot":"TRAILING_STOP_MARKET",// Original Order Type
        //        "ps":"LONG",                // Position Side
        //        "cp":false,                 // If Close-All, pushed with conditional order
        //        "AP":"7476.89",             // Activation Price, only puhed with TRAILING_STOP_MARKET order
        //        "cr":"5.0",                 // Callback Rate, only puhed with TRAILING_STOP_MARKET order
        //        "pP": false,                // If price protection is turned on
        //        "si": 0,                    // ignore
        //        "ss": 0,                    // ignore
        //        "rp":"0",                   // Realized Profit of the trade
        //        "V":"EXPIRE_TAKER",         // STP mode
        //        "pm":"OPPONENT",            // Price match mode
        //        "gtd":0                     // TIF GTD order auto cancel time
        //    }
        //
        const orderType = this.safeString(message, 'o');
        if (orderType !== 'LIQUIDATION') {
            return;
        }
        const marketId = this.safeString(message, 's');
        const market = this.safeMarket(marketId);
        const symbol = this.safeSymbol(marketId);
        const liquidation = this.parseWsLiquidation(message, market);
        let myLiquidations = this.safeValue(this.myLiquidations, symbol);
        if (myLiquidations === undefined) {
            const limit = this.safeInteger(this.options, 'myLiquidationsLimit', 1000);
            myLiquidations = new Cache.ArrayCache(limit);
        }
        myLiquidations.append(liquidation);
        this.myLiquidations[symbol] = myLiquidations;
        client.resolve([liquidation], 'myLiquidations');
        client.resolve([liquidation], 'myLiquidations::' + symbol);
    }
    /**
     * @method
     * @name binance#watchOrderBook
     * @description watches information on open orders with bid (buy) and ask (sell) prices, volumes and other data
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#partial-book-depth-streams
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#diff-depth-stream
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Partial-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Diff-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Partial-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Diff-Book-Depth-Streams
     * @param {string} symbol unified symbol of the market to fetch the order book for
     * @param {int} [limit] the maximum amount of order book entries to return
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} A dictionary of [order book structures]{@link https://docs.ccxt.com/#/?id=order-book-structure} indexed by market symbols
     */
    async watchOrderBook(symbol, limit = undefined, params = {}) {
        //
        // todo add support for <levels>-snapshots (depth)
        // https://github.com/binance-exchange/binance-official-api-docs/blob/master/web-socket-streams.md#partial-book-depth-streams        // <symbol>@depth<levels>@100ms or <symbol>@depth<levels> (1000ms)
        // valid <levels> are 5, 10, or 20
        //
        // default 100, max 1000, valid limits 5, 10, 20, 50, 100, 500, 1000
        //
        // notice the differences between trading futures and spot trading
        // the algorithms use different urls in step 1
        // delta caching and merging also differs in steps 4, 5, 6
        //
        // spot/margin
        // https://binance-docs.github.io/apidocs/spot/en/#how-to-manage-a-local-order-book-correctly
        //
        // 1. Open a stream to wss://stream.binance.com:9443/ws/bnbbtc@depth.
        // 2. Buffer the events you receive from the stream.
        // 3. Get a depth snapshot from https://www.binance.com/api/v1/depth?symbol=BNBBTC&limit=1000 .
        // 4. Drop any event where u is <= lastUpdateId in the snapshot.
        // 5. The first processed event should have U <= lastUpdateId+1 AND u >= lastUpdateId+1.
        // 6. While listening to the stream, each new event's U should be equal to the previous event's u+1.
        // 7. The data in each event is the absolute quantity for a price level.
        // 8. If the quantity is 0, remove the price level.
        // 9. Receiving an event that removes a price level that is not in your local order book can happen and is normal.
        //
        // futures
        // https://binance-docs.github.io/apidocs/futures/en/#how-to-manage-a-local-order-book-correctly
        //
        // 1. Open a stream to wss://fstream.binance.com/stream?streams=btcusdt@depth.
        // 2. Buffer the events you receive from the stream. For same price, latest received update covers the previous one.
        // 3. Get a depth snapshot from https://fapi.binance.com/fapi/v1/depth?symbol=BTCUSDT&limit=1000 .
        // 4. Drop any event where u is < lastUpdateId in the snapshot.
        // 5. The first processed event should have U <= lastUpdateId AND u >= lastUpdateId
        // 6. While listening to the stream, each new event's pu should be equal to the previous event's u, otherwise initialize the process from step 3.
        // 7. The data in each event is the absolute quantity for a price level.
        // 8. If the quantity is 0, remove the price level.
        // 9. Receiving an event that removes a price level that is not in your local order book can happen and is normal.
        //
        return await this.watchOrderBookForSymbols([symbol], limit, params);
    }
    /**
     * @method
     * @name binance#watchOrderBookForSymbols
     * @description watches information on open orders with bid (buy) and ask (sell) prices, volumes and other data
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#partial-book-depth-streams
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#diff-depth-stream
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Partial-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Diff-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Partial-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Diff-Book-Depth-Streams
     * @param {string[]} symbols unified array of symbols
     * @param {int} [limit] the maximum amount of order book entries to return
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} A dictionary of [order book structures]{@link https://docs.ccxt.com/#/?id=order-book-structure} indexed by market symbols
     */
    async watchOrderBookForSymbols(symbols, limit = undefined, params = {}) {
        await this.loadMarkets();
        symbols = this.marketSymbols(symbols, undefined, false, true, true);
        const firstMarket = this.market(symbols[0]);
        let type = firstMarket['type'];
        if (firstMarket['contract']) {
            type = firstMarket['linear'] ? 'future' : 'delivery';
        }
        const name = 'depth';
        let streamHash = 'multipleOrderbook';
        if (symbols !== undefined) {
            const symbolsLength = symbols.length;
            if (symbolsLength > 200) {
                throw new errors.BadRequest(this.id + ' watchOrderBookForSymbols() accepts 200 symbols at most. To watch more symbols call watchOrderBookForSymbols() multiple times');
            }
            streamHash += '::' + symbols.join(',');
        }
        const watchOrderBookRate = this.safeString(this.options, 'watchOrderBookRate', '100');
        const subParams = [];
        const messageHashes = [];
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            const market = this.market(symbol);
            messageHashes.push('orderbook::' + symbol);
            const subscriptionHash = market['lowercaseId'] + '@' + name;
            const symbolHash = subscriptionHash + '@' + watchOrderBookRate + 'ms';
            subParams.push(symbolHash);
        }
        const messageHashesLength = messageHashes.length;
        const url = this.urls['api']['ws'][type] + '/' + this.stream(type, streamHash, messageHashesLength);
        const requestId = this.requestId(url);
        const request = {
            'method': 'SUBSCRIBE',
            'params': subParams,
            'id': requestId,
        };
        const subscription = {
            'id': requestId.toString(),
            'name': name,
            'symbols': symbols,
            'method': this.handleOrderBookSubscription,
            'limit': limit,
            'type': type,
            'params': params,
        };
        const orderbook = await this.watchMultiple(url, messageHashes, this.extend(request, params), messageHashes, subscription);
        return orderbook.limit();
    }
    /**
     * @method
     * @name binance#unWatchOrderBookForSymbols
     * @description unWatches information on open orders with bid (buy) and ask (sell) prices, volumes and other data
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#partial-book-depth-streams
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#diff-depth-stream
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Partial-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Diff-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Partial-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Diff-Book-Depth-Streams
     * @param {string[]} symbols unified array of symbols
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} A dictionary of [order book structures]{@link https://docs.ccxt.com/#/?id=order-book-structure} indexed by market symbols
     */
    async unWatchOrderBookForSymbols(symbols, params = {}) {
        await this.loadMarkets();
        symbols = this.marketSymbols(symbols, undefined, false, true, true);
        const firstMarket = this.market(symbols[0]);
        let type = firstMarket['type'];
        if (firstMarket['contract']) {
            type = firstMarket['linear'] ? 'future' : 'delivery';
        }
        const name = 'depth';
        let streamHash = 'multipleOrderbook';
        if (symbols !== undefined) {
            streamHash += '::' + symbols.join(',');
        }
        const watchOrderBookRate = this.safeString(this.options, 'watchOrderBookRate', '100');
        const subParams = [];
        const subMessageHashes = [];
        const messageHashes = [];
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            const market = this.market(symbol);
            subMessageHashes.push('orderbook::' + symbol);
            messageHashes.push('unsubscribe:orderbook:' + symbol);
            const subscriptionHash = market['lowercaseId'] + '@' + name;
            const symbolHash = subscriptionHash + '@' + watchOrderBookRate + 'ms';
            subParams.push(symbolHash);
        }
        const messageHashesLength = subMessageHashes.length;
        const url = this.urls['api']['ws'][type] + '/' + this.stream(type, streamHash, messageHashesLength);
        const requestId = this.requestId(url);
        const request = {
            'method': 'UNSUBSCRIBE',
            'params': subParams,
            'id': requestId,
        };
        const subscription = {
            'unsubscribe': true,
            'id': requestId.toString(),
            'symbols': symbols,
            'subMessageHashes': subMessageHashes,
            'messageHashes': messageHashes,
            'topic': 'orderbook',
        };
        return await this.watchMultiple(url, messageHashes, this.extend(request, params), messageHashes, subscription);
    }
    /**
     * @method
     * @name binance#unWatchOrderBook
     * @description unWatches information on open orders with bid (buy) and ask (sell) prices, volumes and other data
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#partial-book-depth-streams
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#diff-depth-stream
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Partial-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Diff-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Partial-Book-Depth-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Diff-Book-Depth-Streams
     * @param {string} symbol unified array of symbols
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} A dictionary of [order book structures]{@link https://docs.ccxt.com/#/?id=order-book-structure} indexed by market symbols
     */
    async unWatchOrderBook(symbol, params = {}) {
        return await this.unWatchOrderBookForSymbols([symbol], params);
    }
    /**
     * @method
     * @name binance#fetchOrderBookWs
     * @description fetches information on open orders with bid (buy) and ask (sell) prices, volumes and other data
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#order-book
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/websocket-api/Order-Book
     * @param {string} symbol unified symbol of the market to fetch the order book for
     * @param {int} [limit] the maximum amount of order book entries to return
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} A dictionary of [order book structures]{@link https://docs.ccxt.com/#/?id=order-book-structure} indexed by market symbols
     */
    async fetchOrderBookWs(symbol, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const payload = {
            'symbol': market['id'],
        };
        if (limit !== undefined) {
            payload['limit'] = limit;
        }
        const marketType = this.getMarketType('fetchOrderBookWs', market, params);
        if (marketType !== 'future') {
            throw new errors.BadRequest(this.id + ' fetchOrderBookWs only supports swap markets');
        }
        const url = this.urls['api']['ws']['ws-api'][marketType];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'createOrderWs', 'returnRateLimits', false);
        payload['returnRateLimits'] = returnRateLimits;
        params = this.omit(params, 'test');
        const message = {
            'id': messageHash,
            'method': 'depth',
            'params': this.signParams(this.extend(payload, params)),
        };
        const subscription = {
            'method': this.handleFetchOrderBook,
        };
        const orderbook = await this.watch(url, messageHash, message, messageHash, subscription);
        orderbook['symbol'] = market['symbol'];
        return orderbook;
    }
    handleFetchOrderBook(client, message) {
        //
        //    {
        //        "id":"51e2affb-0aba-4821-ba75-f2625006eb43",
        //        "status":200,
        //        "result":{
        //            "lastUpdateId":1027024,
        //            "E":1589436922972,
        //            "T":1589436922959,
        //            "bids":[
        //               [
        //                  "4.00000000",
        //                  "431.00000000"
        //               ]
        //            ],
        //            "asks":[
        //               [
        //                  "4.00000200",
        //                  "12.00000000"
        //               ]
        //            ]
        //        }
        //    }
        //
        const messageHash = this.safeString(message, 'id');
        const result = this.safeDict(message, 'result');
        const timestamp = this.safeInteger(result, 'T');
        const orderbook = this.parseOrderBook(result, undefined, timestamp);
        orderbook['nonce'] = this.safeInteger2(result, 'lastUpdateId', 'u');
        client.resolve(orderbook, messageHash);
    }
    async fetchOrderBookSnapshot(client, message, subscription) {
        const symbol = this.safeString(subscription, 'symbol');
        const messageHash = 'orderbook::' + symbol;
        try {
            const defaultLimit = this.safeInteger(this.options, 'watchOrderBookLimit', 1000);
            const type = this.safeValue(subscription, 'type');
            const limit = this.safeInteger(subscription, 'limit', defaultLimit);
            const params = this.safeValue(subscription, 'params');
            // 3. Get a depth snapshot from https://www.binance.com/api/v1/depth?symbol=BNBBTC&limit=1000 .
            // todo: this is a synch blocking call - make it async
            // default 100, max 1000, valid limits 5, 10, 20, 50, 100, 500, 1000
            const snapshot = await this.fetchRestOrderBookSafe(symbol, limit, params);
            if (this.safeValue(this.orderbooks, symbol) === undefined) {
                // if the orderbook is dropped before the snapshot is received
                return;
            }
            const orderbook = this.orderbooks[symbol];
            orderbook.reset(snapshot);
            // unroll the accumulated deltas
            const messages = orderbook.cache;
            orderbook.cache = [];
            for (let i = 0; i < messages.length; i++) {
                const messageItem = messages[i];
                const U = this.safeInteger(messageItem, 'U');
                const u = this.safeInteger(messageItem, 'u');
                const pu = this.safeInteger(messageItem, 'pu');
                if (type === 'future') {
                    // 4. Drop any event where u is < lastUpdateId in the snapshot
                    if (u < orderbook['nonce']) {
                        continue;
                    }
                    // 5. The first processed event should have U <= lastUpdateId AND u >= lastUpdateId
                    if ((U <= orderbook['nonce']) && (u >= orderbook['nonce']) || (pu === orderbook['nonce'])) {
                        this.handleOrderBookMessage(client, messageItem, orderbook);
                    }
                }
                else {
                    // 4. Drop any event where u is <= lastUpdateId in the snapshot
                    if (u <= orderbook['nonce']) {
                        continue;
                    }
                    // 5. The first processed event should have U <= lastUpdateId+1 AND u >= lastUpdateId+1
                    if (((U - 1) <= orderbook['nonce']) && ((u - 1) >= orderbook['nonce'])) {
                        this.handleOrderBookMessage(client, messageItem, orderbook);
                    }
                }
            }
            this.orderbooks[symbol] = orderbook;
            client.resolve(orderbook, messageHash);
        }
        catch (e) {
            delete client.subscriptions[messageHash];
            client.reject(e, messageHash);
        }
    }
    handleDelta(bookside, delta) {
        const price = this.safeFloat(delta, 0);
        const amount = this.safeFloat(delta, 1);
        bookside.store(price, amount);
    }
    handleDeltas(bookside, deltas) {
        for (let i = 0; i < deltas.length; i++) {
            this.handleDelta(bookside, deltas[i]);
        }
    }
    handleOrderBookMessage(client, message, orderbook) {
        const u = this.safeInteger(message, 'u');
        this.handleDeltas(orderbook['asks'], this.safeValue(message, 'a', []));
        this.handleDeltas(orderbook['bids'], this.safeValue(message, 'b', []));
        orderbook['nonce'] = u;
        const timestamp = this.safeInteger(message, 'E');
        orderbook['timestamp'] = timestamp;
        orderbook['datetime'] = this.iso8601(timestamp);
        return orderbook;
    }
    handleOrderBook(client, message) {
        //
        // initial snapshot is fetched with ccxt's fetchOrderBook
        // the feed does not include a snapshot, just the deltas
        //
        //     {
        //         "e": "depthUpdate", // Event type
        //         "E": 1577554482280, // Event time
        //         "s": "BNBBTC", // Symbol
        //         "U": 157, // First update ID in event
        //         "u": 160, // Final update ID in event
        //         "b": [ // bids
        //             [ "0.0024", "10" ], // price, size
        //         ],
        //         "a": [ // asks
        //             [ "0.0026", "100" ], // price, size
        //         ]
        //     }
        //
        const isSpot = (client.url.indexOf('/stream') > -1);
        const marketType = (isSpot) ? 'spot' : 'contract';
        const marketId = this.safeString(message, 's');
        const market = this.safeMarket(marketId, undefined, undefined, marketType);
        const symbol = market['symbol'];
        const messageHash = 'orderbook::' + symbol;
        if (!(symbol in this.orderbooks)) {
            //
            // https://github.com/ccxt/ccxt/issues/6672
            //
            // Sometimes Binance sends the first delta before the subscription
            // confirmation arrives. At that point the orderbook is not
            // initialized yet and the snapshot has not been requested yet
            // therefore it is safe to drop these premature messages.
            //
            return;
        }
        const orderbook = this.orderbooks[symbol];
        const nonce = this.safeInteger(orderbook, 'nonce');
        if (nonce === undefined) {
            // 2. Buffer the events you receive from the stream.
            orderbook.cache.push(message);
        }
        else {
            try {
                const U = this.safeInteger(message, 'U');
                const u = this.safeInteger(message, 'u');
                const pu = this.safeInteger(message, 'pu');
                if (pu === undefined) {
                    // spot
                    // 4. Drop any event where u is <= lastUpdateId in the snapshot
                    if (u > orderbook['nonce']) {
                        const timestamp = this.safeInteger(orderbook, 'timestamp');
                        let conditional = undefined;
                        if (timestamp === undefined) {
                            // 5. The first processed event should have U <= lastUpdateId+1 AND u >= lastUpdateId+1
                            conditional = ((U - 1) <= orderbook['nonce']) && ((u - 1) >= orderbook['nonce']);
                        }
                        else {
                            // 6. While listening to the stream, each new event's U should be equal to the previous event's u+1.
                            conditional = ((U - 1) === orderbook['nonce']);
                        }
                        if (conditional) {
                            this.handleOrderBookMessage(client, message, orderbook);
                            if (nonce < orderbook['nonce']) {
                                client.resolve(orderbook, messageHash);
                            }
                        }
                        else {
                            const checksum = this.handleOption('watchOrderBook', 'checksum', true);
                            if (checksum) {
                                // todo: client.reject from handleOrderBookMessage properly
                                throw new errors.ChecksumError(this.id + ' ' + this.orderbookChecksumMessage(symbol));
                            }
                        }
                    }
                }
                else {
                    // future
                    // 4. Drop any event where u is < lastUpdateId in the snapshot
                    if (u >= orderbook['nonce']) {
                        // 5. The first processed event should have U <= lastUpdateId AND u >= lastUpdateId
                        // 6. While listening to the stream, each new event's pu should be equal to the previous event's u, otherwise initialize the process from step 3
                        if ((U <= orderbook['nonce']) || (pu === orderbook['nonce'])) {
                            this.handleOrderBookMessage(client, message, orderbook);
                            if (nonce <= orderbook['nonce']) {
                                client.resolve(orderbook, messageHash);
                            }
                        }
                        else {
                            const checksum = this.handleOption('watchOrderBook', 'checksum', true);
                            if (checksum) {
                                // todo: client.reject from handleOrderBookMessage properly
                                throw new errors.ChecksumError(this.id + ' ' + this.orderbookChecksumMessage(symbol));
                            }
                        }
                    }
                }
            }
            catch (e) {
                delete this.orderbooks[symbol];
                delete client.subscriptions[messageHash];
                client.reject(e, messageHash);
            }
        }
    }
    handleOrderBookSubscription(client, message, subscription) {
        const defaultLimit = this.safeInteger(this.options, 'watchOrderBookLimit', 1000);
        // const messageHash = this.safeString (subscription, 'messageHash');
        const symbolOfSubscription = this.safeString(subscription, 'symbol'); // watchOrderBook
        const symbols = this.safeValue(subscription, 'symbols', [symbolOfSubscription]); // watchOrderBookForSymbols
        const limit = this.safeInteger(subscription, 'limit', defaultLimit);
        // handle list of symbols
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            if (symbol in this.orderbooks) {
                delete this.orderbooks[symbol];
            }
            this.orderbooks[symbol] = this.orderBook({}, limit);
            subscription = this.extend(subscription, { 'symbol': symbol });
            // fetch the snapshot in a separate async call
            this.spawn(this.fetchOrderBookSnapshot, client, message, subscription);
        }
    }
    handleSubscriptionStatus(client, message) {
        //
        //     {
        //         "result": null,
        //         "id": 1574649734450
        //     }
        //
        const id = this.safeString(message, 'id');
        const subscriptionsById = this.indexBy(client.subscriptions, 'id');
        const subscription = this.safeValue(subscriptionsById, id, {});
        const method = this.safeValue(subscription, 'method');
        if (method !== undefined) {
            method.call(this, client, message, subscription);
        }
        const isUnSubMessage = this.safeBool(subscription, 'unsubscribe', false);
        if (isUnSubMessage) {
            this.handleUnSubscription(client, subscription);
        }
        return message;
    }
    handleUnSubscription(client, subscription) {
        const messageHashes = this.safeList(subscription, 'messageHashes', []);
        const subMessageHashes = this.safeList(subscription, 'subMessageHashes', []);
        for (let j = 0; j < messageHashes.length; j++) {
            const unsubHash = messageHashes[j];
            const subHash = subMessageHashes[j];
            this.cleanUnsubscription(client, subHash, unsubHash);
        }
        this.cleanCache(subscription);
    }
    /**
     * @method
     * @name binance#watchTradesForSymbols
     * @description get the list of most recent trades for a list of symbols
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#aggregate-trades
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#recent-trades
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Aggregate-Trade-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Aggregate-Trade-Streams
     * @param {string[]} symbols unified symbol of the market to fetch trades for
     * @param {int} [since] timestamp in ms of the earliest trade to fetch
     * @param {int} [limit] the maximum amount of trades to fetch
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {string} [params.name] the name of the method to call, 'trade' or 'aggTrade', default is 'trade'
     * @returns {object[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=public-trades}
     */
    async watchTradesForSymbols(symbols, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        symbols = this.marketSymbols(symbols, undefined, false, true, true);
        let streamHash = 'multipleTrades';
        if (symbols !== undefined) {
            const symbolsLength = symbols.length;
            if (symbolsLength > 200) {
                throw new errors.BadRequest(this.id + ' watchTradesForSymbols() accepts 200 symbols at most. To watch more symbols call watchTradesForSymbols() multiple times');
            }
            streamHash += '::' + symbols.join(',');
        }
        let name = undefined;
        [name, params] = this.handleOptionAndParams(params, 'watchTradesForSymbols', 'name', 'trade');
        params = this.omit(params, 'callerMethodName');
        const firstMarket = this.market(symbols[0]);
        let type = firstMarket['type'];
        if (firstMarket['contract']) {
            type = firstMarket['linear'] ? 'future' : 'delivery';
        }
        const messageHashes = [];
        const subParams = [];
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            const market = this.market(symbol);
            messageHashes.push('trade::' + symbol);
            const rawHash = market['lowercaseId'] + '@' + name;
            subParams.push(rawHash);
        }
        const query = this.omit(params, 'type');
        const subParamsLength = subParams.length;
        const url = this.urls['api']['ws'][type] + '/' + this.stream(type, streamHash, subParamsLength);
        const requestId = this.requestId(url);
        const request = {
            'method': 'SUBSCRIBE',
            'params': subParams,
            'id': requestId,
        };
        const subscribe = {
            'id': requestId,
        };
        const trades = await this.watchMultiple(url, messageHashes, this.extend(request, query), messageHashes, subscribe);
        if (this.newUpdates) {
            const first = this.safeValue(trades, 0);
            const tradeSymbol = this.safeString(first, 'symbol');
            limit = trades.getLimit(tradeSymbol, limit);
        }
        return this.filterBySinceLimit(trades, since, limit, 'timestamp', true);
    }
    /**
     * @method
     * @name binance#unWatchTradesForSymbols
     * @description unsubscribes from the trades channel
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#aggregate-trades
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#recent-trades
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Aggregate-Trade-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Aggregate-Trade-Streams
     * @param {string[]} symbols unified symbol of the market to fetch trades for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {string} [params.name] the name of the method to call, 'trade' or 'aggTrade', default is 'trade'
     * @returns {object[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=public-trades}
     */
    async unWatchTradesForSymbols(symbols, params = {}) {
        await this.loadMarkets();
        symbols = this.marketSymbols(symbols, undefined, false, true, true);
        let streamHash = 'multipleTrades';
        if (symbols !== undefined) {
            const symbolsLength = symbols.length;
            if (symbolsLength > 200) {
                throw new errors.BadRequest(this.id + ' watchTradesForSymbols() accepts 200 symbols at most. To watch more symbols call watchTradesForSymbols() multiple times');
            }
            streamHash += '::' + symbols.join(',');
        }
        let name = undefined;
        [name, params] = this.handleOptionAndParams(params, 'watchTradesForSymbols', 'name', 'trade');
        params = this.omit(params, 'callerMethodName');
        const firstMarket = this.market(symbols[0]);
        let type = firstMarket['type'];
        if (firstMarket['contract']) {
            type = firstMarket['linear'] ? 'future' : 'delivery';
        }
        const subMessageHashes = [];
        const subParams = [];
        const messageHashes = [];
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            const market = this.market(symbol);
            subMessageHashes.push('trade::' + symbol);
            messageHashes.push('unsubscribe:trade:' + symbol);
            const rawHash = market['lowercaseId'] + '@' + name;
            subParams.push(rawHash);
        }
        const query = this.omit(params, 'type');
        const subParamsLength = subParams.length;
        const url = this.urls['api']['ws'][type] + '/' + this.stream(type, streamHash, subParamsLength);
        const requestId = this.requestId(url);
        const request = {
            'method': 'UNSUBSCRIBE',
            'params': subParams,
            'id': requestId,
        };
        const subscription = {
            'unsubscribe': true,
            'id': requestId.toString(),
            'subMessageHashes': subMessageHashes,
            'messageHashes': messageHashes,
            'symbols': symbols,
            'topic': 'trades',
        };
        return await this.watchMultiple(url, messageHashes, this.extend(request, query), messageHashes, subscription);
    }
    /**
     * @method
     * @name binance#unWatchTrades
     * @description unsubscribes from the trades channel
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#aggregate-trades
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#recent-trades
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Aggregate-Trade-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Aggregate-Trade-Streams
     * @param {string} symbol unified symbol of the market to fetch trades for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {string} [params.name] the name of the method to call, 'trade' or 'aggTrade', default is 'trade'
     * @returns {object[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=public-trades}
     */
    async unWatchTrades(symbol, params = {}) {
        await this.loadMarkets();
        return await this.unWatchTradesForSymbols([symbol], params);
    }
    /**
     * @method
     * @name binance#watchTrades
     * @description get the list of most recent trades for a particular symbol
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#aggregate-trades
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#recent-trades
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Aggregate-Trade-Streams
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Aggregate-Trade-Streams
     * @param {string} symbol unified symbol of the market to fetch trades for
     * @param {int} [since] timestamp in ms of the earliest trade to fetch
     * @param {int} [limit] the maximum amount of trades to fetch
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {string} [params.name] the name of the method to call, 'trade' or 'aggTrade', default is 'trade'
     * @returns {object[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=public-trades}
     */
    async watchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        params['callerMethodName'] = 'watchTrades';
        return await this.watchTradesForSymbols([symbol], since, limit, params);
    }
    parseWsTrade(trade, market = undefined) {
        //
        // public watchTrades
        //
        //     {
        //         "e": "trade",       // event type
        //         "E": 1579481530911, // event time
        //         "s": "ETHBTC",      // symbol
        //         "t": 158410082,     // trade id
        //         "p": "0.01914100",  // price
        //         "q": "0.00700000",  // quantity
        //         "b": 586187049,     // buyer order id
        //         "a": 586186710,     // seller order id
        //         "T": 1579481530910, // trade time
        //         "m": false,         // is the buyer the market maker
        //         "M": true           // binance docs say it should be ignored
        //     }
        //
        //     {
        //        "e": "aggTrade",  // Event type
        //        "E": 123456789,   // Event time
        //        "s": "BNBBTC",    // Symbol
        //        "a": 12345,       // Aggregate trade ID
        //        "p": "0.001",     // Price
        //        "q": "100",       // Quantity
        //        "f": 100,         // First trade ID
        //        "l": 105,         // Last trade ID
        //        "T": 123456785,   // Trade time
        //        "m": true,        // Is the buyer the market maker?
        //        "M": true         // Ignore
        //     }
        //
        // private watchMyTrades spot
        //
        //     {
        //         "e": "executionReport",
        //         "E": 1611063861489,
        //         "s": "BNBUSDT",
        //         "c": "m4M6AD5MF3b1ERe65l4SPq",
        //         "S": "BUY",
        //         "o": "MARKET",
        //         "f": "GTC",
        //         "q": "2.00000000",
        //         "p": "0.00000000",
        //         "P": "0.00000000",
        //         "F": "0.00000000",
        //         "g": -1,
        //         "C": '',
        //         "x": "TRADE",
        //         "X": "PARTIALLY_FILLED",
        //         "r": "NONE",
        //         "i": 1296882607,
        //         "l": "0.33200000",
        //         "z": "0.33200000",
        //         "L": "46.86600000",
        //         "n": "0.00033200",
        //         "N": "BNB",
        //         "T": 1611063861488,
        //         "t": 109747654,
        //         "I": 2696953381,
        //         "w": false,
        //         "m": false,
        //         "M": true,
        //         "O": 1611063861488,
        //         "Z": "15.55951200",
        //         "Y": "15.55951200",
        //         "Q": "0.00000000"
        //     }
        //
        // private watchMyTrades future/delivery
        //
        //     {
        //         "s": "BTCUSDT",
        //         "c": "pb2jD6ZQHpfzSdUac8VqMK",
        //         "S": "SELL",
        //         "o": "MARKET",
        //         "f": "GTC",
        //         "q": "0.001",
        //         "p": "0",
        //         "ap": "33468.46000",
        //         "sp": "0",
        //         "x": "TRADE",
        //         "X": "FILLED",
        //         "i": 13351197194,
        //         "l": "0.001",
        //         "z": "0.001",
        //         "L": "33468.46",
        //         "n": "0.00027086",
        //         "N": "BNB",
        //         "T": 1612095165362,
        //         "t": 458032604,
        //         "b": "0",
        //         "a": "0",
        //         "m": false,
        //         "R": false,
        //         "wt": "CONTRACT_PRICE",
        //         "ot": "MARKET",
        //         "ps": "BOTH",
        //         "cp": false,
        //         "rp": "0.00335000",
        //         "pP": false,
        //         "si": 0,
        //         "ss": 0
        //     }
        //
        const executionType = this.safeString(trade, 'x');
        const isTradeExecution = (executionType === 'TRADE');
        if (!isTradeExecution) {
            return this.parseTrade(trade, market);
        }
        const id = this.safeString2(trade, 't', 'a');
        const timestamp = this.safeInteger(trade, 'T');
        const price = this.safeString2(trade, 'L', 'p');
        let amount = this.safeString(trade, 'q');
        if (isTradeExecution) {
            amount = this.safeString(trade, 'l', amount);
        }
        let cost = this.safeString(trade, 'Y');
        if (cost === undefined) {
            if ((price !== undefined) && (amount !== undefined)) {
                cost = Precise["default"].stringMul(price, amount);
            }
        }
        const marketId = this.safeString(trade, 's');
        const marketType = ('ps' in trade) ? 'contract' : 'spot';
        const symbol = this.safeSymbol(marketId, undefined, undefined, marketType);
        let side = this.safeStringLower(trade, 'S');
        let takerOrMaker = undefined;
        const orderId = this.safeString(trade, 'i');
        if ('m' in trade) {
            if (side === undefined) {
                side = trade['m'] ? 'sell' : 'buy'; // this is reversed intentionally
            }
            takerOrMaker = trade['m'] ? 'maker' : 'taker';
        }
        let fee = undefined;
        const feeCost = this.safeString(trade, 'n');
        if (feeCost !== undefined) {
            const feeCurrencyId = this.safeString(trade, 'N');
            const feeCurrencyCode = this.safeCurrencyCode(feeCurrencyId);
            fee = {
                'cost': feeCost,
                'currency': feeCurrencyCode,
            };
        }
        const type = this.safeStringLower(trade, 'o');
        return this.safeTrade({
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'symbol': symbol,
            'id': id,
            'order': orderId,
            'type': type,
            'takerOrMaker': takerOrMaker,
            'side': side,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
        });
    }
    handleTrade(client, message) {
        // the trade streams push raw trade information in real-time
        // each trade has a unique buyer and seller
        const isSpot = (client.url.indexOf('/stream') > -1);
        const marketType = (isSpot) ? 'spot' : 'contract';
        const marketId = this.safeString(message, 's');
        const market = this.safeMarket(marketId, undefined, undefined, marketType);
        const symbol = market['symbol'];
        const messageHash = 'trade::' + symbol;
        const trade = this.parseWsTrade(message, market);
        let tradesArray = this.safeValue(this.trades, symbol);
        if (tradesArray === undefined) {
            const limit = this.safeInteger(this.options, 'tradesLimit', 1000);
            tradesArray = new Cache.ArrayCache(limit);
        }
        tradesArray.append(trade);
        this.trades[symbol] = tradesArray;
        client.resolve(tradesArray, messageHash);
    }
    /**
     * @method
     * @name binance#watchOHLCV
     * @description watches historical candlestick data containing the open, high, low, and close price, and the volume of a market
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#klines
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Kline-Candlestick-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Kline-Candlestick-Streams
     * @param {string} symbol unified symbol of the market to fetch OHLCV data for
     * @param {string} timeframe the length of time each candle represents
     * @param {int} [since] timestamp in ms of the earliest candle to fetch
     * @param {int} [limit] the maximum amount of candles to fetch
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {object} [params.timezone] if provided, kline intervals are interpreted in that timezone instead of UTC, example '+08:00'
     * @returns {int[][]} A list of candles ordered as timestamp, open, high, low, close, volume
     */
    async watchOHLCV(symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        symbol = market['symbol'];
        params['callerMethodName'] = 'watchOHLCV';
        const result = await this.watchOHLCVForSymbols([[symbol, timeframe]], since, limit, params);
        return result[symbol][timeframe];
    }
    /**
     * @method
     * @name binance#watchOHLCVForSymbols
     * @description watches historical candlestick data containing the open, high, low, and close price, and the volume of a market
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#klines
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Kline-Candlestick-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Kline-Candlestick-Streams
     * @param {string[][]} symbolsAndTimeframes array of arrays containing unified symbols and timeframes to fetch OHLCV data for, example [['BTC/USDT', '1m'], ['LTC/USDT', '5m']]
     * @param {int} [since] timestamp in ms of the earliest candle to fetch
     * @param {int} [limit] the maximum amount of candles to fetch
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {object} [params.timezone] if provided, kline intervals are interpreted in that timezone instead of UTC, example '+08:00'
     * @returns {int[][]} A list of candles ordered as timestamp, open, high, low, close, volume
     */
    async watchOHLCVForSymbols(symbolsAndTimeframes, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        let klineType = undefined;
        [klineType, params] = this.handleParamString2(params, 'channel', 'name', 'kline');
        const symbols = this.getListFromObjectValues(symbolsAndTimeframes, 0);
        const marketSymbols = this.marketSymbols(symbols, undefined, false, false, true);
        const firstMarket = this.market(marketSymbols[0]);
        let type = firstMarket['type'];
        if (firstMarket['contract']) {
            type = firstMarket['linear'] ? 'future' : 'delivery';
        }
        const isSpot = (type === 'spot');
        let timezone = undefined;
        [timezone, params] = this.handleParamString(params, 'timezone', undefined);
        const isUtc8 = (timezone !== undefined) && ((timezone === '+08:00') || Precise["default"].stringEq(timezone, '8'));
        const rawHashes = [];
        const messageHashes = [];
        for (let i = 0; i < symbolsAndTimeframes.length; i++) {
            const symAndTf = symbolsAndTimeframes[i];
            const symbolString = symAndTf[0];
            const timeframeString = symAndTf[1];
            const interval = this.safeString(this.timeframes, timeframeString, timeframeString);
            const market = this.market(symbolString);
            let marketId = market['lowercaseId'];
            if (klineType === 'indexPriceKline') {
                // weird behavior for index price kline we can't use the perp suffix
                marketId = marketId.replace('_perp', '');
            }
            const shouldUseUTC8 = (isUtc8 && isSpot);
            const suffix = '@+08:00';
            const utcSuffix = shouldUseUTC8 ? suffix : '';
            rawHashes.push(marketId + '@' + klineType + '_' + interval + utcSuffix);
            messageHashes.push('ohlcv::' + market['symbol'] + '::' + timeframeString);
        }
        const url = this.urls['api']['ws'][type] + '/' + this.stream(type, 'multipleOHLCV');
        const requestId = this.requestId(url);
        const request = {
            'method': 'SUBSCRIBE',
            'params': rawHashes,
            'id': requestId,
        };
        const subscribe = {
            'id': requestId,
        };
        params = this.omit(params, 'callerMethodName');
        const [symbol, timeframe, candles] = await this.watchMultiple(url, messageHashes, this.extend(request, params), messageHashes, subscribe);
        if (this.newUpdates) {
            limit = candles.getLimit(symbol, limit);
        }
        const filtered = this.filterBySinceLimit(candles, since, limit, 0, true);
        return this.createOHLCVObject(symbol, timeframe, filtered);
    }
    /**
     * @method
     * @name binance#unWatchOHLCVForSymbols
     * @description unWatches historical candlestick data containing the open, high, low, and close price, and the volume of a market
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#klines
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Kline-Candlestick-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Kline-Candlestick-Streams
     * @param {string[][]} symbolsAndTimeframes array of arrays containing unified symbols and timeframes to fetch OHLCV data for, example [['BTC/USDT', '1m'], ['LTC/USDT', '5m']]
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {object} [params.timezone] if provided, kline intervals are interpreted in that timezone instead of UTC, example '+08:00'
     * @returns {int[][]} A list of candles ordered as timestamp, open, high, low, close, volume
     */
    async unWatchOHLCVForSymbols(symbolsAndTimeframes, params = {}) {
        await this.loadMarkets();
        let klineType = undefined;
        [klineType, params] = this.handleParamString2(params, 'channel', 'name', 'kline');
        const symbols = this.getListFromObjectValues(symbolsAndTimeframes, 0);
        const marketSymbols = this.marketSymbols(symbols, undefined, false, false, true);
        const firstMarket = this.market(marketSymbols[0]);
        let type = firstMarket['type'];
        if (firstMarket['contract']) {
            type = firstMarket['linear'] ? 'future' : 'delivery';
        }
        const isSpot = (type === 'spot');
        let timezone = undefined;
        [timezone, params] = this.handleParamString(params, 'timezone', undefined);
        const isUtc8 = (timezone !== undefined) && ((timezone === '+08:00') || Precise["default"].stringEq(timezone, '8'));
        const rawHashes = [];
        const subMessageHashes = [];
        const messageHashes = [];
        for (let i = 0; i < symbolsAndTimeframes.length; i++) {
            const symAndTf = symbolsAndTimeframes[i];
            const symbolString = symAndTf[0];
            const timeframeString = symAndTf[1];
            const interval = this.safeString(this.timeframes, timeframeString, timeframeString);
            const market = this.market(symbolString);
            let marketId = market['lowercaseId'];
            if (klineType === 'indexPriceKline') {
                // weird behavior for index price kline we can't use the perp suffix
                marketId = marketId.replace('_perp', '');
            }
            const shouldUseUTC8 = (isUtc8 && isSpot);
            const suffix = '@+08:00';
            const utcSuffix = shouldUseUTC8 ? suffix : '';
            rawHashes.push(marketId + '@' + klineType + '_' + interval + utcSuffix);
            subMessageHashes.push('ohlcv::' + market['symbol'] + '::' + timeframeString);
            messageHashes.push('unsubscribe::ohlcv::' + market['symbol'] + '::' + timeframeString);
        }
        const url = this.urls['api']['ws'][type] + '/' + this.stream(type, 'multipleOHLCV');
        const requestId = this.requestId(url);
        const request = {
            'method': 'UNSUBSCRIBE',
            'params': rawHashes,
            'id': requestId,
        };
        const subscribe = {
            'unsubscribe': true,
            'id': requestId.toString(),
            'symbols': symbols,
            'symbolsAndTimeframes': symbolsAndTimeframes,
            'subMessageHashes': subMessageHashes,
            'messageHashes': messageHashes,
            'topic': 'ohlcv',
        };
        params = this.omit(params, 'callerMethodName');
        return await this.watchMultiple(url, messageHashes, this.extend(request, params), messageHashes, subscribe);
    }
    /**
     * @method
     * @name binance#unWatchOHLCV
     * @description unWatches historical candlestick data containing the open, high, low, and close price, and the volume of a market
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#klines
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Kline-Candlestick-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Kline-Candlestick-Streams
     * @param {string} symbol unified symbol of the market to fetch OHLCV data for
     * @param {string} timeframe the length of time each candle represents
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {object} [params.timezone] if provided, kline intervals are interpreted in that timezone instead of UTC, example '+08:00'
     * @returns {int[][]} A list of candles ordered as timestamp, open, high, low, close, volume
     */
    async unWatchOHLCV(symbol, timeframe = '1m', params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        symbol = market['symbol'];
        params['callerMethodName'] = 'watchOHLCV';
        return await this.unWatchOHLCVForSymbols([[symbol, timeframe]], params);
    }
    handleOHLCV(client, message) {
        //
        //     {
        //         "e": "kline",
        //         "E": 1579482921215,
        //         "s": "ETHBTC",
        //         "k": {
        //             "t": 1579482900000,
        //             "T": 1579482959999,
        //             "s": "ETHBTC",
        //             "i": "1m",
        //             "f": 158411535,
        //             "L": 158411550,
        //             "o": "0.01913200",
        //             "c": "0.01913500",
        //             "h": "0.01913700",
        //             "l": "0.01913200",
        //             "v": "5.08400000",
        //             "n": 16,
        //             "x": false,
        //             "q": "0.09728060",
        //             "V": "3.30200000",
        //             "Q": "0.06318500",
        //             "B": "0"
        //         }
        //     }
        //
        let event = this.safeString(message, 'e');
        const eventMap = {
            'indexPrice_kline': 'indexPriceKline',
            'markPrice_kline': 'markPriceKline',
        };
        event = this.safeString(eventMap, event, event);
        const kline = this.safeValue(message, 'k');
        let marketId = this.safeString2(kline, 's', 'ps');
        if (event === 'indexPriceKline') {
            // indexPriceKline doesn't have the _PERP suffix
            marketId = this.safeString(message, 'ps');
        }
        const interval = this.safeString(kline, 'i');
        // use a reverse lookup in a static map instead
        const unifiedTimeframe = this.findTimeframe(interval);
        const parsed = [
            this.safeInteger(kline, 't'),
            this.safeFloat(kline, 'o'),
            this.safeFloat(kline, 'h'),
            this.safeFloat(kline, 'l'),
            this.safeFloat(kline, 'c'),
            this.safeFloat(kline, 'v'),
        ];
        const isSpot = (client.url.indexOf('/stream') > -1);
        const marketType = (isSpot) ? 'spot' : 'contract';
        const symbol = this.safeSymbol(marketId, undefined, undefined, marketType);
        const messageHash = 'ohlcv::' + symbol + '::' + unifiedTimeframe;
        this.ohlcvs[symbol] = this.safeValue(this.ohlcvs, symbol, {});
        let stored = this.safeValue(this.ohlcvs[symbol], unifiedTimeframe);
        if (stored === undefined) {
            const limit = this.safeInteger(this.options, 'OHLCVLimit', 1000);
            stored = new Cache.ArrayCacheByTimestamp(limit);
            this.ohlcvs[symbol][unifiedTimeframe] = stored;
        }
        stored.append(parsed);
        const resolveData = [symbol, unifiedTimeframe, stored];
        client.resolve(resolveData, messageHash);
    }
    /**
     * @method
     * @name binance#fetchTickerWs
     * @description fetches a price ticker, a statistical calculation with the information calculated over the past 24 hours for a specific market
     * @param {string} symbol unified symbol of the market to fetch the ticker for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {string} [params.method] method to use can be ticker.price or ticker.book
     * @param {boolean} [params.returnRateLimits] return the rate limits for the exchange
     * @returns {object} a [ticker structure]{@link https://docs.ccxt.com/#/?id=ticker-structure}
     */
    async fetchTickerWs(symbol, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const payload = {
            'symbol': market['id'],
        };
        const type = this.getMarketType('fetchTickerWs', market, params);
        if (type !== 'future') {
            throw new errors.BadRequest(this.id + ' fetchTickerWs only supports swap markets');
        }
        const url = this.urls['api']['ws']['ws-api'][type];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        const subscription = {
            'method': this.handleTickerWs,
        };
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'fetchTickerWs', 'returnRateLimits', false);
        payload['returnRateLimits'] = returnRateLimits;
        params = this.omit(params, 'test');
        let method = undefined;
        [method, params] = this.handleOptionAndParams(params, 'fetchTickerWs', 'method', 'ticker.book');
        const message = {
            'id': messageHash,
            'method': method,
            'params': this.signParams(this.extend(payload, params)),
        };
        const ticker = await this.watch(url, messageHash, message, messageHash, subscription);
        return ticker;
    }
    /**
     * @method
     * @name binance#fetchOHLCVWs
     * @description query historical candlestick data containing the open, high, low, and close price, and the volume of a market
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#klines
     * @param {string} symbol unified symbol of the market to query OHLCV data for
     * @param {string} timeframe the length of time each candle represents
     * @param {int} since timestamp in ms of the earliest candle to fetch
     * @param {int} limit the maximum amount of candles to fetch
     * @param {object} params extra parameters specific to the exchange API endpoint
     * @param {int} params.until timestamp in ms of the earliest candle to fetch
     *
     * EXCHANGE SPECIFIC PARAMETERS
     * @param {string} params.timeZone default=0 (UTC)
     * @returns {int[][]} A list of candles ordered as timestamp, open, high, low, close, volume
     */
    async fetchOHLCVWs(symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const marketType = this.getMarketType('fetchOHLCVWs', market, params);
        if (marketType !== 'spot' && marketType !== 'future') {
            throw new errors.BadRequest(this.id + ' fetchOHLCVWs only supports spot or swap markets');
        }
        const url = this.urls['api']['ws']['ws-api'][marketType];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'fetchOHLCVWs', 'returnRateLimits', false);
        const payload = {
            'symbol': this.marketId(symbol),
            'returnRateLimits': returnRateLimits,
            'interval': this.timeframes[timeframe],
        };
        const until = this.safeInteger(params, 'until');
        params = this.omit(params, 'until');
        if (since !== undefined) {
            payload['startTime'] = since;
        }
        if (limit !== undefined) {
            payload['limit'] = limit;
        }
        if (until !== undefined) {
            payload['endTime'] = until;
        }
        const message = {
            'id': messageHash,
            'method': 'klines',
            'params': this.extend(payload, params),
        };
        const subscription = {
            'method': this.handleFetchOHLCV,
        };
        return await this.watch(url, messageHash, message, messageHash, subscription);
    }
    handleFetchOHLCV(client, message) {
        //
        //    {
        //        "id": "1dbbeb56-8eea-466a-8f6e-86bdcfa2fc0b",
        //        "status": 200,
        //        "result": [
        //            [
        //                1655971200000,      // Kline open time
        //                "0.01086000",       // Open price
        //                "0.01086600",       // High price
        //                "0.01083600",       // Low price
        //                "0.01083800",       // Close price
        //                "2290.53800000",    // Volume
        //                1655974799999,      // Kline close time
        //                "24.85074442",      // Quote asset volume
        //                2283,               // Number of trades
        //                "1171.64000000",    // Taker buy base asset volume
        //                "12.71225884",      // Taker buy quote asset volume
        //                "0"                 // Unused field, ignore
        //            ]
        //        ],
        //        "rateLimits": [
        //            {
        //                "rateLimitType": "REQUEST_WEIGHT",
        //                "interval": "MINUTE",
        //                "intervalNum": 1,
        //                "limit": 6000,
        //                "count": 2
        //            }
        //        ]
        //    }
        //
        const result = this.safeList(message, 'result');
        const parsed = this.parseOHLCVs(result);
        // use a reverse lookup in a static map instead
        const messageHash = this.safeString(message, 'id');
        client.resolve(parsed, messageHash);
    }
    /**
     * @method
     * @name binance#watchTicker
     * @description watches a price ticker, a statistical calculation with the information calculated over the past 24 hours for a specific market
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#individual-symbol-mini-ticker-stream
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#all-market-mini-tickers-stream
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Individual-Symbol-Ticker-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/All-Market-Mini-Tickers-Stream
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/All-Market-Mini-Tickers-Stream
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Individual-Symbol-Ticker-Streams
     * @param {string} symbol unified symbol of the market to fetch the ticker for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {string} [params.name] stream to use can be ticker or miniTicker
     * @returns {object} a [ticker structure]{@link https://docs.ccxt.com/#/?id=ticker-structure}
     */
    async watchTicker(symbol, params = {}) {
        await this.loadMarkets();
        symbol = this.symbol(symbol);
        const tickers = await this.watchTickers([symbol], this.extend(params, { 'callerMethodName': 'watchTicker' }));
        return tickers[symbol];
    }
    /**
     * @method
     * @name binance#watchMarkPrice
     * @description watches a mark price for a specific market
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Mark-Price-Stream
     * @param {string} symbol unified symbol of the market to fetch the ticker for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {boolean} [params.use1sFreq] *default is true* if set to true, the mark price will be updated every second, otherwise every 3 seconds
     * @returns {object} a [ticker structure]{@link https://docs.ccxt.com/#/?id=ticker-structure}
     */
    async watchMarkPrice(symbol, params = {}) {
        await this.loadMarkets();
        symbol = this.symbol(symbol);
        const tickers = await this.watchMarkPrices([symbol], this.extend(params, { 'callerMethodName': 'watchMarkPrice' }));
        return tickers[symbol];
    }
    /**
     * @method
     * @name binance#watchMarkPrices
     * @description watches the mark price for all markets
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Mark-Price-Stream-for-All-market
     * @param {string[]} symbols unified symbol of the market to fetch the ticker for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {boolean} [params.use1sFreq] *default is true* if set to true, the mark price will be updated every second, otherwise every 3 seconds
     * @returns {object} a [ticker structure]{@link https://docs.ccxt.com/#/?id=ticker-structure}
     */
    async watchMarkPrices(symbols = undefined, params = {}) {
        let channelName = undefined;
        // for now watchmarkPrice uses the same messageHash as watchTicker
        // so it's impossible to watch both at the same time
        // refactor this to use different messageHashes
        [channelName, params] = this.handleOptionAndParams(params, 'watchMarkPrices', 'name', 'markPrice');
        const newTickers = await this.watchMultiTickerHelper('watchMarkPrices', channelName, symbols, params);
        if (this.newUpdates) {
            return newTickers;
        }
        return this.filterByArray(this.tickers, 'symbol', symbols);
    }
    /**
     * @method
     * @name binance#watchTickers
     * @description watches a price ticker, a statistical calculation with the information calculated over the past 24 hours for all markets of a specific list
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#individual-symbol-mini-ticker-stream
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#all-market-mini-tickers-stream
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Individual-Symbol-Ticker-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/All-Market-Mini-Tickers-Stream
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/All-Market-Mini-Tickers-Stream
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Individual-Symbol-Ticker-Streams
     * @param {string[]} symbols unified symbol of the market to fetch the ticker for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} a [ticker structure]{@link https://docs.ccxt.com/#/?id=ticker-structure}
     */
    async watchTickers(symbols = undefined, params = {}) {
        let channelName = undefined;
        [channelName, params] = this.handleOptionAndParams(params, 'watchTickers', 'name', 'ticker');
        if (channelName === 'bookTicker') {
            throw new errors.BadRequest(this.id + ' deprecation notice - to subscribe for bids-asks, use watch_bids_asks() method instead');
        }
        const newTickers = await this.watchMultiTickerHelper('watchTickers', channelName, symbols, params);
        if (this.newUpdates) {
            return newTickers;
        }
        return this.filterByArray(this.tickers, 'symbol', symbols);
    }
    /**
     * @method
     * @name binance#unWatchTickers
     * @description unWatches a price ticker, a statistical calculation with the information calculated over the past 24 hours for all markets of a specific list
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#individual-symbol-mini-ticker-stream
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#all-market-mini-tickers-stream
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Individual-Symbol-Ticker-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/All-Market-Mini-Tickers-Stream
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/All-Market-Mini-Tickers-Stream
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Individual-Symbol-Ticker-Streams
     * @param {string[]} symbols unified symbol of the market to fetch the ticker for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} a [ticker structure]{@link https://docs.ccxt.com/#/?id=ticker-structure}
     */
    async unWatchTickers(symbols = undefined, params = {}) {
        let channelName = undefined;
        [channelName, params] = this.handleOptionAndParams(params, 'watchTickers', 'name', 'ticker');
        if (channelName === 'bookTicker') {
            throw new errors.BadRequest(this.id + ' deprecation notice - to subscribe for bids-asks, use watch_bids_asks() method instead');
        }
        await this.loadMarkets();
        const methodName = 'watchTickers';
        symbols = this.marketSymbols(symbols, undefined, true, false, true);
        let firstMarket = undefined;
        let marketType = undefined;
        const symbolsDefined = (symbols !== undefined);
        if (symbolsDefined) {
            firstMarket = this.market(symbols[0]);
        }
        [marketType, params] = this.handleMarketTypeAndParams(methodName, firstMarket, params);
        let subType = undefined;
        [subType, params] = this.handleSubTypeAndParams(methodName, firstMarket, params);
        let rawMarketType = undefined;
        if (this.isLinear(marketType, subType)) {
            rawMarketType = 'future';
        }
        else if (this.isInverse(marketType, subType)) {
            rawMarketType = 'delivery';
        }
        else if (marketType === 'spot') {
            rawMarketType = marketType;
        }
        else {
            throw new errors.NotSupported(this.id + ' ' + methodName + '() does not support options markets');
        }
        const isBidAsk = (channelName === 'bookTicker');
        const subscriptionArgs = [];
        const subMessageHashes = [];
        if (symbolsDefined) {
            for (let i = 0; i < symbols.length; i++) {
                const symbol = symbols[i];
                const market = this.market(symbol);
                subscriptionArgs.push(market['lowercaseId'] + '@' + channelName);
                subMessageHashes.push(this.getMessageHash(channelName, market['symbol'], isBidAsk));
            }
        }
        else {
            if (isBidAsk) {
                if (marketType === 'spot') {
                    throw new errors.ArgumentsRequired(this.id + ' ' + methodName + '() requires symbols for this channel for spot markets');
                }
                subscriptionArgs.push('!' + channelName);
            }
            else {
                subscriptionArgs.push('!' + channelName + '@arr');
            }
            subMessageHashes.push(this.getMessageHash(channelName, undefined, isBidAsk));
        }
        let streamHash = channelName;
        if (symbolsDefined) {
            streamHash = channelName + '::' + symbols.join(',');
        }
        const url = this.urls['api']['ws'][rawMarketType] + '/' + this.stream(rawMarketType, streamHash);
        const requestId = this.requestId(url);
        const request = {
            'method': 'UNSUBSCRIBE',
            'params': subscriptionArgs,
            'id': requestId,
        };
        const subscription = {
            'unsubscribe': true,
            'id': requestId.toString(),
            'subMessageHashes': subMessageHashes,
            'messageHashes': subMessageHashes,
            'symbols': symbols,
            'topic': 'ticker',
        };
        return await this.watchMultiple(url, subMessageHashes, this.extend(request, params), subMessageHashes, subscription);
    }
    /**
     * @method
     * @name binance#unWatchTicker
     * @description unWatches a price ticker, a statistical calculation with the information calculated over the past 24 hours for all markets of a specific list
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#individual-symbol-mini-ticker-stream
     * @see https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#all-market-mini-tickers-stream
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Individual-Symbol-Ticker-Streams
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/All-Market-Mini-Tickers-Stream
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/All-Market-Mini-Tickers-Stream
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/Individual-Symbol-Ticker-Streams
     * @param {string} symbol unified symbol of the market to fetch the ticker for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} a [ticker structure]{@link https://docs.ccxt.com/#/?id=ticker-structure}
     */
    async unWatchTicker(symbol, params = {}) {
        return await this.unWatchTickers([symbol], params);
    }
    /**
     * @method
     * @name binance#watchBidsAsks
     * @description watches best bid & ask for symbols
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#symbol-order-book-ticker
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/websocket-market-streams/All-Book-Tickers-Stream
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/All-Book-Tickers-Stream
     * @param {string[]} symbols unified symbol of the market to fetch the ticker for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} a [ticker structure]{@link https://docs.ccxt.com/#/?id=ticker-structure}
     */
    async watchBidsAsks(symbols = undefined, params = {}) {
        await this.loadMarkets();
        symbols = this.marketSymbols(symbols, undefined, true, false, true);
        const result = await this.watchMultiTickerHelper('watchBidsAsks', 'bookTicker', symbols, params);
        if (this.newUpdates) {
            return result;
        }
        return this.filterByArray(this.bidsasks, 'symbol', symbols);
    }
    async watchMultiTickerHelper(methodName, channelName, symbols = undefined, params = {}) {
        await this.loadMarkets();
        symbols = this.marketSymbols(symbols, undefined, true, false, true);
        const isBidAsk = (channelName === 'bookTicker');
        const isMarkPrice = (channelName === 'markPrice');
        const use1sFreq = this.safeBool(params, 'use1sFreq', true);
        let firstMarket = undefined;
        let marketType = undefined;
        const symbolsDefined = (symbols !== undefined);
        if (symbolsDefined) {
            firstMarket = this.market(symbols[0]);
        }
        const defaultMarket = (isMarkPrice) ? 'swap' : undefined;
        [marketType, params] = this.handleMarketTypeAndParams(methodName, firstMarket, params, defaultMarket);
        let subType = undefined;
        [subType, params] = this.handleSubTypeAndParams(methodName, firstMarket, params);
        let rawMarketType = undefined;
        if (this.isLinear(marketType, subType)) {
            rawMarketType = 'future';
        }
        else if (this.isInverse(marketType, subType)) {
            rawMarketType = 'delivery';
        }
        else if (marketType === 'spot') {
            rawMarketType = marketType;
        }
        else {
            throw new errors.NotSupported(this.id + ' ' + methodName + '() does not support options markets');
        }
        const subscriptionArgs = [];
        const messageHashes = [];
        let suffix = '';
        if (isMarkPrice) {
            suffix = (use1sFreq) ? '@1s' : '';
        }
        if (symbolsDefined) {
            for (let i = 0; i < symbols.length; i++) {
                const symbol = symbols[i];
                const market = this.market(symbol);
                subscriptionArgs.push(market['lowercaseId'] + '@' + channelName + suffix);
                messageHashes.push(this.getMessageHash(channelName, market['symbol'], isBidAsk));
            }
        }
        else {
            if (isBidAsk) {
                if (marketType === 'spot') {
                    throw new errors.ArgumentsRequired(this.id + ' ' + methodName + '() requires symbols for this channel for spot markets');
                }
                subscriptionArgs.push('!' + channelName);
            }
            else if (isMarkPrice) {
                subscriptionArgs.push('!' + channelName + '@arr' + suffix);
            }
            else {
                subscriptionArgs.push('!' + channelName + '@arr');
            }
            messageHashes.push(this.getMessageHash(channelName, undefined, isBidAsk));
        }
        let streamHash = channelName;
        if (symbolsDefined) {
            streamHash = channelName + '::' + symbols.join(',');
        }
        const url = this.urls['api']['ws'][rawMarketType] + '/' + this.stream(rawMarketType, streamHash);
        const requestId = this.requestId(url);
        const request = {
            'method': 'SUBSCRIBE',
            'params': subscriptionArgs,
            'id': requestId,
        };
        const subscribe = {
            'id': requestId,
        };
        const result = await this.watchMultiple(url, messageHashes, this.deepExtend(request, params), subscriptionArgs, subscribe);
        // for efficiency, we have two type of returned structure here - if symbols array was provided, then individual
        // ticker dict comes in, otherwise all-tickers dict comes in
        if (!symbolsDefined) {
            return result;
        }
        else {
            const newDict = {};
            newDict[result['symbol']] = result;
            return newDict;
        }
    }
    parseWsTicker(message, marketType) {
        // markPrice
        //   {
        //       "e": "markPriceUpdate",   // Event type
        //       "E": 1562305380000,       // Event time
        //       "s": "BTCUSDT",           // Symbol
        //       "p": "11794.15000000",    // Mark price
        //       "i": "11784.62659091",    // Index price
        //       "P": "11784.25641265",    // Estimated Settle Price, only useful in the last hour before the settlement starts
        //       "r": "0.00038167",        // Funding rate
        //       "T": 1562306400000        // Next funding time
        //   }
        //
        // ticker
        //     {
        //         "e": "24hrTicker",      // event type
        //         "E": 1579485598569,     // event time
        //         "s": "ETHBTC",          // symbol
        //         "p": "-0.00004000",     // price change
        //         "P": "-0.209",          // price change percent
        //         "w": "0.01920495",      // weighted average price
        //         "x": "0.01916500",      // the price of the first trade before the 24hr rolling window
        //         "c": "0.01912500",      // last (closing) price
        //         "Q": "0.10400000",      // last quantity
        //         "b": "0.01912200",      // best bid
        //         "B": "4.10400000",      // best bid quantity
        //         "a": "0.01912500",      // best ask
        //         "A": "0.00100000",      // best ask quantity
        //         "o": "0.01916500",      // open price
        //         "h": "0.01956500",      // high price
        //         "l": "0.01887700",      // low price
        //         "v": "173518.11900000", // base volume
        //         "q": "3332.40703994",   // quote volume
        //         "O": 1579399197842,     // open time
        //         "C": 1579485597842,     // close time
        //         "F": 158251292,         // first trade id
        //         "L": 158414513,         // last trade id
        //         "n": 163222,            // total number of trades
        //     }
        //
        // miniTicker
        //     {
        //         "e": "24hrMiniTicker",
        //         "E": 1671617114585,
        //         "s": "MOBBUSD",
        //         "c": "0.95900000",
        //         "o": "0.91200000",
        //         "h": "1.04000000",
        //         "l": "0.89400000",
        //         "v": "2109995.32000000",
        //         "q": "2019254.05788000"
        //     }
        // fetchTickerWs
        //     {
        //         "symbol":"BTCUSDT",
        //         "price":"72606.70",
        //         "time":1712526204284
        //     }
        // fetchTickerWs - ticker.book
        //     {
        //         "lastUpdateId":1027024,
        //         "symbol":"BTCUSDT",
        //         "bidPrice":"4.00000000",
        //         "bidQty":"431.00000000",
        //         "askPrice":"4.00000200",
        //         "askQty":"9.00000000",
        //         "time":1589437530011,
        //      }
        //
        const marketId = this.safeString2(message, 's', 'symbol');
        const symbol = this.safeSymbol(marketId, undefined, undefined, marketType);
        let event = this.safeString(message, 'e', 'bookTicker');
        if (event === '24hrTicker') {
            event = 'ticker';
        }
        if (event === 'markPriceUpdate') {
            // handle this separately because some fields clash with the ticker fields
            return this.safeTicker({
                'symbol': symbol,
                'timestamp': this.safeInteger(message, 'E'),
                'datetime': this.iso8601(this.safeInteger(message, 'E')),
                'info': message,
                'markPrice': this.safeString(message, 'p'),
                'indexPrice': this.safeString(message, 'i'),
            });
        }
        let timestamp = undefined;
        if (event === 'bookTicker') {
            // take the event timestamp, if available, for spot tickers it is not
            timestamp = this.safeInteger2(message, 'E', 'time');
        }
        else {
            // take the timestamp of the closing price for candlestick streams
            timestamp = this.safeIntegerN(message, ['C', 'E', 'time']);
        }
        const market = this.safeMarket(marketId, undefined, undefined, marketType);
        const last = this.safeString2(message, 'c', 'price');
        return this.safeTicker({
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'high': this.safeString(message, 'h'),
            'low': this.safeString(message, 'l'),
            'bid': this.safeString2(message, 'b', 'bidPrice'),
            'bidVolume': this.safeString2(message, 'B', 'bidQty'),
            'ask': this.safeString2(message, 'a', 'askPrice'),
            'askVolume': this.safeString2(message, 'A', 'askQty'),
            'vwap': this.safeString(message, 'w'),
            'open': this.safeString(message, 'o'),
            'close': last,
            'last': last,
            'previousClose': this.safeString(message, 'x'),
            'change': this.safeString(message, 'p'),
            'percentage': this.safeString(message, 'P'),
            'average': undefined,
            'baseVolume': this.safeString(message, 'v'),
            'quoteVolume': this.safeString(message, 'q'),
            'info': message,
        }, market);
    }
    handleTickerWs(client, message) {
        //
        // ticker.price
        //    {
        //        "id":"1",
        //        "status":200,
        //        "result":{
        //            "symbol":"BTCUSDT",
        //            "price":"73178.50",
        //            "time":1712527052374
        //        }
        //    }
        // ticker.book
        //    {
        //        "id":"9d32157c-a556-4d27-9866-66760a174b57",
        //        "status":200,
        //        "result":{
        //            "lastUpdateId":1027024,
        //            "symbol":"BTCUSDT",
        //            "bidPrice":"4.00000000",
        //            "bidQty":"431.00000000",
        //            "askPrice":"4.00000200",
        //            "askQty":"9.00000000",
        //            "time":1589437530011   // Transaction time
        //        }
        //    }
        //
        const messageHash = this.safeString(message, 'id');
        const result = this.safeValue(message, 'result', {});
        const ticker = this.parseWsTicker(result, 'future');
        client.resolve(ticker, messageHash);
    }
    handleBidsAsks(client, message) {
        //
        // arrives one symbol dict or array of symbol dicts
        //
        //     {
        //         "u": 7488717758,
        //         "s": "BTCUSDT",
        //         "b": "28621.74000000",
        //         "B": "1.43278800",
        //         "a": "28621.75000000",
        //         "A": "2.52500800"
        //     }
        //
        this.handleTickersAndBidsAsks(client, message, 'bidasks');
    }
    handleTickers(client, message) {
        //
        // arrives one symbol dict or array of symbol dicts
        //
        //     {
        //         "e": "24hrTicker",      // event type
        //         "E": 1579485598569,     // event time
        //         "s": "ETHBTC",          // symbol
        //         "p": "-0.00004000",     // price change
        //         "P": "-0.209",          // price change percent
        //         "w": "0.01920495",      // weighted average price
        //         "x": "0.01916500",      // the price of the first trade before the 24hr rolling window
        //         "c": "0.01912500",      // last (closing) price
        //         "Q": "0.10400000",      // last quantity
        //         "b": "0.01912200",      // best bid
        //         "B": "4.10400000",      // best bid quantity
        //         "a": "0.01912500",      // best ask
        //         "A": "0.00100000",      // best ask quantity
        //         "o": "0.01916500",      // open price
        //         "h": "0.01956500",      // high price
        //         "l": "0.01887700",      // low price
        //         "v": "173518.11900000", // base volume
        //         "q": "3332.40703994",   // quote volume
        //         "O": 1579399197842,     // open time
        //         "C": 1579485597842,     // close time
        //         "F": 158251292,         // first trade id
        //         "L": 158414513,         // last trade id
        //         "n": 163222,            // total number of trades
        //     }
        //
        this.handleTickersAndBidsAsks(client, message, 'tickers');
    }
    handleTickersAndBidsAsks(client, message, methodType) {
        const isSpot = (client.url.indexOf('/stream') > -1);
        const marketType = (isSpot) ? 'spot' : 'contract';
        const isBidAsk = (methodType === 'bidasks');
        let channelName = undefined;
        const resolvedMessageHashes = [];
        let rawTickers = [];
        const newTickers = {};
        if (Array.isArray(message)) {
            rawTickers = message;
        }
        else {
            rawTickers.push(message);
        }
        for (let i = 0; i < rawTickers.length; i++) {
            const ticker = rawTickers[i];
            let event = this.safeString(ticker, 'e');
            if (isBidAsk) {
                event = 'bookTicker'; // as noted in `handleMessage`, bookTicker doesn't have identifier, so manually set here
            }
            channelName = this.safeString(this.options['tickerChannelsMap'], event, event);
            if (channelName === undefined) {
                continue;
            }
            const parsedTicker = this.parseWsTicker(ticker, marketType);
            const symbol = parsedTicker['symbol'];
            newTickers[symbol] = parsedTicker;
            if (isBidAsk) {
                this.bidsasks[symbol] = parsedTicker;
            }
            else {
                this.tickers[symbol] = parsedTicker;
            }
            const messageHash = this.getMessageHash(channelName, symbol, isBidAsk);
            resolvedMessageHashes.push(messageHash);
            client.resolve(parsedTicker, messageHash);
        }
        // resolve batch endpoint
        const length = resolvedMessageHashes.length;
        if (length > 0) {
            const batchMessageHash = this.getMessageHash(channelName, undefined, isBidAsk);
            client.resolve(newTickers, batchMessageHash);
        }
    }
    getMessageHash(channelName, symbol, isBidAsk) {
        const prefix = isBidAsk ? 'bidask' : 'ticker';
        if (symbol !== undefined) {
            return prefix + ':' + channelName + '@' + symbol;
        }
        else {
            return prefix + 's' + ':' + channelName;
        }
    }
    signParams(params = {}) {
        this.checkRequiredCredentials();
        let extendedParams = this.extend({
            'timestamp': this.nonce(),
            'apiKey': this.apiKey,
        }, params);
        const defaultRecvWindow = this.safeInteger(this.options, 'recvWindow');
        if (defaultRecvWindow !== undefined) {
            params['recvWindow'] = defaultRecvWindow;
        }
        const recvWindow = this.safeInteger(params, 'recvWindow');
        if (recvWindow !== undefined) {
            params['recvWindow'] = recvWindow;
        }
        extendedParams = this.keysort(extendedParams);
        const query = this.urlencode(extendedParams);
        let signature = undefined;
        if (this.secret.indexOf('PRIVATE KEY') > -1) {
            if (this.secret.length > 120) {
                signature = rsa.rsa(query, this.secret, sha256.sha256);
            }
            else {
                signature = crypto.eddsa(this.encode(query), this.secret, ed25519.ed25519);
            }
        }
        else {
            signature = this.hmac(this.encode(query), this.encode(this.secret), sha256.sha256);
        }
        extendedParams['signature'] = signature;
        return extendedParams;
    }
    async authenticate(params = {}) {
        const time = this.milliseconds();
        let type = undefined;
        [type, params] = this.handleMarketTypeAndParams('authenticate', undefined, params);
        let subType = undefined;
        [subType, params] = this.handleSubTypeAndParams('authenticate', undefined, params);
        let isPortfolioMargin = undefined;
        [isPortfolioMargin, params] = this.handleOptionAndParams2(params, 'authenticate', 'papi', 'portfolioMargin', false);
        if (this.isLinear(type, subType)) {
            type = 'future';
        }
        else if (this.isInverse(type, subType)) {
            type = 'delivery';
        }
        let marginMode = undefined;
        [marginMode, params] = this.handleMarginModeAndParams('authenticate', params);
        const isIsolatedMargin = (marginMode === 'isolated');
        const isCrossMargin = (marginMode === 'cross') || (marginMode === undefined);
        const symbol = this.safeString(params, 'symbol');
        params = this.omit(params, 'symbol');
        const options = this.safeValue(this.options, type, {});
        const lastAuthenticatedTime = this.safeInteger(options, 'lastAuthenticatedTime', 0);
        const listenKeyRefreshRate = this.safeInteger(this.options, 'listenKeyRefreshRate', 1200000);
        const delay = this.sum(listenKeyRefreshRate, 10000);
        if (time - lastAuthenticatedTime > delay) {
            let response = undefined;
            if (isPortfolioMargin) {
                response = await this.papiPostListenKey(params);
                params = this.extend(params, { 'portfolioMargin': true });
            }
            else if (type === 'future') {
                response = await this.fapiPrivatePostListenKey(params);
            }
            else if (type === 'delivery') {
                response = await this.dapiPrivatePostListenKey(params);
            }
            else if (type === 'margin' && isCrossMargin) {
                response = await this.sapiPostUserDataStream(params);
            }
            else if (isIsolatedMargin) {
                if (symbol === undefined) {
                    throw new errors.ArgumentsRequired(this.id + ' authenticate() requires a symbol argument for isolated margin mode');
                }
                const marketId = this.marketId(symbol);
                params = this.extend(params, { 'symbol': marketId });
                response = await this.sapiPostUserDataStreamIsolated(params);
            }
            else {
                response = await this.publicPostUserDataStream(params);
            }
            this.options[type] = this.extend(options, {
                'listenKey': this.safeString(response, 'listenKey'),
                'lastAuthenticatedTime': time,
            });
            this.delay(listenKeyRefreshRate, this.keepAliveListenKey, params);
        }
    }
    async keepAliveListenKey(params = {}) {
        // https://binance-docs.github.io/apidocs/spot/en/#listen-key-spot
        let type = this.safeString2(this.options, 'defaultType', 'authenticate', 'spot');
        type = this.safeString(params, 'type', type);
        let isPortfolioMargin = undefined;
        [isPortfolioMargin, params] = this.handleOptionAndParams2(params, 'keepAliveListenKey', 'papi', 'portfolioMargin', false);
        const subTypeInfo = this.handleSubTypeAndParams('keepAliveListenKey', undefined, params);
        const subType = subTypeInfo[0];
        if (this.isLinear(type, subType)) {
            type = 'future';
        }
        else if (this.isInverse(type, subType)) {
            type = 'delivery';
        }
        const options = this.safeValue(this.options, type, {});
        const listenKey = this.safeString(options, 'listenKey');
        if (listenKey === undefined) {
            // A network error happened: we can't renew a listen key that does not exist.
            return;
        }
        const request = {};
        const symbol = this.safeString(params, 'symbol');
        params = this.omit(params, ['type', 'symbol']);
        const time = this.milliseconds();
        try {
            if (isPortfolioMargin) {
                await this.papiPutListenKey(this.extend(request, params));
                params = this.extend(params, { 'portfolioMargin': true });
            }
            else if (type === 'future') {
                await this.fapiPrivatePutListenKey(this.extend(request, params));
            }
            else if (type === 'delivery') {
                await this.dapiPrivatePutListenKey(this.extend(request, params));
            }
            else {
                request['listenKey'] = listenKey;
                if (type === 'margin') {
                    request['symbol'] = symbol;
                    await this.sapiPutUserDataStream(this.extend(request, params));
                }
                else {
                    await this.publicPutUserDataStream(this.extend(request, params));
                }
            }
        }
        catch (error) {
            let urlType = type;
            if (isPortfolioMargin) {
                urlType = 'papi';
            }
            const url = this.urls['api']['ws'][urlType] + '/' + this.options[type]['listenKey'];
            const client = this.client(url);
            const messageHashes = Object.keys(client.futures);
            for (let i = 0; i < messageHashes.length; i++) {
                const messageHash = messageHashes[i];
                client.reject(error, messageHash);
            }
            this.options[type] = this.extend(options, {
                'listenKey': undefined,
                'lastAuthenticatedTime': 0,
            });
            return;
        }
        this.options[type] = this.extend(options, {
            'listenKey': listenKey,
            'lastAuthenticatedTime': time,
        });
        // whether or not to schedule another listenKey keepAlive request
        const clients = Object.values(this.clients);
        const listenKeyRefreshRate = this.safeInteger(this.options, 'listenKeyRefreshRate', 1200000);
        for (let i = 0; i < clients.length; i++) {
            const client = clients[i];
            const subscriptionKeys = Object.keys(client.subscriptions);
            for (let j = 0; j < subscriptionKeys.length; j++) {
                const subscribeType = subscriptionKeys[j];
                if (subscribeType === type) {
                    this.delay(listenKeyRefreshRate, this.keepAliveListenKey, params);
                    return;
                }
            }
        }
    }
    setBalanceCache(client, type, isPortfolioMargin = false) {
        if (type in client.subscriptions) {
            return;
        }
        const options = this.safeValue(this.options, 'watchBalance');
        const fetchBalanceSnapshot = this.safeBool(options, 'fetchBalanceSnapshot', false);
        if (fetchBalanceSnapshot) {
            const messageHash = type + ':fetchBalanceSnapshot';
            if (!(messageHash in client.futures)) {
                client.future(messageHash);
                this.spawn(this.loadBalanceSnapshot, client, messageHash, type, isPortfolioMargin);
            }
        }
        else {
            this.balance[type] = {};
        }
    }
    async loadBalanceSnapshot(client, messageHash, type, isPortfolioMargin) {
        const params = {
            'type': type,
        };
        if (isPortfolioMargin) {
            params['portfolioMargin'] = true;
        }
        const response = await this.fetchBalance(params);
        this.balance[type] = this.extend(response, this.safeValue(this.balance, type, {}));
        // don't remove the future from the .futures cache
        const future = client.futures[messageHash];
        future.resolve();
        client.resolve(this.balance[type], type + ':balance');
    }
    /**
     * @method
     * @name binance#fetchBalanceWs
     * @description fetch balance and get the amount of funds available for trading or funds locked in orders
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/account/websocket-api/Futures-Account-Balance
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/account-requests#account-information-user_data
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/account/websocket-api
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {string|undefined} [params.type] 'future', 'delivery', 'savings', 'funding', or 'spot'
     * @param {string|undefined} [params.marginMode] 'cross' or 'isolated', for margin trading, uses this.options.defaultMarginMode if not passed, defaults to undefined/None/null
     * @param {string[]|undefined} [params.symbols] unified market symbols, only used in isolated margin mode
     * @param {string|undefined} [params.method] method to use. Can be account.balance, account.status, v2/account.balance or v2/account.status
     * @returns {object} a [balance structure]{@link https://docs.ccxt.com/#/?id=balance-structure}
     */
    async fetchBalanceWs(params = {}) {
        await this.loadMarkets();
        const type = this.getMarketType('fetchBalanceWs', undefined, params);
        if (type !== 'spot' && type !== 'future' && type !== 'delivery') {
            throw new errors.BadRequest(this.id + ' fetchBalanceWs only supports spot or swap markets');
        }
        const url = this.urls['api']['ws']['ws-api'][type];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'fetchBalanceWs', 'returnRateLimits', false);
        const payload = {
            'returnRateLimits': returnRateLimits,
        };
        let method = undefined;
        [method, params] = this.handleOptionAndParams(params, 'fetchBalanceWs', 'method', 'account.status');
        const message = {
            'id': messageHash,
            'method': method,
            'params': this.signParams(this.extend(payload, params)),
        };
        const subscription = {
            'method': (method === 'account.status') ? this.handleAccountStatusWs : this.handleBalanceWs,
        };
        return await this.watch(url, messageHash, message, messageHash, subscription);
    }
    handleBalanceWs(client, message) {
        //
        //
        const messageHash = this.safeString(message, 'id');
        let rawBalance = undefined;
        if (Array.isArray(message['result'])) {
            // account.balance
            rawBalance = this.safeList(message, 'result', []);
        }
        else {
            // account.status
            const result = this.safeDict(message, 'result', {});
            rawBalance = this.safeList(result, 'assets', []);
        }
        const parsedBalances = this.parseBalanceCustom(rawBalance);
        client.resolve(parsedBalances, messageHash);
    }
    handleAccountStatusWs(client, message) {
        //
        // spot
        //    {
        //        "id": "605a6d20-6588-4cb9-afa0-b0ab087507ba",
        //        "status": 200,
        //        "result": {
        //            "makerCommission": 15,
        //            "takerCommission": 15,
        //            "buyerCommission": 0,
        //            "sellerCommission": 0,
        //            "canTrade": true,
        //            "canWithdraw": true,
        //            "canDeposit": true,
        //            "commissionRates": {
        //                "maker": "0.00150000",
        //                "taker": "0.00150000",
        //                "buyer": "0.00000000",
        //                "seller": "0.00000000"
        //            },
        //            "brokered": false,
        //            "requireSelfTradePrevention": false,
        //            "updateTime": 1660801833000,
        //            "accountType": "SPOT",
        //            "balances": [{
        //                    "asset": "BNB",
        //                    "free": "0.00000000",
        //                    "locked": "0.00000000"
        //                },
        //                {
        //                    "asset": "BTC",
        //                    "free": "1.3447112",
        //                    "locked": "0.08600000"
        //                },
        //                {
        //                    "asset": "USDT",
        //                    "free": "1021.21000000",
        //                    "locked": "0.00000000"
        //                }
        //            ],
        //            "permissions": [
        //                "SPOT"
        //            ]
        //        }
        //    }
        // swap
        //
        const messageHash = this.safeString(message, 'id');
        const result = this.safeDict(message, 'result', {});
        const parsedBalances = this.parseBalanceCustom(result);
        client.resolve(parsedBalances, messageHash);
    }
    /**
     * @method
     * @name binance#fetchPositionWs
     * @description fetch data on an open position
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/websocket-api/Position-Information
     * @param {string} symbol unified market symbol of the market the position is held in
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} a [position structure]{@link https://docs.ccxt.com/#/?id=position-structure}
     */
    async fetchPositionWs(symbol, params = {}) {
        return await this.fetchPositionsWs([symbol], params);
    }
    /**
     * @method
     * @name binance#fetchPositionsWs
     * @description fetch all open positions
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/websocket-api/Position-Information
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/trade/websocket-api/Position-Information
     * @param {string[]} [symbols] list of unified market symbols
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {boolean} [params.returnRateLimits] set to true to return rate limit informations, defaults to false.
     * @param {string|undefined} [params.method] method to use. Can be account.position or v2/account.position
     * @returns {object[]} a list of [position structure]{@link https://docs.ccxt.com/#/?id=position-structure}
     */
    async fetchPositionsWs(symbols = undefined, params = {}) {
        await this.loadMarkets();
        const payload = {};
        let market = undefined;
        symbols = this.marketSymbols(symbols, 'swap', true, true, true);
        if (symbols !== undefined) {
            const symbolsLength = symbols.length;
            if (symbolsLength === 1) {
                market = this.market(symbols[0]);
                payload['symbol'] = market['id'];
            }
        }
        const type = this.getMarketType('fetchPositionsWs', market, params);
        if (type !== 'future' && type !== 'delivery') {
            throw new errors.BadRequest(this.id + ' fetchPositionsWs only supports swap markets');
        }
        const url = this.urls['api']['ws']['ws-api'][type];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'fetchPositionsWs', 'returnRateLimits', false);
        payload['returnRateLimits'] = returnRateLimits;
        let method = undefined;
        [method, params] = this.handleOptionAndParams(params, 'fetchPositionsWs', 'method', 'account.position');
        const message = {
            'id': messageHash,
            'method': method,
            'params': this.signParams(this.extend(payload, params)),
        };
        const subscription = {
            'method': this.handlePositionsWs,
        };
        const result = await this.watch(url, messageHash, message, messageHash, subscription);
        return this.filterByArrayPositions(result, 'symbol', symbols, false);
    }
    handlePositionsWs(client, message) {
        //
        //    {
        //        id: '1',
        //        status: 200,
        //        result: [
        //            {
        //                symbol: 'BTCUSDT',
        //                positionAmt: '-0.014',
        //                entryPrice: '42901.1',
        //                breakEvenPrice: '30138.83333142',
        //                markPrice: '71055.98470333',
        //                unRealizedProfit: '-394.16838584',
        //                liquidationPrice: '137032.02272908',
        //                leverage: '123',
        //                maxNotionalValue: '50000',
        //                marginType: 'cross',
        //                isolatedMargin: '0.00000000',
        //                isAutoAddMargin: 'false',
        //                positionSide: 'BOTH',
        //                notional: '-994.78378584',
        //                isolatedWallet: '0',
        //                updateTime: 1708906343111,
        //                isolated: false,
        //                adlQuantile: 2
        //            },
        //            ...
        //        ]
        //    }
        //
        //
        const messageHash = this.safeString(message, 'id');
        const result = this.safeList(message, 'result', []);
        const positions = [];
        for (let i = 0; i < result.length; i++) {
            const parsed = this.parsePositionRisk(result[i]);
            const entryPrice = this.safeString(parsed, 'entryPrice');
            if ((entryPrice !== '0') && (entryPrice !== '0.0') && (entryPrice !== '0.00000000')) {
                positions.push(parsed);
            }
        }
        client.resolve(positions, messageHash);
    }
    /**
     * @method
     * @name binance#watchBalance
     * @description watch balance and get the amount of funds available for trading or funds locked in orders
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {boolean} [params.portfolioMargin] set to true if you would like to watch the balance of a portfolio margin account
     * @returns {object} a [balance structure]{@link https://docs.ccxt.com/#/?id=balance-structure}
     */
    async watchBalance(params = {}) {
        await this.loadMarkets();
        await this.authenticate(params);
        const defaultType = this.safeString(this.options, 'defaultType', 'spot');
        let type = this.safeString(params, 'type', defaultType);
        let subType = undefined;
        [subType, params] = this.handleSubTypeAndParams('watchBalance', undefined, params);
        let isPortfolioMargin = undefined;
        [isPortfolioMargin, params] = this.handleOptionAndParams2(params, 'watchBalance', 'papi', 'portfolioMargin', false);
        if (this.isLinear(type, subType)) {
            type = 'future';
        }
        else if (this.isInverse(type, subType)) {
            type = 'delivery';
        }
        let urlType = type;
        if (isPortfolioMargin) {
            urlType = 'papi';
        }
        const url = this.urls['api']['ws'][urlType] + '/' + this.options[type]['listenKey'];
        const client = this.client(url);
        this.setBalanceCache(client, type, isPortfolioMargin);
        this.setPositionsCache(client, type, undefined, isPortfolioMargin);
        const options = this.safeDict(this.options, 'watchBalance');
        const fetchBalanceSnapshot = this.safeBool(options, 'fetchBalanceSnapshot', false);
        const awaitBalanceSnapshot = this.safeBool(options, 'awaitBalanceSnapshot', true);
        if (fetchBalanceSnapshot && awaitBalanceSnapshot) {
            await client.future(type + ':fetchBalanceSnapshot');
        }
        const messageHash = type + ':balance';
        const message = undefined;
        return await this.watch(url, messageHash, message, type);
    }
    handleBalance(client, message) {
        //
        // sent upon a balance update not related to orders
        //
        //     {
        //         "e": "balanceUpdate",
        //         "E": 1629352505586,
        //         "a": "IOTX",
        //         "d": "0.43750000",
        //         "T": 1629352505585
        //     }
        //
        // sent upon creating or filling an order
        //
        //     {
        //         "e": "outboundAccountPosition", // Event type
        //         "E": 1564034571105,             // Event Time
        //         "u": 1564034571073,             // Time of last account update
        //         "B": [                          // Balances Array
        //             {
        //                 "a": "ETH",                 // Asset
        //                 "f": "10000.000000",        // Free
        //                 "l": "0.000000"             // Locked
        //             }
        //         ]
        //     }
        //
        // future/delivery
        //
        //     {
        //         "e": "ACCOUNT_UPDATE",            // Event Type
        //         "E": 1564745798939,               // Event Time
        //         "T": 1564745798938 ,              // Transaction
        //         "i": "SfsR",                      // Account Alias
        //         "a": {                            // Update Data
        //             "m":"ORDER",                  // Event reason type
        //             "B":[                         // Balances
        //                 {
        //                     "a":"BTC",                // Asset
        //                     "wb":"122624.12345678",   // Wallet Balance
        //                     "cw":"100.12345678"       // Cross Wallet Balance
        //                 },
        //             ],
        //             "P":[
        //                 {
        //                     "s":"BTCUSD_200925",      // Symbol
        //                     "pa":"0",                 // Position Amount
        //                     "ep":"0.0",               // Entry Price
        //                     "cr":"200",               // (Pre-fee) Accumulated Realized
        //                     "up":"0",                 // Unrealized PnL
        //                     "mt":"isolated",          // Margin Type
        //                     "iw":"0.00000000",        // Isolated Wallet (if isolated position)
        //                     "ps":"BOTH"               // Position Side
        //                 },
        //             ]
        //         }
        //     }
        //
        const wallet = this.safeString(this.options, 'wallet', 'wb'); // cw for cross wallet
        // each account is connected to a different endpoint
        // and has exactly one subscriptionhash which is the account type
        const subscriptions = Object.keys(client.subscriptions);
        const accountType = subscriptions[0];
        const messageHash = accountType + ':balance';
        if (this.balance[accountType] === undefined) {
            this.balance[accountType] = {};
        }
        this.balance[accountType]['info'] = message;
        const event = this.safeString(message, 'e');
        if (event === 'balanceUpdate') {
            const currencyId = this.safeString(message, 'a');
            const code = this.safeCurrencyCode(currencyId);
            const account = this.account();
            const delta = this.safeString(message, 'd');
            if (code in this.balance[accountType]) {
                let previousValue = this.balance[accountType][code]['free'];
                if (typeof previousValue !== 'string') {
                    previousValue = this.numberToString(previousValue);
                }
                account['free'] = Precise["default"].stringAdd(previousValue, delta);
            }
            else {
                account['free'] = delta;
            }
            this.balance[accountType][code] = account;
        }
        else {
            message = this.safeDict(message, 'a', message);
            const B = this.safeList(message, 'B');
            for (let i = 0; i < B.length; i++) {
                const entry = B[i];
                const currencyId = this.safeString(entry, 'a');
                const code = this.safeCurrencyCode(currencyId);
                const account = this.account();
                account['free'] = this.safeString(entry, 'f');
                account['used'] = this.safeString(entry, 'l');
                account['total'] = this.safeString(entry, wallet);
                this.balance[accountType][code] = account;
            }
        }
        const timestamp = this.safeInteger(message, 'E');
        this.balance[accountType]['timestamp'] = timestamp;
        this.balance[accountType]['datetime'] = this.iso8601(timestamp);
        this.balance[accountType] = this.safeBalance(this.balance[accountType]);
        client.resolve(this.balance[accountType], messageHash);
    }
    getMarketType(method, market, params = {}) {
        let type = undefined;
        [type, params] = this.handleMarketTypeAndParams(method, market, params);
        let subType = undefined;
        [subType, params] = this.handleSubTypeAndParams(method, market, params);
        if (this.isLinear(type, subType)) {
            type = 'future';
        }
        else if (this.isInverse(type, subType)) {
            type = 'delivery';
        }
        return type;
    }
    /**
     * @method
     * @name binance#createOrderWs
     * @description create a trade order
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/trading-requests#place-new-order-trade
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/websocket-api/New-Order
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/trade/websocket-api
     * @param {string} symbol unified symbol of the market to create an order in
     * @param {string} type 'market' or 'limit'
     * @param {string} side 'buy' or 'sell'
     * @param {float} amount how much of currency you want to trade in units of base currency
     * @param {float|undefined} [price] the price at which the order is to be fulfilled, in units of the quote currency, ignored in market orders
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {boolean} params.test test order, default false
     * @param {boolean} params.returnRateLimits set to true to return rate limit information, default false
     * @returns {object} an [order structure]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async createOrderWs(symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const marketType = this.getMarketType('createOrderWs', market, params);
        if (marketType !== 'spot' && marketType !== 'future' && marketType !== 'delivery') {
            throw new errors.BadRequest(this.id + ' createOrderWs only supports spot or swap markets');
        }
        const url = this.urls['api']['ws']['ws-api'][marketType];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        const sor = this.safeBool2(params, 'sor', 'SOR', false);
        params = this.omit(params, 'sor', 'SOR');
        const payload = this.createOrderRequest(symbol, type, side, amount, price, params);
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'createOrderWs', 'returnRateLimits', false);
        payload['returnRateLimits'] = returnRateLimits;
        const test = this.safeBool(params, 'test', false);
        params = this.omit(params, 'test');
        const message = {
            'id': messageHash,
            'method': 'order.place',
            'params': this.signParams(this.extend(payload, params)),
        };
        if (test) {
            if (sor) {
                message['method'] = 'sor.order.test';
            }
            else {
                message['method'] = 'order.test';
            }
        }
        const subscription = {
            'method': this.handleOrderWs,
        };
        return await this.watch(url, messageHash, message, messageHash, subscription);
    }
    handleOrderWs(client, message) {
        //
        //    {
        //        "id": 1,
        //        "status": 200,
        //        "result": {
        //          "symbol": "BTCUSDT",
        //          "orderId": 7663053,
        //          "orderListId": -1,
        //          "clientOrderId": "x-R4BD3S82d8959d0f5114499487a614",
        //          "transactTime": 1687642291434,
        //          "price": "25000.00000000",
        //          "origQty": "0.00100000",
        //          "executedQty": "0.00000000",
        //          "cummulativeQuoteQty": "0.00000000",
        //          "status": "NEW",
        //          "timeInForce": "GTC",
        //          "type": "LIMIT",
        //          "side": "BUY",
        //          "workingTime": 1687642291434,
        //          "fills": [],
        //          "selfTradePreventionMode": "NONE"
        //        },
        //        "rateLimits": [
        //          {
        //            "rateLimitType": "ORDERS",
        //            "interval": "SECOND",
        //            "intervalNum": 10,
        //            "limit": 50,
        //            "count": 1
        //          },
        //          {
        //            "rateLimitType": "ORDERS",
        //            "interval": "DAY",
        //            "intervalNum": 1,
        //            "limit": 160000,
        //            "count": 1
        //          },
        //          {
        //            "rateLimitType": "REQUEST_WEIGHT",
        //            "interval": "MINUTE",
        //            "intervalNum": 1,
        //            "limit": 1200,
        //            "count": 12
        //          }
        //        ]
        //    }
        //
        const messageHash = this.safeString(message, 'id');
        const result = this.safeDict(message, 'result', {});
        const order = this.parseOrder(result);
        client.resolve(order, messageHash);
    }
    handleOrdersWs(client, message) {
        //
        //    {
        //        "id": 1,
        //        "status": 200,
        //        "result": [{
        //            "symbol": "BTCUSDT",
        //            "orderId": 7665584,
        //            "orderListId": -1,
        //            "clientOrderId": "x-R4BD3S82b54769abdd3e4b57874c52",
        //            "price": "26000.00000000",
        //            "origQty": "0.00100000",
        //            "executedQty": "0.00000000",
        //            "cummulativeQuoteQty": "0.00000000",
        //            "status": "NEW",
        //            "timeInForce": "GTC",
        //            "type": "LIMIT",
        //            "side": "BUY",
        //            "stopPrice": "0.00000000",
        //            "icebergQty": "0.00000000",
        //            "time": 1687642884646,
        //            "updateTime": 1687642884646,
        //            "isWorking": true,
        //            "workingTime": 1687642884646,
        //            "origQuoteOrderQty": "0.00000000",
        //            "selfTradePreventionMode": "NONE"
        //        },
        //        ...
        //        ],
        //        "rateLimits": [{
        //            "rateLimitType": "REQUEST_WEIGHT",
        //            "interval": "MINUTE",
        //            "intervalNum": 1,
        //            "limit": 1200,
        //            "count": 14
        //        }]
        //    }
        //
        const messageHash = this.safeString(message, 'id');
        const result = this.safeList(message, 'result', []);
        const orders = this.parseOrders(result);
        client.resolve(orders, messageHash);
    }
    /**
     * @method
     * @name binance#editOrderWs
     * @description edit a trade order
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/trading-requests#cancel-and-replace-order-trade
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/websocket-api/Modify-Order
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/trade/websocket-api/Modify-Order
     * @param {string} id order id
     * @param {string} symbol unified symbol of the market to create an order in
     * @param {string} type 'market' or 'limit'
     * @param {string} side 'buy' or 'sell'
     * @param {float} amount how much of the currency you want to trade in units of the base currency
     * @param {float|undefined} [price] the price at which the order is to be fulfilled, in units of the quote currency, ignored in market orders
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} an [order structure]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async editOrderWs(id, symbol, type, side, amount = undefined, price = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const marketType = this.getMarketType('editOrderWs', market, params);
        if (marketType !== 'spot' && marketType !== 'future' && marketType !== 'delivery') {
            throw new errors.BadRequest(this.id + ' editOrderWs only supports spot or swap markets');
        }
        const url = this.urls['api']['ws']['ws-api'][marketType];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        const isSwap = (marketType === 'future' || marketType === 'delivery');
        let payload = undefined;
        if (marketType === 'spot') {
            payload = this.editSpotOrderRequest(id, symbol, type, side, amount, price, params);
        }
        else if (isSwap) {
            payload = this.editContractOrderRequest(id, symbol, type, side, amount, price, params);
        }
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'editOrderWs', 'returnRateLimits', false);
        payload['returnRateLimits'] = returnRateLimits;
        const message = {
            'id': messageHash,
            'method': (isSwap) ? 'order.modify' : 'order.cancelReplace',
            'params': this.signParams(this.extend(payload, params)),
        };
        const subscription = {
            'method': this.handleEditOrderWs,
        };
        return await this.watch(url, messageHash, message, messageHash, subscription);
    }
    handleEditOrderWs(client, message) {
        //
        // spot
        //    {
        //        "id": 1,
        //        "status": 200,
        //        "result": {
        //            "cancelResult": "SUCCESS",
        //            "newOrderResult": "SUCCESS",
        //            "cancelResponse": {
        //                "symbol": "BTCUSDT",
        //                "origClientOrderId": "x-R4BD3S82813c5d7ffa594104917de2",
        //                "orderId": 7665177,
        //                "orderListId": -1,
        //                "clientOrderId": "mbrnbQsQhtCXCLY45d5q7S",
        //                "price": "26000.00000000",
        //                "origQty": "0.00100000",
        //                "executedQty": "0.00000000",
        //                "cummulativeQuoteQty": "0.00000000",
        //                "status": "CANCELED",
        //                "timeInForce": "GTC",
        //                "type": "LIMIT",
        //                "side": "BUY",
        //                "selfTradePreventionMode": "NONE"
        //            },
        //            "newOrderResponse": {
        //                "symbol": "BTCUSDT",
        //                "orderId": 7665584,
        //                "orderListId": -1,
        //                "clientOrderId": "x-R4BD3S82b54769abdd3e4b57874c52",
        //                "transactTime": 1687642884646,
        //                "price": "26000.00000000",
        //                "origQty": "0.00100000",
        //                "executedQty": "0.00000000",
        //                "cummulativeQuoteQty": "0.00000000",
        //                "status": "NEW",
        //                "timeInForce": "GTC",
        //                "type": "LIMIT",
        //                "side": "BUY",
        //                "workingTime": 1687642884646,
        //                "fills": [],
        //                "selfTradePreventionMode": "NONE"
        //            }
        //        },
        //        "rateLimits": [{
        //                "rateLimitType": "ORDERS",
        //                "interval": "SECOND",
        //                "intervalNum": 10,
        //                "limit": 50,
        //                "count": 1
        //            },
        //            {
        //                "rateLimitType": "ORDERS",
        //                "interval": "DAY",
        //                "intervalNum": 1,
        //                "limit": 160000,
        //                "count": 3
        //            },
        //            {
        //                "rateLimitType": "REQUEST_WEIGHT",
        //                "interval": "MINUTE",
        //                "intervalNum": 1,
        //                "limit": 1200,
        //                "count": 12
        //            }
        //        ]
        //    }
        // swap
        //    {
        //        "id":"1",
        //        "status":200,
        //        "result":{
        //            "orderId":667061487,
        //            "symbol":"LTCUSDT",
        //            "status":"NEW",
        //            "clientOrderId":"x-xcKtGhcu91a74c818749ee42c0f70",
        //            "price":"82.00",
        //            "avgPrice":"0.00",
        //            "origQty":"1.000",
        //            "executedQty":"0.000",
        //            "cumQty":"0.000",
        //            "cumQuote":"0.00000",
        //            "timeInForce":"GTC",
        //            "type":"LIMIT",
        //            "reduceOnly":false,
        //            "closePosition":false,
        //            "side":"BUY",
        //            "positionSide":"BOTH",
        //            "stopPrice":"0.00",
        //            "workingType":"CONTRACT_PRICE",
        //            "priceProtect":false,
        //            "origType":"LIMIT",
        //            "priceMatch":"NONE",
        //            "selfTradePreventionMode":"NONE",
        //            "goodTillDate":0,
        //            "updateTime":1712918927511
        //        }
        //    }
        //
        const messageHash = this.safeString(message, 'id');
        const result = this.safeDict(message, 'result', {});
        const newSpotOrder = this.safeDict(result, 'newOrderResponse');
        let order = undefined;
        if (newSpotOrder !== undefined) {
            order = this.parseOrder(newSpotOrder);
        }
        else {
            order = this.parseOrder(result);
        }
        client.resolve(order, messageHash);
    }
    /**
     * @method
     * @name binance#cancelOrderWs
     * @description cancel multiple orders
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/trading-requests#cancel-order-trade
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/websocket-api/Cancel-Order
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/trade/websocket-api/Cancel-Order
     * @param {string} id order id
     * @param {string} [symbol] unified market symbol, default is undefined
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {string|undefined} [params.cancelRestrictions] Supported values: ONLY_NEW - Cancel will succeed if the order status is NEW. ONLY_PARTIALLY_FILLED - Cancel will succeed if order status is PARTIALLY_FILLED.
     * @returns {object} an list of [order structures]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async cancelOrderWs(id, symbol = undefined, params = {}) {
        await this.loadMarkets();
        if (symbol === undefined) {
            throw new errors.BadRequest(this.id + ' cancelOrderWs requires a symbol');
        }
        const market = this.market(symbol);
        const type = this.getMarketType('cancelOrderWs', market, params);
        const url = this.urls['api']['ws']['ws-api'][type];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'cancelOrderWs', 'returnRateLimits', false);
        const payload = {
            'symbol': this.marketId(symbol),
            'returnRateLimits': returnRateLimits,
        };
        const clientOrderId = this.safeString2(params, 'origClientOrderId', 'clientOrderId');
        if (clientOrderId !== undefined) {
            payload['origClientOrderId'] = clientOrderId;
        }
        else {
            payload['orderId'] = this.parseToInt(id);
        }
        params = this.omit(params, ['origClientOrderId', 'clientOrderId']);
        const message = {
            'id': messageHash,
            'method': 'order.cancel',
            'params': this.signParams(this.extend(payload, params)),
        };
        const subscription = {
            'method': this.handleOrderWs,
        };
        return await this.watch(url, messageHash, message, messageHash, subscription);
    }
    /**
     * @method
     * @name binance#cancelAllOrdersWs
     * @description cancel all open orders in a market
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/trading-requests#cancel-open-orders-trade
     * @param {string} [symbol] unified market symbol of the market to cancel orders in
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object[]} a list of [order structures]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async cancelAllOrdersWs(symbol = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const type = this.getMarketType('cancelAllOrdersWs', market, params);
        if (type !== 'spot' && type !== 'future') {
            throw new errors.BadRequest(this.id + ' cancelAllOrdersWs only supports spot or swap markets');
        }
        const url = this.urls['api']['ws']['ws-api'][type];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'cancelAllOrdersWs', 'returnRateLimits', false);
        const payload = {
            'symbol': this.marketId(symbol),
            'returnRateLimits': returnRateLimits,
        };
        const message = {
            'id': messageHash,
            'method': 'order.cancel',
            'params': this.signParams(this.extend(payload, params)),
        };
        const subscription = {
            'method': this.handleOrdersWs,
        };
        return await this.watch(url, messageHash, message, messageHash, subscription);
    }
    /**
     * @method
     * @name binance#fetchOrderWs
     * @description fetches information on an order made by the user
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/trading-requests#query-order-user_data
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/trade/websocket-api/Query-Order
     * @see https://developers.binance.com/docs/derivatives/coin-margined-futures/trade/websocket-api/Query-Order
     * @param {string} id order id
     * @param {string} [symbol] unified symbol of the market the order was made in
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} An [order structure]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async fetchOrderWs(id, symbol = undefined, params = {}) {
        await this.loadMarkets();
        if (symbol === undefined) {
            throw new errors.BadRequest(this.id + ' cancelOrderWs requires a symbol');
        }
        const market = this.market(symbol);
        const type = this.getMarketType('fetchOrderWs', market, params);
        if (type !== 'spot' && type !== 'future' && type !== 'delivery') {
            throw new errors.BadRequest(this.id + ' fetchOrderWs only supports spot or swap markets');
        }
        const url = this.urls['api']['ws']['ws-api'][type];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'fetchOrderWs', 'returnRateLimits', false);
        const payload = {
            'symbol': this.marketId(symbol),
            'returnRateLimits': returnRateLimits,
        };
        const clientOrderId = this.safeString2(params, 'origClientOrderId', 'clientOrderId');
        if (clientOrderId !== undefined) {
            payload['origClientOrderId'] = clientOrderId;
        }
        else {
            payload['orderId'] = this.parseToInt(id);
        }
        const message = {
            'id': messageHash,
            'method': 'order.status',
            'params': this.signParams(this.extend(payload, params)),
        };
        const subscription = {
            'method': this.handleOrderWs,
        };
        return await this.watch(url, messageHash, message, messageHash, subscription);
    }
    /**
     * @method
     * @name binance#fetchOrdersWs
     * @description fetches information on multiple orders made by the user
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/trading-requests#order-lists
     * @param {string} symbol unified market symbol of the market orders were made in
     * @param {int|undefined} [since] the earliest time in ms to fetch orders for
     * @param {int|undefined} [limit] the maximum number of order structures to retrieve
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {int} [params.orderId] order id to begin at
     * @param {int} [params.startTime] earliest time in ms to retrieve orders for
     * @param {int} [params.endTime] latest time in ms to retrieve orders for
     * @param {int} [params.limit] the maximum number of order structures to retrieve
     * @returns {object[]} a list of [order structures]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async fetchOrdersWs(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        if (symbol === undefined) {
            throw new errors.BadRequest(this.id + ' fetchOrdersWs requires a symbol');
        }
        const market = this.market(symbol);
        const type = this.getMarketType('fetchOrdersWs', market, params);
        if (type !== 'spot') {
            throw new errors.BadRequest(this.id + ' fetchOrdersWs only supports spot markets');
        }
        const url = this.urls['api']['ws']['ws-api'][type];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'fetchOrderWs', 'returnRateLimits', false);
        const payload = {
            'symbol': this.marketId(symbol),
            'returnRateLimits': returnRateLimits,
        };
        const message = {
            'id': messageHash,
            'method': 'allOrders',
            'params': this.signParams(this.extend(payload, params)),
        };
        const subscription = {
            'method': this.handleOrdersWs,
        };
        const orders = await this.watch(url, messageHash, message, messageHash, subscription);
        return this.filterBySymbolSinceLimit(orders, symbol, since, limit);
    }
    /**
     * @method
     * @name binance#fetchClosedOrdersWs
     * @description fetch closed orders
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/trading-requests#order-lists
     * @param {string} symbol unified market symbol
     * @param {int} [since] the earliest time in ms to fetch open orders for
     * @param {int} [limit] the maximum number of open orders structures to retrieve
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object[]} a list of [order structures]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async fetchClosedOrdersWs(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        const orders = await this.fetchOrdersWs(symbol, since, limit, params);
        const closedOrders = [];
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            if (order['status'] === 'closed') {
                closedOrders.push(order);
            }
        }
        return closedOrders;
    }
    /**
     * @method
     * @name binance#fetchOpenOrdersWs
     * @description fetch all unfilled currently open orders
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/trading-requests#current-open-orders-user_data
     * @param {string} symbol unified market symbol
     * @param {int|undefined} [since] the earliest time in ms to fetch open orders for
     * @param {int|undefined} [limit] the maximum number of open orders structures to retrieve
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object[]} a list of [order structures]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async fetchOpenOrdersWs(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const type = this.getMarketType('fetchOpenOrdersWs', market, params);
        if (type !== 'spot' && type !== 'future') {
            throw new errors.BadRequest(this.id + ' fetchOpenOrdersWs only supports spot or swap markets');
        }
        const url = this.urls['api']['ws']['ws-api'][type];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'fetchOrderWs', 'returnRateLimits', false);
        const payload = {
            'returnRateLimits': returnRateLimits,
        };
        if (symbol !== undefined) {
            payload['symbol'] = this.marketId(symbol);
        }
        const message = {
            'id': messageHash,
            'method': 'openOrders.status',
            'params': this.signParams(this.extend(payload, params)),
        };
        const subscription = {
            'method': this.handleOrdersWs,
        };
        const orders = await this.watch(url, messageHash, message, messageHash, subscription);
        return this.filterBySymbolSinceLimit(orders, symbol, since, limit);
    }
    /**
     * @method
     * @name binance#watchOrders
     * @description watches information on multiple orders made by the user
     * @see https://developers.binance.com/docs/binance-spot-api-docs/user-data-stream#order-update
     * @see https://developers.binance.com/docs/margin_trading/trade-data-stream/Event-Order-Update
     * @see https://developers.binance.com/docs/derivatives/usds-margined-futures/user-data-streams/Event-Order-Update
     * @param {string} symbol unified market symbol of the market the orders were made in
     * @param {int} [since] the earliest time in ms to fetch orders for
     * @param {int} [limit] the maximum number of order structures to retrieve
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {string|undefined} [params.marginMode] 'cross' or 'isolated', for spot margin
     * @param {boolean} [params.portfolioMargin] set to true if you would like to watch portfolio margin account orders
     * @returns {object[]} a list of [order structures]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async watchOrders(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        let messageHash = 'orders';
        let market = undefined;
        if (symbol !== undefined) {
            market = this.market(symbol);
            symbol = market['symbol'];
            messageHash += ':' + symbol;
        }
        let type = undefined;
        [type, params] = this.handleMarketTypeAndParams('watchOrders', market, params);
        let subType = undefined;
        [subType, params] = this.handleSubTypeAndParams('watchOrders', market, params);
        if (this.isLinear(type, subType)) {
            type = 'future';
        }
        else if (this.isInverse(type, subType)) {
            type = 'delivery';
        }
        params = this.extend(params, { 'type': type, 'symbol': symbol }); // needed inside authenticate for isolated margin
        await this.authenticate(params);
        let marginMode = undefined;
        [marginMode, params] = this.handleMarginModeAndParams('watchOrders', params);
        let urlType = type;
        if ((type === 'margin') || ((type === 'spot') && (marginMode !== undefined))) {
            urlType = 'spot'; // spot-margin shares the same stream as regular spot
        }
        let isPortfolioMargin = undefined;
        [isPortfolioMargin, params] = this.handleOptionAndParams2(params, 'watchOrders', 'papi', 'portfolioMargin', false);
        if (isPortfolioMargin) {
            urlType = 'papi';
        }
        const url = this.urls['api']['ws'][urlType] + '/' + this.options[type]['listenKey'];
        const client = this.client(url);
        this.setBalanceCache(client, type, isPortfolioMargin);
        this.setPositionsCache(client, type, undefined, isPortfolioMargin);
        const message = undefined;
        const orders = await this.watch(url, messageHash, message, type);
        if (this.newUpdates) {
            limit = orders.getLimit(symbol, limit);
        }
        return this.filterBySymbolSinceLimit(orders, symbol, since, limit, true);
    }
    parseWsOrder(order, market = undefined) {
        //
        // spot
        //
        //     {
        //         "e": "executionReport",        // Event type
        //         "E": 1499405658658,            // Event time
        //         "s": "ETHBTC",                 // Symbol
        //         "c": "mUvoqJxFIILMdfAW5iGSOW", // Client order ID
        //         "S": "BUY",                    // Side
        //         "o": "LIMIT",                  // Order type
        //         "f": "GTC",                    // Time in force
        //         "q": "1.00000000",             // Order quantity
        //         "p": "0.10264410",             // Order price
        //         "P": "0.00000000",             // Stop price
        //         "F": "0.00000000",             // Iceberg quantity
        //         "g": -1,                       // OrderListId
        //         "C": null,                     // Original client order ID; This is the ID of the order being canceled
        //         "x": "NEW",                    // Current execution type
        //         "X": "NEW",                    // Current order status
        //         "r": "NONE",                   // Order reject reason; will be an error code.
        //         "i": 4293153,                  // Order ID
        //         "l": "0.00000000",             // Last executed quantity
        //         "z": "0.00000000",             // Cumulative filled quantity
        //         "L": "0.00000000",             // Last executed price
        //         "n": "0",                      // Commission amount
        //         "N": null,                     // Commission asset
        //         "T": 1499405658657,            // Transaction time
        //         "t": -1,                       // Trade ID
        //         "I": 8641984,                  // Ignore
        //         "w": true,                     // Is the order on the book?
        //         "m": false,                    // Is this trade the maker side?
        //         "M": false,                    // Ignore
        //         "O": 1499405658657,            // Order creation time
        //         "Z": "0.00000000",             // Cumulative quote asset transacted quantity
        //         "Y": "0.00000000"              // Last quote asset transacted quantity (i.e. lastPrice * lastQty),
        //         "Q": "0.00000000"              // Quote Order Qty
        //     }
        //
        // future
        //
        //     {
        //         "s":"BTCUSDT",                 // Symbol
        //         "c":"TEST",                    // Client Order Id
        //                                        // special client order id:
        //                                        // starts with "autoclose-": liquidation order
        //                                        // "adl_autoclose": ADL auto close order
        //         "S":"SELL",                    // Side
        //         "o":"TRAILING_STOP_MARKET",    // Order Type
        //         "f":"GTC",                     // Time in Force
        //         "q":"0.001",                   // Original Quantity
        //         "p":"0",                       // Original Price
        //         "ap":"0",                      // Average Price
        //         "sp":"7103.04",                // Stop Price. Please ignore with TRAILING_STOP_MARKET order
        //         "x":"NEW",                     // Execution Type
        //         "X":"NEW",                     // Order Status
        //         "i":8886774,                   // Order Id
        //         "l":"0",                       // Order Last Filled Quantity
        //         "z":"0",                       // Order Filled Accumulated Quantity
        //         "L":"0",                       // Last Filled Price
        //         "N":"USDT",                    // Commission Asset, will not push if no commission
        //         "n":"0",                       // Commission, will not push if no commission
        //         "T":1568879465651,             // Order Trade Time
        //         "t":0,                         // Trade Id
        //         "b":"0",                       // Bids Notional
        //         "a":"9.91",                    // Ask Notional
        //         "m":false,                     // Is this trade the maker side?
        //         "R":false,                     // Is this reduce only
        //         "wt":"CONTRACT_PRICE",         // Stop Price Working Type
        //         "ot":"TRAILING_STOP_MARKET",   // Original Order Type
        //         "ps":"LONG",                   // Position Side
        //         "cp":false,                    // If Close-All, pushed with conditional order
        //         "AP":"7476.89",                // Activation Price, only puhed with TRAILING_STOP_MARKET order
        //         "cr":"5.0",                    // Callback Rate, only puhed with TRAILING_STOP_MARKET order
        //         "rp":"0"                       // Realized Profit of the trade
        //     }
        //
        const executionType = this.safeString(order, 'x');
        const orderId = this.safeString(order, 'i');
        const marketId = this.safeString(order, 's');
        const marketType = ('ps' in order) ? 'contract' : 'spot';
        const symbol = this.safeSymbol(marketId, undefined, undefined, marketType);
        let timestamp = this.safeInteger(order, 'O');
        const T = this.safeInteger(order, 'T');
        let lastTradeTimestamp = undefined;
        if (executionType === 'NEW' || executionType === 'AMENDMENT' || executionType === 'CANCELED') {
            if (timestamp === undefined) {
                timestamp = T;
            }
        }
        else if (executionType === 'TRADE') {
            lastTradeTimestamp = T;
        }
        const lastUpdateTimestamp = T;
        let fee = undefined;
        const feeCost = this.safeString(order, 'n');
        if ((feeCost !== undefined) && (Precise["default"].stringGt(feeCost, '0'))) {
            const feeCurrencyId = this.safeString(order, 'N');
            const feeCurrency = this.safeCurrencyCode(feeCurrencyId);
            fee = {
                'cost': feeCost,
                'currency': feeCurrency,
            };
        }
        const price = this.safeString(order, 'p');
        const amount = this.safeString(order, 'q');
        const side = this.safeStringLower(order, 'S');
        const type = this.safeStringLower(order, 'o');
        const filled = this.safeString(order, 'z');
        const cost = this.safeString(order, 'Z');
        const average = this.safeString(order, 'ap');
        const rawStatus = this.safeString(order, 'X');
        const status = this.parseOrderStatus(rawStatus);
        const trades = undefined;
        let clientOrderId = this.safeString(order, 'C');
        if ((clientOrderId === undefined) || (clientOrderId.length === 0)) {
            clientOrderId = this.safeString(order, 'c');
        }
        const stopPrice = this.safeString2(order, 'P', 'sp');
        let timeInForce = this.safeString(order, 'f');
        if (timeInForce === 'GTX') {
            // GTX means "Good Till Crossing" and is an equivalent way of saying Post Only
            timeInForce = 'PO';
        }
        return this.safeOrder({
            'info': order,
            'symbol': symbol,
            'id': orderId,
            'clientOrderId': clientOrderId,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'lastTradeTimestamp': lastTradeTimestamp,
            'lastUpdateTimestamp': lastUpdateTimestamp,
            'type': type,
            'timeInForce': timeInForce,
            'postOnly': undefined,
            'reduceOnly': this.safeBool(order, 'R'),
            'side': side,
            'price': price,
            'stopPrice': stopPrice,
            'triggerPrice': stopPrice,
            'amount': amount,
            'cost': cost,
            'average': average,
            'filled': filled,
            'remaining': undefined,
            'status': status,
            'fee': fee,
            'trades': trades,
        });
    }
    handleOrderUpdate(client, message) {
        //
        // spot
        //
        //     {
        //         "e": "executionReport",        // Event type
        //         "E": 1499405658658,            // Event time
        //         "s": "ETHBTC",                 // Symbol
        //         "c": "mUvoqJxFIILMdfAW5iGSOW", // Client order ID
        //         "S": "BUY",                    // Side
        //         "o": "LIMIT",                  // Order type
        //         "f": "GTC",                    // Time in force
        //         "q": "1.00000000",             // Order quantity
        //         "p": "0.10264410",             // Order price
        //         "P": "0.00000000",             // Stop price
        //         "F": "0.00000000",             // Iceberg quantity
        //         "g": -1,                       // OrderListId
        //         "C": null,                     // Original client order ID; This is the ID of the order being canceled
        //         "x": "NEW",                    // Current execution type
        //         "X": "NEW",                    // Current order status
        //         "r": "NONE",                   // Order reject reason; will be an error code.
        //         "i": 4293153,                  // Order ID
        //         "l": "0.00000000",             // Last executed quantity
        //         "z": "0.00000000",             // Cumulative filled quantity
        //         "L": "0.00000000",             // Last executed price
        //         "n": "0",                      // Commission amount
        //         "N": null,                     // Commission asset
        //         "T": 1499405658657,            // Transaction time
        //         "t": -1,                       // Trade ID
        //         "I": 8641984,                  // Ignore
        //         "w": true,                     // Is the order on the book?
        //         "m": false,                    // Is this trade the maker side?
        //         "M": false,                    // Ignore
        //         "O": 1499405658657,            // Order creation time
        //         "Z": "0.00000000",             // Cumulative quote asset transacted quantity
        //         "Y": "0.00000000"              // Last quote asset transacted quantity (i.e. lastPrice * lastQty),
        //         "Q": "0.00000000"              // Quote Order Qty
        //     }
        //
        // future
        //
        //     {
        //         "e":"ORDER_TRADE_UPDATE",           // Event Type
        //         "E":1568879465651,                  // Event Time
        //         "T":1568879465650,                  // Trasaction Time
        //         "o": {
        //             "s":"BTCUSDT",                  // Symbol
        //             "c":"TEST",                     // Client Order Id
        //                                             // special client order id:
        //                                             // starts with "autoclose-": liquidation order
        //                                             // "adl_autoclose": ADL auto close order
        //             "S":"SELL",                     // Side
        //             "o":"TRAILING_STOP_MARKET",     // Order Type
        //             "f":"GTC",                      // Time in Force
        //             "q":"0.001",                    // Original Quantity
        //             "p":"0",                        // Original Price
        //             "ap":"0",                       // Average Price
        //             "sp":"7103.04",                 // Stop Price. Please ignore with TRAILING_STOP_MARKET order
        //             "x":"NEW",                      // Execution Type
        //             "X":"NEW",                      // Order Status
        //             "i":8886774,                    // Order Id
        //             "l":"0",                        // Order Last Filled Quantity
        //             "z":"0",                        // Order Filled Accumulated Quantity
        //             "L":"0",                        // Last Filled Price
        //             "N":"USDT",                     // Commission Asset, will not push if no commission
        //             "n":"0",                        // Commission, will not push if no commission
        //             "T":1568879465651,              // Order Trade Time
        //             "t":0,                          // Trade Id
        //             "b":"0",                        // Bids Notional
        //             "a":"9.91",                     // Ask Notional
        //             "m":false,                      // Is this trade the maker side?
        //             "R":false,                      // Is this reduce only
        //             "wt":"CONTRACT_PRICE",          // Stop Price Working Type
        //             "ot":"TRAILING_STOP_MARKET",    // Original Order Type
        //             "ps":"LONG",                    // Position Side
        //             "cp":false,                     // If Close-All, pushed with conditional order
        //             "AP":"7476.89",                 // Activation Price, only puhed with TRAILING_STOP_MARKET order
        //             "cr":"5.0",                     // Callback Rate, only puhed with TRAILING_STOP_MARKET order
        //             "rp":"0"                        // Realized Profit of the trade
        //         }
        //     }
        //
        const e = this.safeString(message, 'e');
        if (e === 'ORDER_TRADE_UPDATE') {
            message = this.safeDict(message, 'o', message);
        }
        this.handleMyTrade(client, message);
        this.handleOrder(client, message);
        this.handleMyLiquidation(client, message);
    }
    /**
     * @method
     * @name binance#watchPositions
     * @description watch all open positions
     * @param {string[]|undefined} symbols list of unified market symbols
     * @param {number} [since] since timestamp
     * @param {number} [limit] limit
     * @param {object} params extra parameters specific to the exchange API endpoint
     * @param {boolean} [params.portfolioMargin] set to true if you would like to watch positions in a portfolio margin account
     * @returns {object[]} a list of [position structure]{@link https://docs.ccxt.com/en/latest/manual.html#position-structure}
     */
    async watchPositions(symbols = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        let market = undefined;
        let messageHash = '';
        symbols = this.marketSymbols(symbols);
        if (!this.isEmpty(symbols)) {
            market = this.getMarketFromSymbols(symbols);
            messageHash = '::' + symbols.join(',');
        }
        let type = undefined;
        [type, params] = this.handleMarketTypeAndParams('watchPositions', market, params);
        if (type === 'spot' || type === 'margin') {
            type = 'future';
        }
        let subType = undefined;
        [subType, params] = this.handleSubTypeAndParams('watchPositions', market, params);
        if (this.isLinear(type, subType)) {
            type = 'future';
        }
        else if (this.isInverse(type, subType)) {
            type = 'delivery';
        }
        const marketTypeObject = {};
        marketTypeObject['type'] = type;
        marketTypeObject['subType'] = subType;
        await this.authenticate(this.extend(marketTypeObject, params));
        messageHash = type + ':positions' + messageHash;
        let isPortfolioMargin = undefined;
        [isPortfolioMargin, params] = this.handleOptionAndParams2(params, 'watchPositions', 'papi', 'portfolioMargin', false);
        let urlType = type;
        if (isPortfolioMargin) {
            urlType = 'papi';
        }
        const url = this.urls['api']['ws'][urlType] + '/' + this.options[type]['listenKey'];
        const client = this.client(url);
        this.setBalanceCache(client, type, isPortfolioMargin);
        this.setPositionsCache(client, type, symbols, isPortfolioMargin);
        const fetchPositionsSnapshot = this.handleOption('watchPositions', 'fetchPositionsSnapshot', true);
        const awaitPositionsSnapshot = this.handleOption('watchPositions', 'awaitPositionsSnapshot', true);
        const cache = this.safeValue(this.positions, type);
        if (fetchPositionsSnapshot && awaitPositionsSnapshot && cache === undefined) {
            const snapshot = await client.future(type + ':fetchPositionsSnapshot');
            return this.filterBySymbolsSinceLimit(snapshot, symbols, since, limit, true);
        }
        const newPositions = await this.watch(url, messageHash, undefined, type);
        if (this.newUpdates) {
            return newPositions;
        }
        return this.filterBySymbolsSinceLimit(cache, symbols, since, limit, true);
    }
    setPositionsCache(client, type, symbols = undefined, isPortfolioMargin = false) {
        if (type === 'spot') {
            return;
        }
        if (this.positions === undefined) {
            this.positions = {};
        }
        if (type in this.positions) {
            return;
        }
        const fetchPositionsSnapshot = this.handleOption('watchPositions', 'fetchPositionsSnapshot', false);
        if (fetchPositionsSnapshot) {
            const messageHash = type + ':fetchPositionsSnapshot';
            if (!(messageHash in client.futures)) {
                client.future(messageHash);
                this.spawn(this.loadPositionsSnapshot, client, messageHash, type, isPortfolioMargin);
            }
        }
        else {
            this.positions[type] = new Cache.ArrayCacheBySymbolBySide();
        }
    }
    async loadPositionsSnapshot(client, messageHash, type, isPortfolioMargin) {
        const params = {
            'type': type,
        };
        if (isPortfolioMargin) {
            params['portfolioMargin'] = true;
        }
        const positions = await this.fetchPositions(undefined, params);
        this.positions[type] = new Cache.ArrayCacheBySymbolBySide();
        const cache = this.positions[type];
        for (let i = 0; i < positions.length; i++) {
            const position = positions[i];
            const contracts = this.safeNumber(position, 'contracts', 0);
            if (contracts > 0) {
                cache.append(position);
            }
        }
        // don't remove the future from the .futures cache
        const future = client.futures[messageHash];
        future.resolve(cache);
        client.resolve(cache, type + ':position');
    }
    handlePositions(client, message) {
        //
        //     {
        //         e: 'ACCOUNT_UPDATE',
        //         T: 1667881353112,
        //         E: 1667881353115,
        //         a: {
        //             B: [{
        //                 a: 'USDT',
        //                 wb: '1127.95750089',
        //                 cw: '1040.82091149',
        //                 bc: '0'
        //             }],
        //             P: [{
        //                 s: 'BTCUSDT',
        //                 pa: '-0.089',
        //                 ep: '19700.03933',
        //                 cr: '-1260.24809979',
        //                 up: '1.53058860',
        //                 mt: 'isolated',
        //                 iw: '87.13658940',
        //                 ps: 'BOTH',
        //                 ma: 'USDT'
        //             }],
        //             m: 'ORDER'
        //         }
        //     }
        //
        // each account is connected to a different endpoint
        // and has exactly one subscriptionhash which is the account type
        const subscriptions = Object.keys(client.subscriptions);
        const accountType = subscriptions[0];
        if (this.positions === undefined) {
            this.positions = {};
        }
        if (!(accountType in this.positions)) {
            this.positions[accountType] = new Cache.ArrayCacheBySymbolBySide();
        }
        const cache = this.positions[accountType];
        const data = this.safeDict(message, 'a', {});
        const rawPositions = this.safeList(data, 'P', []);
        const newPositions = [];
        for (let i = 0; i < rawPositions.length; i++) {
            const rawPosition = rawPositions[i];
            const position = this.parseWsPosition(rawPosition);
            const timestamp = this.safeInteger(message, 'E');
            position['timestamp'] = timestamp;
            position['datetime'] = this.iso8601(timestamp);
            newPositions.push(position);
            cache.append(position);
        }
        const messageHashes = this.findMessageHashes(client, accountType + ':positions::');
        for (let i = 0; i < messageHashes.length; i++) {
            const messageHash = messageHashes[i];
            const parts = messageHash.split('::');
            const symbolsString = parts[1];
            const symbols = symbolsString.split(',');
            const positions = this.filterByArray(newPositions, 'symbol', symbols, false);
            if (!this.isEmpty(positions)) {
                client.resolve(positions, messageHash);
            }
        }
        client.resolve(newPositions, accountType + ':positions');
    }
    parseWsPosition(position, market = undefined) {
        //
        //     {
        //         "s": "BTCUSDT", // Symbol
        //         "pa": "0", // Position Amount
        //         "ep": "0.00000", // Entry Price
        //         "cr": "200", // (Pre-fee) Accumulated Realized
        //         "up": "0", // Unrealized PnL
        //         "mt": "isolated", // Margin Type
        //         "iw": "0.00000000", // Isolated Wallet (if isolated position)
        //         "ps": "BOTH" // Position Side
        //     }
        //
        const marketId = this.safeString(position, 's');
        const contracts = this.safeString(position, 'pa');
        const contractsAbs = Precise["default"].stringAbs(this.safeString(position, 'pa'));
        let positionSide = this.safeStringLower(position, 'ps');
        let hedged = true;
        if (positionSide === 'both') {
            hedged = false;
            if (!Precise["default"].stringEq(contracts, '0')) {
                if (Precise["default"].stringLt(contracts, '0')) {
                    positionSide = 'short';
                }
                else {
                    positionSide = 'long';
                }
            }
        }
        return this.safePosition({
            'info': position,
            'id': undefined,
            'symbol': this.safeSymbol(marketId, undefined, undefined, 'contract'),
            'notional': undefined,
            'marginMode': this.safeString(position, 'mt'),
            'liquidationPrice': undefined,
            'entryPrice': this.safeNumber(position, 'ep'),
            'unrealizedPnl': this.safeNumber(position, 'up'),
            'percentage': undefined,
            'contracts': this.parseNumber(contractsAbs),
            'contractSize': undefined,
            'markPrice': undefined,
            'side': positionSide,
            'hedged': hedged,
            'timestamp': undefined,
            'datetime': undefined,
            'maintenanceMargin': undefined,
            'maintenanceMarginPercentage': undefined,
            'collateral': undefined,
            'initialMargin': undefined,
            'initialMarginPercentage': undefined,
            'leverage': undefined,
            'marginRatio': undefined,
        });
    }
    /**
     * @method
     * @name binance#fetchMyTradesWs
     * @description fetch all trades made by the user
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/account-requests#account-trade-history-user_data
     * @param {string} symbol unified market symbol
     * @param {int|undefined} [since] the earliest time in ms to fetch trades for
     * @param {int|undefined} [limit] the maximum number of trades structures to retrieve
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {int} [params.endTime] the latest time in ms to fetch trades for
     * @param {int} [params.fromId] first trade Id to fetch
     * @returns {object[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=trade-structure}
     */
    async fetchMyTradesWs(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        if (symbol === undefined) {
            throw new errors.BadRequest(this.id + ' fetchMyTradesWs requires a symbol');
        }
        const market = this.market(symbol);
        const type = this.getMarketType('fetchMyTradesWs', market, params);
        if (type !== 'spot' && type !== 'future') {
            throw new errors.BadRequest(this.id + ' fetchMyTradesWs does not support ' + type + ' markets');
        }
        const url = this.urls['api']['ws']['ws-api'][type];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'fetchMyTradesWs', 'returnRateLimits', false);
        const payload = {
            'symbol': this.marketId(symbol),
            'returnRateLimits': returnRateLimits,
        };
        if (since !== undefined) {
            payload['startTime'] = since;
        }
        if (limit !== undefined) {
            payload['limit'] = limit;
        }
        const fromId = this.safeInteger(params, 'fromId');
        if (fromId !== undefined && since !== undefined) {
            throw new errors.BadRequest(this.id + ' fetchMyTradesWs does not support fetching by both fromId and since parameters at the same time');
        }
        const message = {
            'id': messageHash,
            'method': 'myTrades',
            'params': this.signParams(this.extend(payload, params)),
        };
        const subscription = {
            'method': this.handleTradesWs,
        };
        const trades = await this.watch(url, messageHash, message, messageHash, subscription);
        return this.filterBySymbolSinceLimit(trades, symbol, since, limit);
    }
    /**
     * @method
     * @name binance#fetchTradesWs
     * @description fetch all trades made by the user
     * @see https://developers.binance.com/docs/binance-spot-api-docs/websocket-api/market-data-requests#recent-trades
     * @param {string} symbol unified market symbol
     * @param {int} [since] the earliest time in ms to fetch trades for
     * @param {int} [limit] the maximum number of trades structures to retrieve, default=500, max=1000
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     *
     * EXCHANGE SPECIFIC PARAMETERS
     * @param {int} [params.fromId] trade ID to begin at
     * @returns {object[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=trade-structure}
     */
    async fetchTradesWs(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        if (symbol === undefined) {
            throw new errors.BadRequest(this.id + ' fetchTradesWs () requires a symbol argument');
        }
        const market = this.market(symbol);
        const type = this.getMarketType('fetchTradesWs', market, params);
        if (type !== 'spot' && type !== 'future') {
            throw new errors.BadRequest(this.id + ' fetchTradesWs does not support ' + type + ' markets');
        }
        const url = this.urls['api']['ws']['ws-api'][type];
        const requestId = this.requestId(url);
        const messageHash = requestId.toString();
        let returnRateLimits = false;
        [returnRateLimits, params] = this.handleOptionAndParams(params, 'fetchTradesWs', 'returnRateLimits', false);
        const payload = {
            'symbol': this.marketId(symbol),
            'returnRateLimits': returnRateLimits,
        };
        if (limit !== undefined) {
            payload['limit'] = limit;
        }
        const message = {
            'id': messageHash,
            'method': 'trades.historical',
            'params': this.extend(payload, params),
        };
        const subscription = {
            'method': this.handleTradesWs,
        };
        const trades = await this.watch(url, messageHash, message, messageHash, subscription);
        return this.filterBySinceLimit(trades, since, limit);
    }
    handleTradesWs(client, message) {
        //
        // fetchMyTradesWs
        //
        //    {
        //        "id": "f4ce6a53-a29d-4f70-823b-4ab59391d6e8",
        //        "status": 200,
        //        "result": [
        //            {
        //                "symbol": "BTCUSDT",
        //                "id": 1650422481,
        //                "orderId": 12569099453,
        //                "orderListId": -1,
        //                "price": "23416.10000000",
        //                "qty": "0.00635000",
        //                "quoteQty": "148.69223500",
        //                "commission": "0.00000000",
        //                "commissionAsset": "BNB",
        //                "time": 1660801715793,
        //                "isBuyer": false,
        //                "isMaker": true,
        //                "isBestMatch": true
        //            },
        //            ...
        //        ],
        //    }
        //
        // fetchTradesWs
        //
        //    {
        //        "id": "f4ce6a53-a29d-4f70-823b-4ab59391d6e8",
        //        "status": 200,
        //        "result": [
        //            {
        //                "id": 0,
        //                "price": "0.00005000",
        //                "qty": "40.00000000",
        //                "quoteQty": "0.00200000",
        //                "time": 1500004800376,
        //                "isBuyerMaker": true,
        //                "isBestMatch": true
        //            }
        //            ...
        //        ],
        //    }
        //
        const messageHash = this.safeString(message, 'id');
        const result = this.safeList(message, 'result', []);
        const trades = this.parseTrades(result);
        client.resolve(trades, messageHash);
    }
    /**
     * @method
     * @name binance#watchMyTrades
     * @description watches information on multiple trades made by the user
     * @param {string} symbol unified market symbol of the market orders were made in
     * @param {int} [since] the earliest time in ms to fetch orders for
     * @param {int} [limit] the maximum number of order structures to retrieve
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @param {boolean} [params.portfolioMargin] set to true if you would like to watch trades in a portfolio margin account
     * @returns {object[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=trade-structure}
     */
    async watchMyTrades(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        let type = undefined;
        let market = undefined;
        if (symbol !== undefined) {
            market = this.market(symbol);
            symbol = market['symbol'];
        }
        [type, params] = this.handleMarketTypeAndParams('watchMyTrades', market, params);
        let subType = undefined;
        [subType, params] = this.handleSubTypeAndParams('watchMyTrades', market, params);
        if (this.isLinear(type, subType)) {
            type = 'future';
        }
        else if (this.isInverse(type, subType)) {
            type = 'delivery';
        }
        let messageHash = 'myTrades';
        if (symbol !== undefined) {
            symbol = this.symbol(symbol);
            messageHash += ':' + symbol;
            params = this.extend(params, { 'type': market['type'], 'symbol': symbol });
        }
        await this.authenticate(params);
        let urlType = type; // we don't change type because the listening key is different
        if (type === 'margin') {
            urlType = 'spot'; // spot-margin shares the same stream as regular spot
        }
        let isPortfolioMargin = undefined;
        [isPortfolioMargin, params] = this.handleOptionAndParams2(params, 'watchMyTrades', 'papi', 'portfolioMargin', false);
        if (isPortfolioMargin) {
            urlType = 'papi';
        }
        const url = this.urls['api']['ws'][urlType] + '/' + this.options[type]['listenKey'];
        const client = this.client(url);
        this.setBalanceCache(client, type, isPortfolioMargin);
        this.setPositionsCache(client, type, undefined, isPortfolioMargin);
        const message = undefined;
        const trades = await this.watch(url, messageHash, message, type);
        if (this.newUpdates) {
            limit = trades.getLimit(symbol, limit);
        }
        return this.filterBySymbolSinceLimit(trades, symbol, since, limit, true);
    }
    handleMyTrade(client, message) {
        const messageHash = 'myTrades';
        const executionType = this.safeString(message, 'x');
        if (executionType === 'TRADE') {
            const trade = this.parseWsTrade(message);
            const orderId = this.safeString(trade, 'order');
            let tradeFee = this.safeDict(trade, 'fee', {});
            tradeFee = this.extend({}, tradeFee);
            const symbol = this.safeString(trade, 'symbol');
            if (orderId !== undefined && tradeFee !== undefined && symbol !== undefined) {
                const cachedOrders = this.orders;
                if (cachedOrders !== undefined) {
                    const orders = this.safeValue(cachedOrders.hashmap, symbol, {});
                    const order = this.safeValue(orders, orderId);
                    if (order !== undefined) {
                        // accumulate order fees
                        const fees = this.safeValue(order, 'fees');
                        const fee = this.safeValue(order, 'fee');
                        if (!this.isEmpty(fees)) {
                            let insertNewFeeCurrency = true;
                            for (let i = 0; i < fees.length; i++) {
                                const orderFee = fees[i];
                                if (orderFee['currency'] === tradeFee['currency']) {
                                    const feeCost = this.sum(tradeFee['cost'], orderFee['cost']);
                                    order['fees'][i]['cost'] = parseFloat(this.currencyToPrecision(tradeFee['currency'], feeCost));
                                    insertNewFeeCurrency = false;
                                    break;
                                }
                            }
                            if (insertNewFeeCurrency) {
                                order['fees'].push(tradeFee);
                            }
                        }
                        else if (fee !== undefined) {
                            if (fee['currency'] === tradeFee['currency']) {
                                const feeCost = this.sum(fee['cost'], tradeFee['cost']);
                                order['fee']['cost'] = parseFloat(this.currencyToPrecision(tradeFee['currency'], feeCost));
                            }
                            else if (fee['currency'] === undefined) {
                                order['fee'] = tradeFee;
                            }
                            else {
                                order['fees'] = [fee, tradeFee];
                                order['fee'] = undefined;
                            }
                        }
                        else {
                            order['fee'] = tradeFee;
                        }
                        // save this trade in the order
                        const orderTrades = this.safeList(order, 'trades', []);
                        orderTrades.push(trade);
                        order['trades'] = orderTrades;
                        // don't append twice cause it breaks newUpdates mode
                        // this order already exists in the cache
                    }
                }
            }
            if (this.myTrades === undefined) {
                const limit = this.safeInteger(this.options, 'tradesLimit', 1000);
                this.myTrades = new Cache.ArrayCacheBySymbolById(limit);
            }
            const myTrades = this.myTrades;
            myTrades.append(trade);
            client.resolve(this.myTrades, messageHash);
            const messageHashSymbol = messageHash + ':' + symbol;
            client.resolve(this.myTrades, messageHashSymbol);
        }
    }
    handleOrder(client, message) {
        const parsed = this.parseWsOrder(message);
        const symbol = this.safeString(parsed, 'symbol');
        const orderId = this.safeString(parsed, 'id');
        if (symbol !== undefined) {
            if (this.orders === undefined) {
                const limit = this.safeInteger(this.options, 'ordersLimit', 1000);
                this.orders = new Cache.ArrayCacheBySymbolById(limit);
            }
            const cachedOrders = this.orders;
            const orders = this.safeValue(cachedOrders.hashmap, symbol, {});
            const order = this.safeValue(orders, orderId);
            if (order !== undefined) {
                const fee = this.safeValue(order, 'fee');
                if (fee !== undefined) {
                    parsed['fee'] = fee;
                }
                const fees = this.safeValue(order, 'fees');
                if (fees !== undefined) {
                    parsed['fees'] = fees;
                }
                parsed['trades'] = this.safeValue(order, 'trades');
                const timestamp = this.safeInteger(parsed, 'timestamp');
                if (timestamp === undefined) {
                    parsed['timestamp'] = this.safeInteger(order, 'timestamp');
                    parsed['datetime'] = this.safeString(order, 'datetime');
                }
            }
            cachedOrders.append(parsed);
            const messageHash = 'orders';
            const symbolSpecificMessageHash = 'orders:' + symbol;
            client.resolve(cachedOrders, messageHash);
            client.resolve(cachedOrders, symbolSpecificMessageHash);
        }
    }
    handleAcountUpdate(client, message) {
        this.handleBalance(client, message);
        this.handlePositions(client, message);
    }
    handleWsError(client, message) {
        //
        //    {
        //        "error": {
        //            "code": 2,
        //            "msg": "Invalid request: invalid stream"
        //        },
        //        "id": 1
        //    }
        //
        const id = this.safeString(message, 'id');
        let rejected = false;
        const error = this.safeDict(message, 'error', {});
        const code = this.safeInteger(error, 'code');
        const msg = this.safeString(error, 'msg');
        try {
            this.handleErrors(code, msg, client.url, undefined, undefined, this.json(error), error, undefined, undefined);
        }
        catch (e) {
            rejected = true;
            // private endpoint uses id as messageHash
            client.reject(e, id);
            // public endpoint stores messageHash in subscriptions
            const subscriptionKeys = Object.keys(client.subscriptions);
            for (let i = 0; i < subscriptionKeys.length; i++) {
                const subscriptionHash = subscriptionKeys[i];
                const subscriptionId = this.safeString(client.subscriptions[subscriptionHash], 'id');
                if (id === subscriptionId) {
                    client.reject(e, subscriptionHash);
                }
            }
        }
        if (!rejected) {
            client.reject(message, id);
        }
        // reset connection if 5xx error
        const codeString = this.safeString(error, 'code');
        if ((codeString !== undefined) && (codeString[0] === '5')) {
            client.reset(message);
        }
    }
    handleMessage(client, message) {
        // handle WebSocketAPI
        const status = this.safeString(message, 'status');
        const error = this.safeValue(message, 'error');
        if ((error !== undefined) || (status !== undefined && status !== '200')) {
            this.handleWsError(client, message);
            return;
        }
        const id = this.safeString(message, 'id');
        const subscriptions = this.safeValue(client.subscriptions, id);
        let method = this.safeValue(subscriptions, 'method');
        if (method !== undefined) {
            method.call(this, client, message);
            return;
        }
        // handle other APIs
        const methods = {
            'depthUpdate': this.handleOrderBook,
            'trade': this.handleTrade,
            'aggTrade': this.handleTrade,
            'kline': this.handleOHLCV,
            'markPrice_kline': this.handleOHLCV,
            'indexPrice_kline': this.handleOHLCV,
            '1hTicker@arr': this.handleTickers,
            '4hTicker@arr': this.handleTickers,
            '1dTicker@arr': this.handleTickers,
            '24hrTicker@arr': this.handleTickers,
            '24hrMiniTicker@arr': this.handleTickers,
            '1hTicker': this.handleTickers,
            '4hTicker': this.handleTickers,
            '1dTicker': this.handleTickers,
            '24hrTicker': this.handleTickers,
            '24hrMiniTicker': this.handleTickers,
            'markPriceUpdate': this.handleTickers,
            'markPriceUpdate@arr': this.handleTickers,
            'bookTicker': this.handleBidsAsks,
            'outboundAccountPosition': this.handleBalance,
            'balanceUpdate': this.handleBalance,
            'ACCOUNT_UPDATE': this.handleAcountUpdate,
            'executionReport': this.handleOrderUpdate,
            'ORDER_TRADE_UPDATE': this.handleOrderUpdate,
            'forceOrder': this.handleLiquidation,
        };
        let event = this.safeString(message, 'e');
        if (Array.isArray(message)) {
            const data = message[0];
            event = this.safeString(data, 'e') + '@arr';
        }
        method = this.safeValue(methods, event);
        if (method === undefined) {
            const requestId = this.safeString(message, 'id');
            if (requestId !== undefined) {
                this.handleSubscriptionStatus(client, message);
                return;
            }
            // special case for the real-time bookTicker, since it comes without an event identifier
            //
            //     {
            //         "u": 7488717758,
            //         "s": "BTCUSDT",
            //         "b": "28621.74000000",
            //         "B": "1.43278800",
            //         "a": "28621.75000000",
            //         "A": "2.52500800"
            //     }
            //
            if (event === undefined && ('a' in message) && ('b' in message)) {
                this.handleBidsAsks(client, message);
            }
        }
        else {
            method.call(this, client, message);
        }
    }
}

module.exports = binance;
