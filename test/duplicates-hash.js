/* global describe, it, JpegImage */

'use strict';

var _ = require('underscore')
var mysql = require('mysql')
var glob = require('glob');
var path = require('path');
var fs = require('fs');
var request = require('request')
var Promise = require('bluebird');
var blockhash = require('blockhash');
var PNG = require('png-js');
var jpeg = require('jpeg-js');


var mySqlConnection = mysql.createConnection({
  host     : 'db14.freehost.com.ua',
  user     : 'malyniak_carpng',
  password : 'OQoQeuNuJ',
  database : 'malyniak_carpng'
})

var imgSrc = 'https://dl.dropboxusercontent.com/u/26082520/Untitled-1.png'

new Promise((resolve, reject) => {
  request.get({url: imgSrc, encoding: 'binary'}, function (err, response, body) {
    resolve(body)
  })
}).then((body) => {
  return new Promise((resolve, reject) => {
    var bits = 16
    var type = 1
    var buffer = new Buffer(body, 'binary')
    var data = new Uint8Array(buffer);
    var png

    try {
      png = new PNG(data) //PNG sometimes falls
    } catch (e) {
      console.log(e)
      return
    }

    var imgData = {
      width: png.width,
      height: png.height,
      data: new Uint8Array(png.width * png.height * 4)
    };

    png.decodePixels(function(pixels) {
      png.copyToImageData(imgData, pixels)
      var hash = blockhash.blockhashData(imgData, bits, type)
      resolve(hash)
    })
  })
}).then((new_hash) => {
  return new Promise((resolve, reject) => {
    mySqlConnection.query('SELECT * FROM `wp_posts`', function(err, rows, fields) {
      if (err) throw err
      resolve([new_hash, rows])
    })
  })
}).then((opts) => {
  var new_hash = opts[0]
  var rows     = opts[1]

  _.each(rows, (row) => {
    if (!row.hashes) return

    var hashesArr = parseRawData(row.hashes)

    _.each(hashesArr, (h) => {
      var distance = blockhash.hammingDistance(new_hash, h);
      if (distance < 100) console.log('distance: ', distance, row.post_name)
    })
  })
})


function parseRawData(data) {
  var sources = data.split(',')
  if (!sources || sources.length == 0) {
    console.log('sources not found!')
    return false
  }
  return sources
}

