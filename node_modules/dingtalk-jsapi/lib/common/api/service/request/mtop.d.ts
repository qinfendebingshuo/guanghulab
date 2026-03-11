export declare const apiName = "service.request.mtop";
/**
 * 钉钉代理mtop请求 请求参数定义
 * @apiName service.request.mtop
 */
export interface IServiceRequestMtopParams {
    [key: string]: any;
}
/**
 * 钉钉代理mtop请求 返回结果定义
 * @apiName service.request.mtop
 */
export interface IServiceRequestMtopResult {
    [key: string]: any;
}
/**
 * 钉钉代理mtop请求
 * @apiName service.request.mtop
 * @supportVersion  ios: 3.4.0 android: 3.4.0
 */
export declare function mtop$(params: IServiceRequestMtopParams): Promise<IServiceRequestMtopResult>;
export default mtop$;
