'use strict'
var _ = require('underscore')
var express = require('express')
var router = express.Router()
var mysql = require('mysql')
var fs = require('fs')
var Ftp = require('ftp')
var request = require('request')
var Promise = require("bluebird")

var mySqlConnection = mysql.createConnection({
  host     : 'db14.freehost.com.ua',
  user     : 'malyniak_carpng',
  password : 'OQoQeuNuJ',
  database : 'malyniak_carpng'
})
//mySqlConnection.connect()


router.get('/', function(req, res, next) {
  res.render('uploader', {
    title: 'Uploader'
  })
})

router.get('/taxonomy', function(req, res, next) {

  //mySqlConnection.connect()
  var termsQueries = ['SELECT * FROM  `wp_terms`', 'SELECT * FROM  `wp_term_taxonomy`']
  Promise.map(termsQueries, function (query) {
    return new Promise((resolve, reject) => {
      mySqlConnection.query(query, function(err, rows, fields) {
        if (err) throw err
        resolve(rows)
      })
    })
  }).then((results) => {
    var terms         = results[0]
    var term_taxonomy = results[1]

    var categories = _.reduce(terms, (arr, el) => {
      var found = _.find(term_taxonomy, (_el) => {
        return _el.term_id === el.term_id && _el.taxonomy === 'category'
      })
      if (found) arr.push(_.extend({}, el, found))
      return arr
    }, [])

    var tags = _.reduce(terms, (arr, el) => {
      var found = _.find(term_taxonomy, (_el) => {
        return _el.term_id === el.term_id && _el.taxonomy === 'post_tag'
      })
      if (found) arr.push(_.extend({}, el, found))
      return arr
    }, [])

    res.json({
      categories: categories,
      tags: tags
    })

    //mySqlConnection.end()
  })
})

router.post('/send', function(req, res, next) {
  var mySqlConnection = mysql.createConnection({
    host     : 'db14.freehost.com.ua',
    user     : 'malyniak_carpng',
    password : 'OQoQeuNuJ',
    database : 'malyniak_carpng'
  })


  var dataArray = [{
    title: req.body.title,
    tags: req.body.tags || '',
    categories: req.body.categories || '',
    status: req.body.status || 'draft',
    sources: JSON.parse(req.body.images)
  }]
  var tempFiles = {
    full: 'temp.png',
    thumb: 'temp-thumb.png'
  }
  var imgName = 'truck-you.png'
  var imgAlt = 'Alt text for truck'
  var ftp = new Ftp()

  ftp.on('ready', function() {
    operateData();
  })

  ftp.connect({
    host     : 'ftp.s32.freehost.com.ua',
    user     : 'malyniak_node',
    password : 'OQoQeuNuJ'
  })

  //mySqlConnection.connect()

  function operateData() {
    Promise.mapSeries(dataArray, operatePosts)
      .then(() => {
        console.log('closing ftp connection')
        console.log('closing MySQL connection')
        ftp.end()
        //mySqlConnection.end()

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
            return insertPostData()
          })
          .then((postId) => {
            return insertTaxonomyData(postId)
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

        function insertPostData() {
          console.log('inside insertPostData')
          return new Promise((resolve, reject) => {
            var query = insertQuery('wp_posts', {
              'post_author': 2,
              'post_date': post.date,
              'post_date_gmt': post.date,
              'post_content': post.content.join('\n'),
              'post_title': post.title,
              'post_status': post.status,
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
              resolve(rows.insertId)
            })
          })
        }

        function insertTaxonomyData(postId) {
          return new Promise((resolve, reject) => {
            var taxonomyList = post.categories.split(', ').concat(post.tags.split(', '))
            var valuesQuery = taxonomyList.reduce((arr, el) => {
              if (!!el & el !== '') arr.push('('+ postId +','+ el +', 0)')
              return arr
            }, [])
            valuesQuery = _.uniq(valuesQuery)

            if (valuesQuery.length === 0) {
              resolve()
              return
            }
            var headers = ['`object_id`','`term_taxonomy_id`','`term_order`']
            var query = 'INSERT INTO wp_term_relationships ('+ headers.join(',') +') VALUES '+ valuesQuery.join(',')
console.log('qqqqqq')
console.log(valuesQuery)
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
          
        function insertMultipleQuery(table, params) {
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
