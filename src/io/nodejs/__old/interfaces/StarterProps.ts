import LogLevel from '../../../../../../squidlet/__old/system/interfaces/LogLevel';
import NodejsMachines from './NodejsMachines';
import {NoMachine} from '../starters/StartBase';


export default interface StarterProps {
  //force?: boolean;
  logLevel?: LogLevel;
  machine?: NodejsMachines | NoMachine;
  hostName?: string;
  workDir?: string;
  user?: string | number;
  group?: string | number;
}
