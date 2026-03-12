import { ICommonAPIParams } from '../../constant/types';
/**
 * 显示弱提示 请求参数定义
 * @apiName showToast
 */
export interface IUnionShowToastParams extends ICommonAPIParams {
    type: string;
    content: string;
    duration?: number;
}
/**
 * 显示弱提示 返回结果定义
 * @apiName showToast
 */
export interface IUnionShowToastResult {
}
/**
 * 显示弱提示
 * @apiName showToast
 */
export declare function showToast$(params: IUnionShowToastParams): Promise<IUnionShowToastResult>;
export default showToast$;
