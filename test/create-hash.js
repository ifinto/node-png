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


var testFiles = glob.sync('test/data/*.png')
var imgPath = 'http://carpng.com/wp-content/uploads/thumb/'
var images = []

var mySqlConnection = mysql.createConnection({
  host     : 'db14.freehost.com.ua',
  user     : 'malyniak_carpng',
  password : 'OQoQeuNuJ',
  database : 'malyniak_carpng'
})

new Promise((resolve, reject) => {
  mySqlConnection.query('SELECT * FROM `wp_posts`', function(err, rows, fields) {
    if (err) throw err
    resolve(rows)
  })
}).then((rows)=> {
  Promise.mapSeries(rows, function(row, i) {
    return new Promise(function (resolve, reject) {
      var bits = 16
      var type = 1

      row.hashes = []

      _.each(rows, (row) => {
        row.images = parseRawData(row.post_content)
      })


      Promise.mapSeries(row.images, function(imgSrc) {
        return new Promise(function (resolve, reject) {
         console.log(imgSrc);
          request.get({url: imgPath + imgSrc, encoding: 'binary'}, function (err, response, body) {
            var buffer = new Buffer(body, 'binary')
            var data = new Uint8Array(buffer);
            var png

            try {
              png = new PNG(data) //PNG sometimes falls
            } catch (e) {
              console.log(e)
              resolve()
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
              row.hashes.push(hash)
              resolve()
            })
          })
        })
      }).then(() => {
        var hashesStr = row.hashes.join(',')
        mySqlConnection.query('UPDATE `wp_posts` SET `hashes`="'+ hashesStr +'" WHERE id=' + row.ID, function(err, rows, fields) {
          if (err) throw err
          resolve()
        })
      })
    });
  }).then(() => {
  })
})


function parseRawData(data) {
  var sources = data.split('\n')
  if (!sources || sources.length == 0) {
    console.log('sources not found!')
    return false
  }
  return sources
}
