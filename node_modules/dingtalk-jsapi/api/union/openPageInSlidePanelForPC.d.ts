import { ICommonAPIParams } from '../../constant/types';
/**
 * 打开侧边面板 请求参数定义
 * @apiName openPageInSlidePanelForPC
 */
export interface IUnionOpenPageInSlidePanelForPCParams extends ICommonAPIParams {
    url: string;
    title: string;
}
/**
 * 打开侧边面板 返回结果定义
 * @apiName openPageInSlidePanelForPC
 */
export interface IUnionOpenPageInSlidePanelForPCResult {
}
/**
 * 打开侧边面板
 * @apiName openPageInSlidePanelForPC
 */
export declare function openPageInSlidePanelForPC$(params: IUnionOpenPageInSlidePanelForPCParams): Promise<IUnionOpenPageInSlidePanelForPCResult>;
export default openPageInSlidePanelForPC$;
