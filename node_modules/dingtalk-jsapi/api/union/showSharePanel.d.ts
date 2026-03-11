import { ICommonAPIParams } from '../../constant/types';
/**
 * 展示分享面板 请求参数定义
 * @apiName showSharePanel
 */
export interface IUnionShowSharePanelParams extends ICommonAPIParams {
}
/**
 * 展示分享面板 返回结果定义
 * @apiName showSharePanel
 */
export interface IUnionShowSharePanelResult {
}
/**
 * 展示分享面板
 * @apiName showSharePanel
 */
export declare function showSharePanel$(params: IUnionShowSharePanelParams): Promise<IUnionShowSharePanelResult>;
export default showSharePanel$;
