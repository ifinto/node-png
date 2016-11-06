'use strict'
var express = require('express')
var router = express.Router()
var mysql = require('mysql')
var fs = require('fs')
var Ftp = require('ftp')
var request = require('request')
var Promise = require("bluebird")

router.get('/', function(req, res, next) {
  res.render('add_raw_data', { title: 'Raw data' })
})

router.post('/parse', function(req, res, next) {
  var dataArray = []
  var tempFiles = {
    full: 'temp.png',
    thumb: 'temp-thumb.png'
  }
  var imgName = 'truck-you.png'
  var imgAlt = 'Alt text for truck'
  var ftp = new Ftp()
  var mySqlConnection = mysql.createConnection({
    host     : 'db14.freehost.com.ua',
    user     : 'malyniak_carpng',
    password : 'OQoQeuNuJ',
    database : 'malyniak_carpng'
  })

  ftp.on('ready', function() {
    parseRawData(req.body.rawData)
  })

  ftp.connect({
    host     : 'ftp.s32.freehost.com.ua',
    user     : 'malyniak_node',
    password : 'OQoQeuNuJ'
  })

  mySqlConnection.connect()

  function parseRawData(data) {
    var matches = data.split('\n\n')
    if (!matches || matches.length === 0) {
      res.sendStatus(500)
      return
    }

    matches.forEach(function (el, i, arr) {
      var m = el.split('\n')
      if (m.length === 0) return

      var sources = m.slice(1, m.length)

      if (!sources || sources.length == 0) {
        console.log('sources not found!')
        return
      }

      dataArray.push({
        title: m[0],
        sources: sources
      })
    })

    operateData();
  }

  function operateData() {
    Promise.mapSeries(dataArray, operatePosts)
      .then(() => {
        console.log('closing ftp connection')
        console.log('closing MySQL connection')
        ftp.end()
        mySqlConnection.end()

        res.sendStatus(200)
      })

    function operatePosts(post, i) {
      console.log('started operating Post', i)
      console.log('----------------------------')
      
      return new Promise((resolve, reject) => {
        post.guid = Math.floor(Math.random() * 10000)
        post.name = post.title.replace(/\s+/g, '-').toLowerCase() + '-' + post.guid
        post.date = new Date().toISOString().slice(0, 19).replace('T', ' ')
        post.content = []


        Promise.mapSeries(post.sources, operateSource)
          .then(() => {
            insertRawData()
          })
          .then(() => {
            resolve()
            console.log('resolving Post', i)
            console.log('----------------------------')
          })

        function operateSource(src, index) {
          console.log('started operating src: ', index)
          return new Promise((resolve, reject) => {
            request.get({url: src, encoding: 'binary'}, function (err, response, body) {
              fs.writeFile(tempFiles.full, body, 'binary', function(err) {
                if (err) throw err
                console.log(src)
                convertImage(src, index)
              }) 
            })

            function convertImage(src, index) {
              run_cmd(
                'magick', [
                  'convert',
                  tempFiles.full,
                  '-resize', 
                  '300x300', 
                  '-background',
                  'transparent',
                  '-gravity',
                  'center',
                  '-extent',
                  '300x300',
                  tempFiles.thumb
                ],
                function () {
                  console.log('=============')
                  console.log(arguments)
                  console.log('=============')
                  storeByFtp(src, index)
                }
              );
            }

            function storeByFtp(src, index) {
              var name_guid = Math.floor(Math.random() * 10000)
              var srcName = post.name +'-'+ index +'.png'
              var fileName = {
                full: 'full/'+ srcName,
                thumb: 'thumb/'+ srcName
              }

              console.log('started FTP for:  ', index)

              ftp.put(tempFiles.full, fileName.full, function(err) {
                if (err) throw err

                ftp.put(tempFiles.thumb, fileName.thumb, function(err) {
                  if (err) throw err
                  post.content.push(srcName)
                  console.log('resolving FTP for: ', index)
                  resolve()
                })
              })
            }
       
          })
        }

        function insertRawData() {
          return new Promise((resolve, reject) => {
            var query = insertQuery('wp_posts', {
              'post_author': 2,
              'post_date': post.date,
              'post_date_gmt': post.date,
              'post_content': post.content.join('\n'),
              'post_title': post.title,
              'post_status': 'publish',
              'comment_status': 'closed',
              'ping_status': 'closed',
              'post_name': post.name,
              'post_modified': 'NOW()',
              'post_modified_gmt': 'NULL',
              'post_parent': 0,
              'guid': 'NULL',
              'menu_order': 0,
              'post_type': 'post',
              'comment_count': 0 
            })

            mySqlConnection.query(query, function(err, rows, fields) {
              if (err) throw err
              console.log('MySQL query success; rows: ', rows.affectedRows)
              resolve()
            })
          })
        }

        function insertQuery(table, params) {
          var headers = []
          var values = []

          Object.keys(params).forEach(function (key) {
            headers.push('`' +key +'`')
            values.push('\'' +params[key] +'\'')
          })
          return 'INSERT INTO `' + table + '` ('+ headers.join(',') +') VALUES ('+ values.join(',') +')'
        }    
          
      })
    }  
  }
})


function run_cmd(cmd, args, end) {
  var spawn = require('child_process').spawn,
      child = spawn(cmd, args),
      me = this;
  child.stdout.on('end', end);
}



module.exports = router
