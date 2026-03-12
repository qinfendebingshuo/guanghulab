import { ICommonAPIParams } from '../../constant/types';
/**
 * 禁用iOS Webview弹性效果	 请求参数定义
 * @apiName disableWebViewBounce
 */
export interface IUnionDisableWebViewBounceParams extends ICommonAPIParams {
}
/**
 * 禁用iOS Webview弹性效果	 返回结果定义
 * @apiName disableWebViewBounce
 */
export interface IUnionDisableWebViewBounceResult {
}
/**
 * 禁用iOS Webview弹性效果
 * @apiName disableWebViewBounce
 */
export declare function disableWebViewBounce$(params: IUnionDisableWebViewBounceParams): Promise<IUnionDisableWebViewBounceResult>;
export default disableWebViewBounce$;
