import NetworkDriverBase from '../../../../../squidlet/__old/system/lib/base/NetworkDriverBase';
import NetworkDriver, {NetworkDriverProps} from '../../../../../squidlet/__old/system/interfaces/NetworkDriver';
import DriverFactoryBase from '../../../../../squidlet/__old/system/base/DriverFactoryBase';
import {Serial} from '../Serial/Serial';


export interface SerialNetworkProps extends NetworkDriverProps {
}


export class SerialNetwork extends NetworkDriverBase<SerialNetworkProps> implements NetworkDriver {
  private get serial(): Serial {
    return this.depsInstances.serial as any;
  }


  init = async () => {
    this.depsInstances.serial = this.context.getSubDriver('Serial', {
      portNum: this.props.busId,
    });

    this.serial.onMessage((data: string | Uint8Array) => {
      if (!(data instanceof Uint8Array)) {
        return this.log.error(`SerialNetwork: income data has to be Uint8Array`);
      }

      try {
        this.incomeMessage(data);
      }
      catch (e) {
        this.log.error(e);
      }
    });
  }


  protected write(data: Uint8Array): Promise<void> {
    return this.serial.write(data);
  }

}


export default class Factory extends DriverFactoryBase<SerialNetwork, SerialNetworkProps> {
  protected SubDriverClass = SerialNetwork;
  protected instanceId = (props: SerialNetworkProps): string => String(props.busId);
}
