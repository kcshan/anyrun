const fs = require('fs')
const path = require('path')
const mime = require('./mime')
const compress = require('./compress')
const range = require('./range')
const conf = require('../config/defaultConf')

const Handlebars = require('handlebars')
const promisify = require('util').promisify
const stat = promisify(fs.stat)
const readdir = promisify(fs.readdir)

const tplPath = path.join(__dirname, '../template/dir.tpl')
const source = fs.readFileSync(tplPath)
const template = Handlebars.compile(source.toString())

module.exports = async function (req, res, filePath) {
  try {
    const stats = await stat(filePath)

    if (stats.isFile()) {
      
      // 下面这种不推荐 需要全部读取文件后才返回response 太慢
      // fs.readFile(filePath, 'utf8', (err, data) => {
      //   if (err) {
      //     res.statusCode = 500
      //     res.setHeader('Content-Type', 'text/plain')
      //     res.end(`${filePath} read field`)
      //   }
      //   res.statusCode = 200
      //   res.setHeader('Content-Type', 'text/plain')
      //   res.end(data.toString())
      // })

      const contentType = mime(filePath)
      
      res.setHeader('Content-Type', contentType)
      // curl http://127.0.0.1:8899/src/config/defaultConf.js
      // curl -i http://127.0.0.1:8899/src/config/defaultConf.js
      // curl -r 0-10 -i http://127.0.0.1:8899/src/config/defaultConf.js
      let rs;
      const {code, start, end} = range(stats.size, req, res)
      if (code === 200) {
        res.statusCode = 200
        rs = fs.createReadStream(filePath)
      } else {
        res.statusCode = 206
        rs = fs.createReadStream(filePath, {start, end})
      }
       
      if (filePath.match(conf.compress)) {
        rs = compress(rs, req, res)
      }
      rs.pipe(res)
    } else if (stats.isDirectory()) {
      const files = await readdir(filePath)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      const dir = path.relative(conf.root, filePath)
      const data = {
        title: path.basename(filePath),
        dir: dir ? `/${dir}` : '',
        files: files.map(file => {
          return {
            file: file,
            icon: mime(file)
          }
        })
      }
      res.end(template(data))
    }
  } catch (error) {
    console.error(error)
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain')
    res.end(`${filePath} is not a directory or file\n ${error}`)
  }
}