import { ICommonAPIParams } from '../../constant/types';
/**
 * 下拉单项控件 请求参数定义
 * @apiName singleSelect
 */
export interface IUnionSingleSelectParams extends ICommonAPIParams {
    source: {
        key: string;
        value: string;
    }[];
    selectedKey?: string;
}
/**
 * 下拉单项控件 返回结果定义
 * @apiName singleSelect
 */
export interface IUnionSingleSelectResult {
    key: string;
    value: string;
}
/**
 * 下拉单项控件
 * @apiName singleSelect
 */
export declare function singleSelect$(params: IUnionSingleSelectParams): Promise<IUnionSingleSelectResult>;
export default singleSelect$;
