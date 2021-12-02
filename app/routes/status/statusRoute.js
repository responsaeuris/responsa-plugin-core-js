const status = async () => {
  const ciCommit = '7fbdfa4af0dfdc3c482c9261e98cefe2d7de0e68 Merge branch _release_0.2.6_'
  const lastDeploy = 'Thu Dec  2 14:53:07 UTC 2021'

  return `ok! Plugin Core released on ${lastDeploy}, last commit was "${ciCommit}"`
}

module.exports = async function (fastify) {
  fastify.get('/', status)
}

module.exports.status = status
