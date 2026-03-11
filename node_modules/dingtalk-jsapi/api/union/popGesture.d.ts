import { ICommonAPIParams } from '../../constant/types';
/**
 * 侧滑手势设置 请求参数定义
 * @apiName popGesture
 */
export interface IUnionPopGestureParams extends ICommonAPIParams {
    popGestureEnabled: boolean;
}
/**
 * 侧滑手势设置 返回结果定义
 * @apiName popGesture
 */
export interface IUnionPopGestureResult {
}
/**
 * 侧滑手势设置
 * @apiName popGesture
 */
export declare function popGesture$(params: IUnionPopGestureParams): Promise<IUnionPopGestureResult>;
export default popGesture$;
