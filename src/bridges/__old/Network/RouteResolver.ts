import {lastItem} from '../squidlet-lib/src/arrays';


// TODO: если нет маршрута то делаем ping (наверное широковещательный на все подключения)
// TODO: сделать таймаут если маршрут не используется то он удаляется из кэша
// TODO: если была ошибка отправки сообщения до ближайшего хоста
//       то удалить его из routes и hostIds

export default class RouteResolver {
  private readonly myHostId: string;
  // routes from current host to remote: {remoteHostId: [oneHost, secondHost, ...]}
  private routes: {[index: string]: string[]} = {};
  // closest host ids like {peerId: hostId}
  private closestHostIds: {[index: string]: string} = {};


  constructor(myHostId: string) {
    this.myHostId = myHostId;
  }

  init() {
  }

  destroy() {
    delete this.routes;
    delete this.closestHostIds;
  }


  /**
   * Get closest hostId on route to host "to" from cache
   * @param to
   */
  resolveClosestHostId(to: string): string | undefined {
    return this.routes[to][0];
  }

  /**
   * Save completed route of income message
   * @param completedRoute
   */
  saveRoute(completedRoute: string[]) {
    if (!completedRoute.length) throw new Error(`completedRoute is empty`);
    // TODO: впринципе можно не сохранять сам последний элемент для экономии
    const route = completedRoute.reverse();
    const remoteHost: string = lastItem(route);
    // save the last actual route to remote host
    this.routes[remoteHost] = route;
  }

  resolvePeerId(closestHostId: string): string | undefined {
    for (let peerId of Object.keys(this.closestHostIds)) {
      if (this.closestHostIds[peerId] === closestHostId) return peerId;
    }

    return;
  }

  activatePeer(peerId: string, hostId: string) {
    this.closestHostIds[peerId] = hostId;
  }

  deactivatePeer(peerId: string) {
    delete this.closestHostIds[peerId];
  }

}
