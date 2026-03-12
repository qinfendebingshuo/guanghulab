import { ICommonAPIParams } from '../../constant/types';
/**
 * 旋转屏幕 请求参数定义
 * @apiName rotateScreenView
 */
export interface IUnionRotateScreenViewParams extends ICommonAPIParams {
    clockwise: boolean;
    showStatusBar: boolean;
}
/**
 * 旋转屏幕 返回结果定义
 * @apiName rotateScreenView
 */
export interface IUnionRotateScreenViewResult {
}
/**
 * 旋转屏幕
 * @apiName rotateScreenView
 */
export declare function rotateScreenView$(params: IUnionRotateScreenViewParams): Promise<IUnionRotateScreenViewResult>;
export default rotateScreenView$;
