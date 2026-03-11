export declare const apiName = "net.vpn.check";
/**
 * 检查深信服vpn是否连接 请求参数定义
 * @apiName net.vpn.check
 */
export interface INetVpnCheckParams {
    [key: string]: any;
}
/**
 * 检查深信服vpn是否连接 返回结果定义
 * @apiName net.vpn.check
 */
export interface INetVpnCheckResult {
    [key: string]: any;
}
/**
 * 检查深信服vpn是否连接
 * @apiName net.vpn.check
 * @supportVersion  ios: 4.1 android: 4.1
 */
export declare function check$(params: INetVpnCheckParams): Promise<INetVpnCheckResult>;
export default check$;
