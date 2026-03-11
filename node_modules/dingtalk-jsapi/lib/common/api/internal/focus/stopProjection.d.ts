export declare const apiName = "internal.focus.stopProjection";
/**
 * 停止投屏 请求参数定义
 * @apiName internal.focus.stopProjection
 */
export interface IInternalFocusStopProjectionParams {
}
/**
 * 停止投屏 返回结果定义
 * @apiName internal.focus.stopProjection
 */
export interface IInternalFocusStopProjectionResult {
}
/**
 * 停止投屏
 * @apiName internal.focus.stopProjection
 * @supportVersion android: 4.7.23
 * @author android: 柳樵, ios: 见招
 */
export declare function stopProjection$(params: IInternalFocusStopProjectionParams): Promise<IInternalFocusStopProjectionResult>;
export default stopProjection$;
