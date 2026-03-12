export declare const apiName = "net.vpn.start";
/**
 * 启动深信服vpn 请求参数定义
 * @apiName net.vpn.start
 */
export interface INetVpnStartParams {
    [key: string]: any;
}
/**
 * 启动深信服vpn 返回结果定义
 * @apiName net.vpn.start
 */
export interface INetVpnStartResult {
    [key: string]: any;
}
/**
 * 启动深信服vpn
 * @apiName net.vpn.start
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function start$(params: INetVpnStartParams): Promise<INetVpnStartResult>;
export default start$;
