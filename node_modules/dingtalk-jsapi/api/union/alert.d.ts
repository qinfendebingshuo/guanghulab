import { ICommonAPIParams } from '../../constant/types';
/**
 * 显示警告框 请求参数定义
 * @apiName alert
 */
export interface IUnionAlertParams extends ICommonAPIParams {
    title?: string;
    content: string;
    buttonText?: string;
}
/**
 * 显示警告框 返回结果定义
 * @apiName alert
 */
export interface IUnionAlertResult {
}
/**
 * 显示警告框
 * @apiName alert
 */
export declare function alert$(params: IUnionAlertParams): Promise<IUnionAlertResult>;
export default alert$;
