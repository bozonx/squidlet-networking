import MachineConfig from '../../hostEnvBuilder/interfaces/MachineConfig';


const machineConfig: MachineConfig = {
  ios: {
    Sys: './ios/Sys.ts',
    Storage: './ios/Storage.ts',
    Mqtt: './ios/Mqtt.ts',
    WebSocketClient: './ios/WebSocketClient.ts',
    WebSocketServer: './ios/WebSocketServer.ts',
    HttpClient: './ios/HttpClient.ts',
    HttpServer: './ios/HttpServer.ts',

    Serial: './ios/Serial-serialport.ts',
    ModBusMasterRtu: './ios/ModBusMasterRtu.ts',
    //'Wifi',
    //'Bluetooth',
  },


  hostConfig: {
  }
};

export default machineConfig;
