import { ICommonAPIParams } from '../../constant/types';
/**
 * 重置旋转屏幕 请求参数定义
 * @apiName resetScreenView
 */
export interface IUnionResetScreenViewParams extends ICommonAPIParams {
}
/**
 * 重置旋转屏幕 返回结果定义
 * @apiName resetScreenView
 */
export interface IUnionResetScreenViewResult {
}
/**
 * 重置旋转屏幕
 * @apiName resetScreenView
 */
export declare function resetScreenView$(params: IUnionResetScreenViewParams): Promise<IUnionResetScreenViewResult>;
export default resetScreenView$;
