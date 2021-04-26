const fp = require('fastify-plugin')
const autoload = require('fastify-autoload')
const path = require('path')
const pino = require('pino')
const pinoms = require('pino-multi-stream')
const pinoElastic = require('pino-elasticsearch')
const cache = require('./cache/cache')
const { status } = require('./routes/status/statusRoute')
const { toSingle, ResponsaSingleChoiceResource } = require('./models/singleChoice')
const { toRich, ResponsaRichMessageResource } = require('./models/richMessage')
const errorSchema = require('./models/error')
const config = require('./config/constants')
const checkHeaders = require('./filters/requiredHeaders')
const setupDocumentation = require('./documentation/setup')

let unrestrictedRoutes = null

const isEmptyObject = (obj) => Object.keys(obj).length === 0 && typeof obj === 'object'

const defaultOptions = {
  appName: 'Application Name',
  apiVersion: 'v1',
  esIndex: 'app-name-v1',
  servers: [
    { url: 'server1 url', description: 'server1 description' },
    { url: 'server2 url', description: 'server2 description' }
  ],
  translationsKeys: [],
  unrestrictedRoutes: []
}

const isUnrestrictedRoute = (url) => {
  const found = unrestrictedRoutes.filter((route) => url.includes(route))
  return found.length > 0
}

const elasticStreamFactory = (options) => ({
  stream: pinoElastic({
    index: `${options.index.toLowerCase()}-%{DATE}`,
    consistency: 'one',
    node: options.uri,
    auth: {
      username: options.user,
      password: options.password
    },
    rejectUnauthorized: false,
    'es-version': 7,
    'flush-bytes': 10
  })
})

const loggerFilter = (input) => {
  const data = input[0] || []
  const plainResponse = () => data.err || data.res.statusCode !== 500

  if (typeof data === 'string' || (data.res && plainResponse())) return data
  return null
}

const loggerFormatter = (req, res, err, elapsed) => ({
  conversationId: req.headers[config.HEADER_CONVERSATION_ID.toLowerCase()],
  responsaTS: req.headers[config.HEADER_RESPONSA_TS.toLowerCase()],
  clientTS: res.getHeader(config.HEADER_CLIENT_TS),
  requestBody: req.body || '',
  requestHasBody: !!req.body,
  requestIsHttps: req.protocol === 'https',
  requestContentLength: req.headers['content-length'] ? req.headers['content-length'] : 0,
  requestContentType: req.headers['content-type'] ? req.headers['content-type'] : '',
  requestQueryString: !isEmptyObject(req.query) ? req.query : '',
  requestQueryStringHasValue: !isEmptyObject(req.query),
  requestHeaders: req.headers,
  requestHeadersCount: req.headers.length,
  responseBody: res.payload,
  responseHasBody: !!res.payload,
  RequestMethod: req.method,
  RequestPath: req.url,
  StatusCode: res.statusCode,
  Elapsed: elapsed || 0,
  exceptionMessage: err ? err.message : '',
  exceptionStackTrace: err ? err.stack : ''
})

const loggerFactory = (elasticOptions) => {
  const streams = [{ stream: process.stdout }]

  const hooks = {
    logMethod (inputArgs, method) {
      const data = loggerFilter(inputArgs)
      if (data) return method.apply(this, inputArgs)
      return null
    }
  }

  const formatters = {
    bindings (bindings) {
      return { pid: bindings.pid, machineName: bindings.hostname }
    },
    log (input) {
      if (typeof input === 'string' || !input.res) return input

      const { res } = input
      const { err } = input
      const { request } = res

      return loggerFormatter(request, res.raw, err, input.responseTime)
    }
  }

  if (elasticOptions) {
    streams.push(elasticStreamFactory(elasticOptions))
  }

  const logger = pino({ level: 'info', hooks, formatters }, pinoms.multistream(streams))
  return logger
}

module.exports = fp(
  async (fastify, opts, next) => {
    const f = fastify
    const options = { ...defaultOptions, ...opts, cache }

    unrestrictedRoutes = [...['/documentation', '/status'], ...options.unrestrictedRoutes]

    f.register(autoload, {
      dir: path.join(__dirname, 'routes'),
      options: { ...opts }
    })

    f.addHook('preHandler', (request, reply, done) => {
      if (!isUnrestrictedRoute(request.url) && f.auth) {
        f.auth(request, reply, done)
      } else {
        done()
      }
    })

    f.addHook('onRequest', (request, reply, done) => {
      if (!isUnrestrictedRoute(request.url)) checkHeaders(request.headers)
      done()
    })

    f.addHook('onSend', (request, reply, payload, done) => {
      if (!isUnrestrictedRoute(request.url)) {
        if (!reply.raw.getHeader(config.HEADER_CONVERSATION_ID)) {
          reply.raw.setHeader(
            config.HEADER_CONVERSATION_ID,
            request.headers[config.HEADER_CONVERSATION_ID.toLowerCase()]
          )
        }
        if (!reply.raw.getHeader(config.HEADER_RESPONSA_TS)) {
          reply.raw.setHeader(
            config.HEADER_RESPONSA_TS,
            request.headers[config.HEADER_RESPONSA_TS.toLowerCase()]
          )
        }
        reply.raw.setHeader(config.HEADER_CLIENT_TS, Date.now())
      }
      Object.assign(reply.raw, { payload })
      done()
    })

    f.decorate('coreStatus', status)
    f.decorate('cache', cache)
    f.decorate('singleChoice', toSingle)
    f.decorate('richMessage', toRich)

    setupDocumentation(f, options)

    next()
  },
  { fastify: '3.x', name: 'responsa-plugin-core' }
)

module.exports.loggerFactory = loggerFactory
module.exports.loggerFilter = loggerFilter
module.exports.loggerFormatter = loggerFormatter
module.exports.errorSchema = errorSchema
module.exports.ResponsaSingleChoiceResource = ResponsaSingleChoiceResource
module.exports.ResponsaRichMessageResource = ResponsaRichMessageResource
