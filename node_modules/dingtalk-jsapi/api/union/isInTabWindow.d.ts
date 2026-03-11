import { ICommonAPIParams } from '../../constant/types';
/**
 * 判断是否为弹窗窗口 请求参数定义
 * @apiName isInTabWindow
 */
export interface IUnionIsInTabWindowParams extends ICommonAPIParams {
}
/**
 * 判断是否为弹窗窗口 返回结果定义
 * @apiName isInTabWindow
 */
export interface IUnionIsInTabWindowResult {
    result: boolean;
}
/**
 * 判断是否为弹窗窗口
 * @apiName isInTabWindow
 */
export declare function isInTabWindow$(params: IUnionIsInTabWindowParams): Promise<IUnionIsInTabWindowResult>;
export default isInTabWindow$;
