export declare const apiName = "runtime.monitor.finishLoad";
/**
 * H5端通知客户端业务加载成功，客户端返回用户操作触发容器加载的时间 请求参数定义
 * @apiName runtime.monitor.finishLoad
 */
export interface IRuntimeMonitorFinishLoadParams {
    [key: string]: any;
}
/**
 * H5端通知客户端业务加载成功，客户端返回用户操作触发容器加载的时间 返回结果定义
 * @apiName runtime.monitor.finishLoad
 */
export interface IRuntimeMonitorFinishLoadResult {
    [key: string]: any;
}
/**
 * H5端通知客户端业务加载成功，客户端返回用户操作触发容器加载的时间
 * @apiName runtime.monitor.finishLoad
 * @supportVersion  ios: 4.2.5 android: 4.2.5
 */
export declare function finishLoad$(params: IRuntimeMonitorFinishLoadParams): Promise<IRuntimeMonitorFinishLoadResult>;
export default finishLoad$;
