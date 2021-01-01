
// create a tcp modbus client
const Modbus = require('jsmodbus')
const SerialPort = require('serialport')
const options = {
  baudRate: 57600
}
const socket = new SerialPort("/dev/tty-usbserial1", options)
const client = new Modbus.client.RTU(socket, address)


export default class ModBusMasterRs485 implements ModBusMasterRs485Io {

}
