const path = require('path')
const cache = require('../cache/cache')
const helper = require('./helper')

/* eslint-disable global-require */
const setupApp = async (config) => {
  cache.nuke()

  const conf = config || {}
  conf.prefix = '/core'

  const app = require('fastify')()

  app.register(require('..'), conf)

  return app.ready()
}

describe('plugin registration', () => {
  it('should register the correct decorators', async () => {
    expect.assertions(3)

    const app = await setupApp()

    expect(app.coreStatus).toBeDefined()
    expect(app.getCsvData).toBeDefined()
    expect(app.getTranslations).toBeDefined()
  })
})

describe('cache', () => {
  it('correctly loads translations into array', async () => {
    const app = await setupApp()

    const actual = await app.getTranslations(path.join(__dirname, 'csv', 'valid-csv.csv'), false)
    expect(actual).toBeInstanceOf(Array)
    expect(actual.length).toEqual(2)
  })

  it('get empty array if app initialization has been made without translation file', async () => {
    const app = await setupApp()

    const actual = await app.getTranslations(path.join(__dirname, 'csv', 'valid-csv.csv'), true)
    expect(actual).toBeInstanceOf(Array)
    expect(actual.length).toEqual(0)
  })
})

describe('options loading', () => {
  const getSwaggerInfo = async (opt) => {
    const app = await setupApp(opt)

    const response = await helper.doGet(app, 'documentation/json')

    const actual = JSON.parse(response.payload)

    expect(actual.info).toBeDefined()
    return actual.info
  }

  it('loads appName', async () => {
    const actual = await getSwaggerInfo({ appName: 'some-app-name' })

    expect(actual.title).toEqual('some-app-name')
  })

  it('loads version', async () => {
    const actual = await getSwaggerInfo({ apiVersion: 'v1' })

    expect(actual.version).toEqual('v1')
  })

  it('loads x-log-index', async () => {
    const actual = await getSwaggerInfo({ appName: 'some-app-name', apiVersion: 'v1' })

    expect(actual['x-log-index']).toEqual('some-app-name-v1')
  })

  it('loads translations', async () => {
    const response = await getSwaggerInfo({
      translationsPath: path.join(__dirname, 'csv', 'valid-csv.csv'),
    })

    const actual = response['x-translations']

    expect(actual).toBeDefined()
    expect(actual).toBeInstanceOf(Array)

    expect(actual.length).toEqual(2)

    expect(actual[0]).toEqual('{{KEY_SELECT}}')
    expect(actual[1]).toEqual('{{KEY_VIEW_DETAILS}}')
  })
})