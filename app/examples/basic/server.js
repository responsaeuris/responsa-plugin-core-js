const fastify = require('fastify')
const pluginCore = require('../..')

const elasticOptions = {
  uri: 'https://localhost:9200',
  user: 'newboss',
  password: 'newboss',
  index: 'some-index',
}

const app = fastify({ logger: pluginCore.loggerFactory(elasticOptions) })

app.register(pluginCore, { prefix: '/core' })
app.log.info('started')

app.get('/', async (req, reply) => {
  reply.send(await app.coreStatus())
})

app.get('/throws-error', async () => {
  throw new Error('voluntary error')
})

app.listen(process.env.PORT || 3100)

// CLIENT
//   log request
//     CORE
//       cache request
//   error
//     CORE
//       log error

// CLIENT
//   log request
//     CORE
//       cache request
//   log response
//     CORE
//       log transaction

// CLIENT
//   log "hello world"

// CLIENT

// layer cache

// CORE
