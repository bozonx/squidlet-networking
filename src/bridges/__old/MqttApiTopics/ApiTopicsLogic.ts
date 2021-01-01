import {combineTopic, parseArgs} from '../../../../../squidlet/__old/system/lib/helpers';
import {Dictionary, JsonTypes} from '../../../../../squidlet/__old/system/interfaces/Types';
import {StateCategories} from '../../../../../squidlet/__old/system/interfaces/States';
import IndexedEvents from '../squidlet-lib/src/IndexedEvents';
import {DEFAULT_DEVICE_STATUS} from '../../../../../squidlet/__old/system/constants';
import Context from '../../../../../squidlet/__old/system/Context';


type OutcomeHandler = (topic: string, data?: string) => void;
type TopicType = 'api' | 'action' | 'status' | 'config';

const TOPIC_SEPARATOR = '/';
const topicTypes = ['api', 'action', 'status', 'config'];


/**
 * Call api method or manage devices via simple MQTT string api.
 * See doc `doc/mqttApi.md` for details.
 */
export default class ApiTopicsLogic {
  private readonly context: Context;
  private readonly prefix?: string;
  private readonly outcomeEvents = new IndexedEvents<OutcomeHandler>();


  constructor(context: Context, prefix?: string) {
    this.context = context;
    this.prefix = prefix;
  }

  init() {
    // listen to outcome messages from devices state and send them to mqtt broker
    this.context.state.onChange(this.handleStateChange);
  }

  destroy() {
    this.outcomeEvents.destroy();
  }


  /**
   * Call this when you have received an income message
   */
  incomeMessage = (fullTopic: string, data: string): Promise<void> => {
    let prefix: string | undefined;
    let topicType: TopicType;
    let bodyParts: string[];

    try {
      [prefix, topicType, ...bodyParts] = this.parseTopic(fullTopic);
    }
    catch (e) {
      // do nothing because it isn't ours topic.
      return Promise.resolve();
    }

    // skip not ours prefix
    if (prefix !== this.prefix) return Promise.resolve();

    switch (topicType) {
      case 'action':
        return this.callAction(bodyParts[0], bodyParts[1], data);
      case 'api':
        return this.callApi(bodyParts[0], data);
    }
    // skip others
    return Promise.resolve();
  }

  /**
   * Listen messages which are sent outcome from this host.
   */
  onOutcome(cb: OutcomeHandler): number {
    return this.outcomeEvents.addListener(cb);
  }

  /**
   * Remove outcome listener
   */
  removeListener(handlerIndex: number) {
    this.outcomeEvents.removeListener(handlerIndex);
  }

  /**
   * Get topics of all the device's actions like ['room1/place2/deviceId.actionName', ...]
   */
  getTopicsToSubscribe(): string[] {
    const topics: string[] = [];
    const actionType: TopicType = 'action';
    const apiType: TopicType = 'api';
    const devicesIds: string[] = this.context.system.devicesManager.getIds();
    const methodNames: string[] = this.context.system.apiManager.getMethodNames();

    for (let deviceId of devicesIds) {
      const device = this.context.system.devicesManager.getDevice(deviceId);

      for (let actionName of device.getActionsList()) {
        const topic: string = combineTopic(TOPIC_SEPARATOR, this.prefix, actionType, deviceId, actionName);

        topics.push(topic);
      }
    }

    for (let methodName of methodNames) {
      const topic: string = combineTopic(TOPIC_SEPARATOR, this.prefix, apiType, methodName);

      topics.push(topic);
    }

    return topics;
  }


  private handleStateChange = (category: number, stateName: string, changedParams: string[]) => {
    try {
      // send outcome all the devices status and config changes
      if (category === StateCategories.devicesStatus) {
        this.publishDeviceState('status', category, stateName, changedParams);
      }
      else if (category === StateCategories.devicesConfig) {
        this.publishDeviceState('config', category, stateName, changedParams);
      }
    }
    catch (err) {
      this.context.log.error(`Can't publish device state: ${err}`);
    }
  }

  private callApi(apiMethodName: string, argsStr: string): Promise<void> {
    this.context.log.debug(`MqttApiTopics income call api method "${apiMethodName}": ${argsStr}`);

    const args: (JsonTypes | undefined)[] = parseArgs(argsStr);

    return this.context.system.apiManager.callApi(apiMethodName, args);
  }

  private callAction(deviceId: string, actionName: string, argsStr?: string) {
    if (!actionName) {
      throw new Error(`MqttApiTopics.callAction: no actionName: "${deviceId}"`);
    }

    this.context.log.debug(
      `MqttApiTopics income action device call ${deviceId}${TOPIC_SEPARATOR}${actionName}: ${argsStr}`
    );

    const args: (JsonTypes | undefined)[] = parseArgs(argsStr);

    return this.context.system.apiManager.callApi('action', [deviceId, actionName, ...args]);
  }

  /**
   * Parse topic to [prefix, topicType, ...topicBody].
   */
  private parseTopic(topic: string): [(string | undefined), TopicType, ...string[]] {
    const splat: string[] = topic.split(TOPIC_SEPARATOR);
    let prefix: string | undefined;
    let topicType: TopicType;
    let bodyParts: string[];

    if (splat.length < 2) {
      throw new Error(`Invalid topic "${topic}": Doesn't have the body`);
    }
    else if (topicTypes.includes(splat[0])) {
      // topic without prefix
      topicType = splat[0] as TopicType;
      bodyParts = splat.slice(1);
    }
    else if (topicTypes.includes(splat[1])) {
      // topic with prefix
      prefix = splat[0];
      topicType = splat[1] as TopicType;
      bodyParts = splat.slice(2);
    }
    else {
      throw new Error(`Invalid topic "${topic}": unknown type`);
    }

    return [ prefix, topicType, ...bodyParts ];
  }

  private publishDeviceState(
    topicType: TopicType,
    category: number,
    deviceId: string,
    changedParams: string[]
  ) {
    const state: Dictionary | undefined = this.context.state.getState(category, deviceId);

    // if state == undefined means state hasn't been registered
    if (!state) return;

    for (let paramName of changedParams) {
      // if default then don't use param name
      const resolvedParamName: string | undefined = (paramName === DEFAULT_DEVICE_STATUS)
        ? undefined
        : paramName;
      const topic: string = combineTopic(TOPIC_SEPARATOR, this.prefix, topicType, deviceId, resolvedParamName);
      const value: string = this.preparePublishValue(state[paramName]);

      this.context.log.debug(`MqttApiTopics outcome: ${topic} - ${JSON.stringify(value)}`);
      this.outcomeEvents.emit(topic, value);
    }
  }

  private preparePublishValue(value: JsonTypes | undefined): string {
    if (typeof value === 'string') return value;

    return JSON.stringify(value);
  }

}
