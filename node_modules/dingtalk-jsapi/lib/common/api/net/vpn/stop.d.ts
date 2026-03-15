export declare const apiName = "net.vpn.stop";
/**
 * 关闭深信服vpn 请求参数定义
 * @apiName net.vpn.stop
 */
export interface INetVpnStopParams {
    [key: string]: any;
}
/**
 * 关闭深信服vpn 返回结果定义
 * @apiName net.vpn.stop
 */
export interface INetVpnStopResult {
    [key: string]: any;
}
/**
 * 关闭深信服vpn
 * @apiName net.vpn.stop
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function stop$(params: INetVpnStopParams): Promise<INetVpnStopResult>;
export default stop$;
