export declare const apiName = "service.request.httpOverLwp";
/**
 * 安全通道网络请求 请求参数定义
 * @apiName service.request.httpOverLwp
 */
export interface IServiceRequestHttpOverLwpParams {
    [key: string]: any;
}
/**
 * 安全通道网络请求 返回结果定义
 * @apiName service.request.httpOverLwp
 */
export interface IServiceRequestHttpOverLwpResult {
    [key: string]: any;
}
/**
 * 安全通道网络请求
 * @apiName service.request.httpOverLwp
 * @supportVersion  pc: 3.5.0 ios: 3.4.0 android: 3.4.0
 */
export declare function httpOverLwp$(params: IServiceRequestHttpOverLwpParams): Promise<IServiceRequestHttpOverLwpResult>;
export default httpOverLwp$;
