export declare const apiName = "net.tunnel.request";
/**
 * 设客户端提供代理，来发送https请求 请求参数定义
 * @apiName net.tunnel.request
 */
export interface INetTunnelRequestParams {
    [key: string]: any;
}
/**
 * 设客户端提供代理，来发送https请求 返回结果定义
 * @apiName net.tunnel.request
 */
export interface INetTunnelRequestResult {
    [key: string]: any;
}
/**
 * 设客户端提供代理，来发送https请求
 * @apiName net.tunnel.request
 * @supportVersion  ios: 4.2
 */
export declare function request$(params: INetTunnelRequestParams): Promise<INetTunnelRequestResult>;
export default request$;
