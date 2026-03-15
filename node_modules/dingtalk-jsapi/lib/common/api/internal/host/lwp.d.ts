export declare const apiName = "internal.host.lwp";
/**
 * 离线托管的lwp请求 请求参数定义
 * @apiName internal.host.lwp
 */
export interface IInternalHostLwpParams {
    [key: string]: any;
}
/**
 * 离线托管的lwp请求 返回结果定义
 * @apiName internal.host.lwp
 */
export interface IInternalHostLwpResult {
    [key: string]: any;
}
/**
 * 离线托管的lwp请求
 * @apiName internal.host.lwp
 * @supportVersion  ios: 2.9.0 android: 2.9.0
 */
export declare function lwp$(params: IInternalHostLwpParams): Promise<IInternalHostLwpResult>;
export default lwp$;
