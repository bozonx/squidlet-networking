import ServiceBase from '../../../../../squidlet/__old/system/base/ServiceBase';
import {omitObj} from '../squidlet-lib/src/objects';
import {Mqtt, MqttProps} from '../../../../../squidlet-networking/src/drivers/Mqtt/Mqtt';
import ApiTopicsLogic from './ApiTopicsLogic';


interface Props extends MqttProps {
  prefix?: string;
}


export default class MqttApiTopics extends ServiceBase<Props> {
  get logic(): ApiTopicsLogic {
    return this._logic as any;
  }

  private _logic?: ApiTopicsLogic;

  private get mqtt(): Mqtt {
    return this.depsInstances.mqtt;
  }


  init = async () => {
    this._logic = new ApiTopicsLogic(this.context, this.props.prefix);
    this.logic.init();
    // TODO: здесь в init наверное будет ожидание соединения ????
    this.depsInstances.mqtt = await this.context.getSubDriver('Mqtt', {
      ...omitObj(this.props, 'prefix'),
    });

    // listen to income messages from mqtt broker
    this.mqtt.onMessage(this.handleIncomeMessages);
    // listen to outcome messages and pass them to mqtt
    this.logic.onOutcome(this.handleOutcomeMessages);
  }

  protected async devicesDidInit() {
    this.log.debug(`MqttApiTopics: subscribe to devices`);

    this.mqtt.connectedPromise
      .then(() => {
        this.subscribeToDevices()
          .catch(this.log.error);
      })
      .catch(this.log.error);
  }

  destroy = async () => {
    await this.logic.destroy();
  }


  /**
   * Processing income messages from broker
   */
  private handleIncomeMessages = (topic: string, data: string | Uint8Array) => {
    if (typeof data !== 'string') {
      return this.log.error(`MqttApiTopics incorrect data of topic "${topic}". It has to be a string`);
    }

    this.logic.incomeMessage(topic, data)
      .catch(this.log.error);
  }

  /**
   * Publish outcome messages to broker
   */
  private handleOutcomeMessages = (topic: string, data?: string): void => {
    this.mqtt.publish(topic, data)
      .catch((e: Error) => this.log.error(e));
  }

  /**
   * Subscribe to all the device's actions calls on broker
   */
  private subscribeToDevices = () => {
    this.log.info(`--> MqttApiTopics: Register MQTT subscribers of devices actions and api methods`);

    const promises: Promise<void>[] = [];

    for (let topic of this.logic.getTopicsToSubscribe()) {
      this.log.debug(`MqttApiTopics subscribe: ${topic}`);

      promises.push(this.mqtt.subscribe(topic));
    }

    return Promise.all(promises);
  }

}
