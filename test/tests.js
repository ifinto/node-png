/* global describe, it, JpegImage */

'use strict';

var expect = require('expect.js');
var glob = require('glob');
var path = require('path');
var fs = require('fs');

var blockhash = require('blockhash');

var PNG = require('png-js');
var jpeg = require('jpeg-js');

var testFiles = glob.sync('test/data/*.jpg')
    .concat(glob.sync('test/data/*.png'));
console.log(testFiles)
testFiles.forEach(function(fn) {
    var ext = path.extname(fn);
    var basename = path.basename(fn, ext);
    var bits = 16;

    [1, 2].forEach(function(m) {
        var data, getImgData, hash, expectedHash;

        data = new Uint8Array(fs.readFileSync(fn));

        switch (ext) {
        case '.jpg':
            getImgData = function(next) {
                next(jpeg.decode(data));
            };
            break;

        case '.png':
            getImgData = function(next) {
                var png = new PNG(data);
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
            hash = blockhash.blockhashData(imgData, bits, m);

            expectedHash = fs.readFileSync("test/data/" + basename + "_" + bits + "_" + m + ".txt", {
                encoding: 'utf-8'
            }).split(/\s/)[1];

            // use hamming distance to iron out little
            // differences between this jpeg decoder and the one in PIL
            var hd = blockhash.hammingDistance(expectedHash, hash);

            console.log('hd: ', expectedHash, hash);
        });
    });
});
