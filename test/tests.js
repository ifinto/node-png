/* global describe, it, JpegImage */

'use strict';

var glob = require('glob');
var path = require('path');
var fs = require('fs');
var Promise = require('bluebird');
var blockhash = require('blockhash');
var PNG = require('png-js');
var jpeg = require('jpeg-js');

var testFiles = glob.sync('test/data/*.png')
var images = []

Promise.mapSeries(testFiles, function(fileName, i) {
  return new Promise(function (resolve, reject) {
    var ext = path.extname(fileName);
    var basename = path.basename(fileName, ext);
    var bits = 16;
    var type = 1;
    var data, getImgData, hash, expectedHash;

    data = new Uint8Array(fs.readFileSync(fileName));

    switch (ext) {
    case '.jpg':
      getImgData = function(next) {
        next(jpeg.decode(data));
      };
      break;

    case '.png':
      getImgData = function(next) {
        var png = new PNG(data);
        console.log(fileName);
        var imgData = {
          width: png.width,
          height: png.height,
          data: new Uint8Array(png.width * png.height * 4)
        };

        png.decodePixels(function(pixels) {
          png.copyToImageData(imgData, pixels);
          next(imgData);
        });
      };
    }

    getImgData(function(imgData) {
      hash = blockhash.blockhashData(imgData, bits, type);
      images[i] = {
        hash: hash,
        fileName: fileName
      }
      resolve()

      // use hamming distance to iron out little
      // differences between this jpeg decoder and the one in PIL
      //var hd = blockhash.hammingDistance(expectedHash, hash);

    });
  });
})
  .then(function () {
    images.forEach(function (srcImg, i) {
      images.forEach(function (compImg, j) {
        if (j === i) return
        var distance = blockhash.hammingDistance(srcImg.hash, compImg.hash)
        if (distance < 10) console.log(distance, srcImg.fileName, compImg.fileName);;
      })
    })
  })

