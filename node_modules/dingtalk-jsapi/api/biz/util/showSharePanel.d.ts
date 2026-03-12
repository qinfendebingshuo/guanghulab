import { ICommonAPIParams } from '../../../constant/types';
/**
 * 展示分享面板 请求参数定义
 * @apiName biz.util.showSharePanel
 */
export interface IBizUtilShowSharePanelParams extends ICommonAPIParams {
}
/**
 * 展示分享面板 返回结果定义
 * @apiName biz.util.showSharePanel
 */
export interface IBizUtilShowSharePanelResult {
}
/**
 * 展示分享面板
 * @apiName biz.util.showSharePanel
 */
export declare function showSharePanel$(params: IBizUtilShowSharePanelParams): Promise<IBizUtilShowSharePanelResult>;
export default showSharePanel$;
