export declare const apiName = "service.request.mtopOverLwp";
/**
 * ICBU通过lwp发起mtop请求 请求参数定义
 * @apiName service.request.mtopOverLwp
 */
export interface IServiceRequestMtopOverLwpParams {
    /**  请求数据 object 必选 */
    request: object;
    /** appkey key string 必选  */
    appkey: string;
}
/**
 * ICBU通过lwp发起mtop请求 返回结果定义
 * @apiName service.request.mtopOverLwp
 */
export interface IServiceRequestMtopOverLwpResult {
    [key: string]: any;
}
/**
 * ICBU通过lwp发起mtop请求
 * @apiName service.request.mtopOverLwp
 * @supportVersion ios: 4.6.8 android: 4.6.8
 */
export declare function mtopOverLwp$(params: IServiceRequestMtopOverLwpParams): Promise<IServiceRequestMtopOverLwpResult>;
export default mtopOverLwp$;
