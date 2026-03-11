export declare const apiName = "runtime.info.status";
/**
 * 获取当前容器状态 请求参数定义
 * @apiName runtime.info.status
 */
export interface IRuntimeInfoStatusParams {
    [key: string]: any;
}
/**
 * 获取当前容器状态 返回结果定义
 * @apiName runtime.info.status
 */
export interface IRuntimeInfoStatusResult {
    [key: string]: any;
}
/**
 * 获取当前容器状态
 * @apiName runtime.info.status
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function status$(params: IRuntimeInfoStatusParams): Promise<IRuntimeInfoStatusResult>;
export default status$;
