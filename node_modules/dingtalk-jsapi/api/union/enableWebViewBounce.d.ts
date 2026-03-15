import { ICommonAPIParams } from '../../constant/types';
/**
 * 启用iOS Webview弹性效果	 请求参数定义
 * @apiName enableWebViewBounce
 */
export interface IUnionEnableWebViewBounceParams extends ICommonAPIParams {
}
/**
 * 启用iOS Webview弹性效果	 返回结果定义
 * @apiName enableWebViewBounce
 */
export interface IUnionEnableWebViewBounceResult {
}
/**
 * 启用iOS Webview弹性效果
 * @apiName enableWebViewBounce
 */
export declare function enableWebViewBounce$(params: IUnionEnableWebViewBounceParams): Promise<IUnionEnableWebViewBounceResult>;
export default enableWebViewBounce$;
