const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
    this._cache = true;
    this.hashKey = JSON.stringify(options.key || ''); // in case someone passes an object as a key

    return this; // make this .cache() chain-able, e.g. new Query.find().cache().sort()...
};

mongoose.Query.prototype.exec = async function () {
    if (!this._cache){
        return exec.apply(this, arguments);
    }

    const key = JSON.stringify({
        ...this.getQuery(),
        ...{ collection: this.mongooseCollection.name }
    });

    // see if we have a value for 'key' in redis
    const cacheValue = await client.hget(this.hashKey, key);

    // if yes, return that
    if (cacheValue) {
        // mongoose exec expects to return a promise of mongoose.model type object
        const doc = JSON.parse(cacheValue);

        return Array.isArray(doc)
            ? doc.map( d => new this.model(d))
            : new this.model(doc);
    }

    // otherwise, use original exec method and store the value into redis
    const result = await exec.apply(this, arguments);

    client.hset(this.hashKey, key, JSON.stringify(result));

    return result
};

module.exports = {
    clearHash(hashKey){
        client.del(JSON.stringify(hashKey));
    }
};