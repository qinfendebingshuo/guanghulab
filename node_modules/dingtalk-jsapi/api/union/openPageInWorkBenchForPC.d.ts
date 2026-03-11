import { ICommonAPIParams } from '../../constant/types';
/**
 * PC端打开新弹窗页面 请求参数定义
 * @apiName openPageInWorkBenchForPC
 */
export interface IUnionOpenPageInWorkBenchForPCParams extends ICommonAPIParams {
    app_url: string;
    app_info: {
        app_tab_key: string;
        app_active_if_exist: boolean;
        app_refresh_if_exist: boolean;
    };
}
/**
 * PC端打开新弹窗页面 返回结果定义
 * @apiName openPageInWorkBenchForPC
 */
export interface IUnionOpenPageInWorkBenchForPCResult {
    body: boolean;
}
/**
 * PC端打开新弹窗页面
 * @apiName openPageInWorkBenchForPC
 */
export declare function openPageInWorkBenchForPC$(params: IUnionOpenPageInWorkBenchForPCParams): Promise<IUnionOpenPageInWorkBenchForPCResult>;
export default openPageInWorkBenchForPC$;
