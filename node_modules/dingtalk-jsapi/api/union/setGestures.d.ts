import { ICommonAPIParams } from '../../constant/types';
/**
 * 设置webView回退手势 请求参数定义
 * @apiName setGestures
 */
export interface IUnionSetGesturesParams extends ICommonAPIParams {
    backForwardNavigationGestures: boolean;
}
/**
 * 设置webView回退手势 返回结果定义
 * @apiName setGestures
 */
export interface IUnionSetGesturesResult {
}
/**
 * 设置webView回退手势
 * @apiName setGestures
 */
export declare function setGestures$(params: IUnionSetGesturesParams): Promise<IUnionSetGesturesResult>;
export default setGestures$;
