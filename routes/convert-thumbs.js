'use strict'
var express = require('express')
var router = express.Router()
var mysql = require('mysql')
var fs = require('fs')
var Ftp = require('ftp')
var im = require('imagemagick')
var request = require('request')
var Promise = require("bluebird")

router.get('/', function(req, res, next) {
  var folders = {
   target: 'C:/xampp/htdocs/carpng/.materials/uploads/full/',
   dist: 'C:/xampp/htdocs/carpng/.materials/uploads/thumbs/'
  }

  fs.readdir(folders.target, (err, files) => {
    Promise.mapSeries(files, convertImage)
      .then(() => {
        res.sendStatus(200)
      })
  })

  function convertImage(src) {
    return new Promise((resolve, reject) => {
      console.log(folders.target + src)
      run_cmd(
        'magick', [
          'convert',
          folders.target + src, 
          '-resize', 
          '300x300', 
          '-background',
          'white',
          '-gravity',
          'center',
          '-extent',
          '300x300', 
          // '-type', 
          // 'Palette', 
          folders.dist + src
        ],
        function () {
          resolve()
        }
      );
    })
  }


})

function run_cmd(cmd, args, end) {
  var spawn = require('child_process').spawn,
      child = spawn(cmd, args),
      me = this;
  child.stdout.on('end', end);
}



module.exports = router
