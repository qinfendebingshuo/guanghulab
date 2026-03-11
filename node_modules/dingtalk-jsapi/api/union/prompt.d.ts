import { ICommonAPIParams } from '../../constant/types';
/**
 * 弹出输出入对话框 请求参数定义
 * @apiName prompt
 */
export interface IUnionPromptParams extends ICommonAPIParams {
    title: string;
    message: string;
    placeholder: string;
    okButtonText: string;
    cancelButtonText: string;
}
/**
 * 弹出输出入对话框 返回结果定义
 * @apiName prompt
 */
export interface IUnionPromptResult {
    value: string;
    buttonIndex: number;
}
/**
 * 弹出输出入对话框
 * @apiName prompt
 */
export declare function prompt$(params: IUnionPromptParams): Promise<IUnionPromptResult>;
export default prompt$;
