import { ICommonAPIParams } from '../../constant/types';
/**
 * 多选组件 请求参数定义
 * @apiName multiSelect
 */
export interface IUnionMultiSelectParams extends ICommonAPIParams {
    options: string[];
    selectOption?: string[];
}
/**
 * 多选组件 返回结果定义
 * @apiName multiSelect
 */
export interface IUnionMultiSelectResult {
}
/**
 * 多选组件
 * @apiName multiSelect
 */
export declare function multiSelect$(params: IUnionMultiSelectParams): Promise<IUnionMultiSelectResult>;
export default multiSelect$;
