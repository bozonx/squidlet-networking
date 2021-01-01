# main file for tests
chai = require('chai')
sinon = require("sinon")
sinonChai = require('sinon-chai')
chaiAsPromised = require('chai-as-promised')
rewire = require("rewire")

chai.use(sinonChai)
chai.use(chaiAsPromised)

global.assert = chai.assert
global.expect = chai.expect
global.sinon = sinon
global.rewire = rewire

global._ = require('lodash')

# do not log to console
global.silent = true
