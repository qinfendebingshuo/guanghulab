import { ICommonAPIParams } from '../../../constant/types';
/**
 * 打开系统浏览器 请求参数定义
 * @apiName biz.util.openBrowser
 */
export interface IBizUtilOpenBrowserParams extends ICommonAPIParams {
    url: string;
    className?: string;
    packageName?: string;
}
/**
 * 打开系统浏览器 返回结果定义
 * @apiName biz.util.openBrowser
 */
export interface IBizUtilOpenBrowserResult {
    undefined: undefined;
}
/**
 * 打开系统浏览器
 * @apiName biz.util.openBrowser
 */
export declare function openBrowser$(params: IBizUtilOpenBrowserParams): Promise<IBizUtilOpenBrowserResult>;
export default openBrowser$;
