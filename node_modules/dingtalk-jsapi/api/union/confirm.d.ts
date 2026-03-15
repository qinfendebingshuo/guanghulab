import { ICommonAPIParams } from '../../constant/types';
/**
 * 显示确认框 请求参数定义
 * @apiName confirm
 */
export interface IUnionConfirmParams extends ICommonAPIParams {
    title: string;
    content: string;
    cancelButtonText?: string;
    confirmButtonText?: string;
}
/**
 * 显示确认框 返回结果定义
 * @apiName confirm
 */
export interface IUnionConfirmResult {
    confirm?: boolean;
}
/**
 * 显示确认框
 * @apiName confirm
 */
export declare function confirm$(params: IUnionConfirmParams): Promise<IUnionConfirmResult>;
export default confirm$;
